// 구독 결제(토스페이먼츠 빌링) 관련 API 라우트
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { getConnection, sql } = require('../config/database');
const { issueBillingKey, requestBilling } = require('../services/tossPayments');

// 플랜별 실제 청구 금액(원, VAT 포함)
const PLAN_CONFIG = {
  BASIC: { amount: 1089000, orderName: 'C1B 기본 플랜' },
  EXTRA: { amount: 55000, orderName: 'C1B 추가 플랜' }
};

function getPlanConfig(plan) {
  return PLAN_CONFIG[plan] || null;
}

// 고유 주문번호 생성
function generateOrderId(userId) {
  const rand = crypto.randomBytes(4).toString('hex');
  return `SUB_${userId}_${Date.now()}_${rand}`;
}

// customerKey 생성 (추측 어려운 값)
function generateCustomerKey(userId) {
  const rand = crypto.randomBytes(8).toString('hex');
  return `cus_${userId}_${rand}`;
}

// 결제 성공 시 결제 이력 저장 + tb_user.end_date 1개월 연장 + 구독 상태 업데이트
async function applySuccessfulPayment(pool, { userId, planType, amount, orderId, payment }) {
  // 결제 이력 저장
  await pool.request()
    .input('user_id', sql.NVarChar, userId)
    .input('order_id', sql.NVarChar, orderId)
    .input('payment_key', sql.NVarChar, payment.paymentKey || null)
    .input('plan_type', sql.NVarChar, planType)
    .input('amount', sql.Int, amount)
    .input('status', sql.NVarChar, payment.status || 'DONE')
    .input('paid_at', sql.DateTime, payment.approvedAt ? new Date(payment.approvedAt) : new Date())
    .input('raw_response', sql.NVarChar, JSON.stringify(payment))
    .query(`
      INSERT INTO tb_subscription_payment
        (user_id, order_id, payment_key, plan_type, amount, status, paid_at, raw_response)
      VALUES
        (@user_id, @order_id, @payment_key, @plan_type, @amount, @status, @paid_at, @raw_response)
    `);

  // tb_user.end_date 1개월 연장 (만료되었거나 NULL이면 오늘 기준, 아니면 기존 만료일 기준)
  await pool.request()
    .input('user_id', sql.NVarChar, userId)
    .query(`
      UPDATE tb_user
      SET end_date = DATEADD(MONTH, 1,
        CASE
          WHEN end_date IS NULL OR end_date < CONVERT(DATE, GETDATE())
          THEN CONVERT(DATE, GETDATE())
          ELSE end_date
        END)
      WHERE user_id = @user_id
    `);

  // 구독 상태/다음 결제일 업데이트
  await pool.request()
    .input('user_id', sql.NVarChar, userId)
    .query(`
      UPDATE tb_subscription
      SET status = 'ACTIVE',
          next_pay_date = DATEADD(MONTH, 1, CONVERT(DATE, GETDATE())),
          updated_at = GETDATE()
      WHERE user_id = @user_id
    `);
}

// 1) 결제 준비: customerKey 발급 + 구독 레코드 생성/갱신 (status=PENDING)
router.post('/prepare', async (req, res) => {
  try {
    const { userId, plan } = req.body;
    const planConfig = getPlanConfig(plan);

    if (!userId || !planConfig) {
      return res.status(400).json({ success: false, message: '필수 정보(userId, plan)가 올바르지 않습니다.' });
    }

    const pool = await getConnection();

    // 기존 구독 레코드 조회 (customerKey 재사용)
    const existing = await pool.request()
      .input('user_id', sql.NVarChar, userId)
      .query(`SELECT TOP 1 customer_key FROM tb_subscription WHERE user_id = @user_id ORDER BY seq DESC`);

    let customerKey;
    if (existing.recordset.length > 0 && existing.recordset[0].customer_key) {
      customerKey = existing.recordset[0].customer_key;
      // 플랜/금액/상태 갱신
      await pool.request()
        .input('user_id', sql.NVarChar, userId)
        .input('customer_key', sql.NVarChar, customerKey)
        .input('plan_type', sql.NVarChar, plan)
        .input('amount', sql.Int, planConfig.amount)
        .query(`
          UPDATE tb_subscription
          SET plan_type = @plan_type, amount = @amount, status = 'PENDING', updated_at = GETDATE()
          WHERE customer_key = @customer_key
        `);
    } else {
      customerKey = generateCustomerKey(userId);
      await pool.request()
        .input('user_id', sql.NVarChar, userId)
        .input('customer_key', sql.NVarChar, customerKey)
        .input('plan_type', sql.NVarChar, plan)
        .input('amount', sql.Int, planConfig.amount)
        .query(`
          INSERT INTO tb_subscription (user_id, customer_key, plan_type, amount, status)
          VALUES (@user_id, @customer_key, @plan_type, @amount, 'PENDING')
        `);
    }

    res.json({ success: true, data: { customerKey } });
  } catch (error) {
    console.error('구독 준비 오류:', error);
    res.status(500).json({ success: false, message: '구독 준비 중 오류가 발생했습니다.' });
  }
});

// 2) 빌링키 발급 + 첫 결제 + 만료일 연장
router.post('/issue-billing-key', async (req, res) => {
  try {
    const { authKey, customerKey, plan, userId } = req.body;
    const planConfig = getPlanConfig(plan);

    if (!authKey || !customerKey || !userId || !planConfig) {
      return res.status(400).json({ success: false, message: '필수 정보가 누락되었습니다.' });
    }

    const pool = await getConnection();

    // 빌링키 발급
    const billing = await issueBillingKey(authKey, customerKey);
    const billingKey = billing.billingKey;

    // 빌링키 저장
    await pool.request()
      .input('customer_key', sql.NVarChar, customerKey)
      .input('billing_key', sql.NVarChar, billingKey)
      .query(`
        UPDATE tb_subscription
        SET billing_key = @billing_key, updated_at = GETDATE()
        WHERE customer_key = @customer_key
      `);

    // 첫 결제 실행
    const orderId = generateOrderId(userId);
    const payment = await requestBilling(billingKey, {
      customerKey,
      amount: planConfig.amount,
      orderId,
      orderName: planConfig.orderName
    });

    // 결제 이력 + 만료일 연장 + 구독 활성화
    await applySuccessfulPayment(pool, {
      userId,
      planType: plan,
      amount: planConfig.amount,
      orderId,
      payment
    });

    res.json({ success: true, data: { orderId, status: payment.status } });
  } catch (error) {
    console.error('빌링키 발급/결제 오류:', error);
    res.status(500).json({ success: false, message: error.message || '구독 결제 처리 중 오류가 발생했습니다.' });
  }
});

// 3) 구독 상태 조회
router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const pool = await getConnection();
    const result = await pool.request()
      .input('user_id', sql.NVarChar, userId)
      .query(`
        SELECT TOP 1 user_id, plan_type, amount, status, next_pay_date,
               CASE WHEN billing_key IS NULL THEN 0 ELSE 1 END AS has_billing_key,
               created_at, updated_at
        FROM tb_subscription
        WHERE user_id = @user_id
        ORDER BY seq DESC
      `);

    res.json({ success: true, data: result.recordset[0] || null });
  } catch (error) {
    console.error('구독 상태 조회 오류:', error);
    res.status(500).json({ success: false, message: '구독 상태 조회 중 오류가 발생했습니다.' });
  }
});

// 4) 구독 해지 (자동결제 중지)
router.post('/cancel', async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ success: false, message: 'userId가 필요합니다.' });
    }

    const pool = await getConnection();
    await pool.request()
      .input('user_id', sql.NVarChar, userId)
      .query(`
        UPDATE tb_subscription
        SET status = 'CANCELED', next_pay_date = NULL, updated_at = GETDATE()
        WHERE user_id = @user_id
      `);

    res.json({ success: true, message: '구독이 해지되었습니다. (남은 기간은 유지됩니다)' });
  } catch (error) {
    console.error('구독 해지 오류:', error);
    res.status(500).json({ success: false, message: '구독 해지 중 오류가 발생했습니다.' });
  }
});

// 단일 구독 건 결제 실행 (스케줄러/테스트 공용)
async function chargeSubscription(pool, subscription) {
  const { user_id: userId, billing_key: billingKey, customer_key: customerKey, plan_type: planType, amount } = subscription;
  const orderName = (getPlanConfig(planType) || {}).orderName || 'C1B 구독';
  const orderId = generateOrderId(userId);

  try {
    const payment = await requestBilling(billingKey, {
      customerKey,
      amount,
      orderId,
      orderName
    });
    await applySuccessfulPayment(pool, { userId, planType, amount, orderId, payment });
    return { userId, success: true };
  } catch (error) {
    // 실패 이력 저장 + 상태 FAILED
    try {
      await pool.request()
        .input('user_id', sql.NVarChar, userId)
        .input('order_id', sql.NVarChar, orderId)
        .input('plan_type', sql.NVarChar, planType)
        .input('amount', sql.Int, amount)
        .input('status', sql.NVarChar, 'FAILED')
        .input('raw_response', sql.NVarChar, JSON.stringify(error.tossResponse || { message: error.message }))
        .query(`
          INSERT INTO tb_subscription_payment
            (user_id, order_id, plan_type, amount, status, raw_response)
          VALUES
            (@user_id, @order_id, @plan_type, @amount, @status, @raw_response)
        `);
      await pool.request()
        .input('user_id', sql.NVarChar, userId)
        .query(`UPDATE tb_subscription SET status = 'FAILED', updated_at = GETDATE() WHERE user_id = @user_id`);
    } catch (logErr) {
      console.error('결제 실패 이력 저장 오류:', logErr);
    }
    return { userId, success: false, message: error.message };
  }
}

// 정기결제 배치 실행 (오늘이 결제예정일이고 ACTIVE 상태인 구독 결제)
async function runMonthlyBilling() {
  const pool = await getConnection();
  const targets = await pool.request().query(`
    SELECT user_id, customer_key, billing_key, plan_type, amount
    FROM tb_subscription
    WHERE status = 'ACTIVE'
      AND billing_key IS NOT NULL
      AND next_pay_date IS NOT NULL
      AND next_pay_date <= CONVERT(DATE, GETDATE())
  `);

  const results = [];
  for (const sub of targets.recordset) {
    // eslint-disable-next-line no-await-in-loop
    const r = await chargeSubscription(pool, sub);
    results.push(r);
  }
  console.log(`🔁 정기결제 배치 완료: 대상 ${targets.recordset.length}건, 결과`, results);
  return results;
}

// 5) (테스트용) 정기결제 배치 수동 실행
router.post('/run-billing', async (req, res) => {
  try {
    const results = await runMonthlyBilling();
    res.json({ success: true, data: results });
  } catch (error) {
    console.error('정기결제 배치 오류:', error);
    res.status(500).json({ success: false, message: '정기결제 배치 실행 중 오류가 발생했습니다.' });
  }
});

// 6) (테스트용) 특정 유저 즉시 결제
router.post('/charge-now', async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ success: false, message: 'userId가 필요합니다.' });
    }

    const pool = await getConnection();
    const result = await pool.request()
      .input('user_id', sql.NVarChar, userId)
      .query(`
        SELECT TOP 1 user_id, customer_key, billing_key, plan_type, amount
        FROM tb_subscription
        WHERE user_id = @user_id AND billing_key IS NOT NULL
        ORDER BY seq DESC
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ success: false, message: '결제 가능한 구독(빌링키)이 없습니다.' });
    }

    const r = await chargeSubscription(pool, result.recordset[0]);
    if (!r.success) {
      return res.status(400).json({ success: false, message: r.message });
    }
    res.json({ success: true, data: r });
  } catch (error) {
    console.error('즉시 결제 오류:', error);
    res.status(500).json({ success: false, message: '즉시 결제 중 오류가 발생했습니다.' });
  }
});

// 7) 웹훅 수신 (결제 상태 통지)
router.post('/webhook', async (req, res) => {
  try {
    // 빠른 200 응답이 중요. 상세 처리는 비동기로.
    console.log('📩 토스 웹훅 수신:', JSON.stringify(req.body));
    res.sendStatus(200);
  } catch (error) {
    console.error('웹훅 처리 오류:', error);
    res.sendStatus(200);
  }
});

module.exports = router;
module.exports.runMonthlyBilling = runMonthlyBilling;
