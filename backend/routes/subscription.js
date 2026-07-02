// 구독 결제(토스페이먼츠 빌링) 관련 API 라우트
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { getConnection, sql } = require('../config/database');
const { issueBillingKey, requestBilling, confirmPayment } = require('../services/tossPayments');

// VAT 세율 (10%)
const VAT_RATE = 0.1;

// 플랜 메타 (주문명 등). 실제 청구 금액은 기준정보(구독료)에서 동적으로 산정.
const PLAN_META = {
  BASIC: { orderName: 'C1B 기본 플랜' },
  EXTRA: { orderName: 'C1B 추가 플랜', baseAmount: 50000 },
  EXTEND: { orderName: 'C1B 2주 연장', amount: 550000 }
};

function getPlanConfig(plan) {
  return PLAN_META[plan] || null;
}

// VAT 포함 금액으로 환산 (원 단위 반올림)
function applyVat(amount) {
  return Math.round(Number(amount || 0) * (1 + VAT_RATE));
}

// 기준정보(tb_setting_info)의 구독료(sub_fee) 조회 (VAT 별도 공급가)
async function getSubscriptionFee(pool) {
  const result = await pool.request().query('SELECT TOP 1 sub_fee FROM tb_setting_info');
  if (result.recordset.length === 0) return 0;
  return Number(result.recordset[0].sub_fee) || 0;
}

// 플랜별 VAT 포함 청구 금액 결정 (서버에서 강제)
// 기본 플랜: 기준정보관리의 '구독료' 기준 / 추가 플랜: 고정 금액 기준
async function resolvePlanAmount(pool, plan) {
  if (plan === 'BASIC') {
    const subFee = await getSubscriptionFee(pool);
    return applyVat(subFee);
  }
  if (plan === 'EXTRA') {
    return applyVat(PLAN_META.EXTRA.baseAmount);
  }
  if (plan === 'EXTEND') {
    return PLAN_META.EXTEND.amount;
  }
  return 0;
}

// 고유 주문번호 생성
function generateOrderId(userId) {
  const rand = crypto.randomBytes(4).toString('hex');
  return `SUB_${userId}_${Date.now()}_${rand}`;
}

// 2주 연장(일회성 결제) 주문번호
function generateExtendOrderId(userId) {
  const rand = crypto.randomBytes(4).toString('hex');
  return `EXT_${userId}_${Date.now()}_${rand}`;
}

// customerKey 생성 (추측 어려운 값)
function generateCustomerKey(userId) {
  const rand = crypto.randomBytes(8).toString('hex');
  return `cus_${userId}_${rand}`;
}

// ACTIVE 구독 존재 여부 (최신 행이 PENDING이어도 ACTIVE가 있으면 구독중)
async function hasActiveSubscription(pool, userId) {
  const result = await pool.request()
    .input('user_id', sql.NVarChar, userId)
    .query(`
      SELECT TOP 1 1 AS ok
      FROM tb_subscription
      WHERE user_id = @user_id AND status = 'ACTIVE'
    `);
  return result.recordset.length > 0;
}

// 2주 연장 주문번호가 해당 유저 소유인지 검증
function isValidExtendOrderId(orderId, userId) {
  if (!orderId || !userId) return false;
  return String(orderId).startsWith(`EXT_${userId}_`);
}

// 2주 연장(일회성) 결제 성공: 결제 이력 저장 + tb_user.end_date 2주 연장
async function applyExtendPayment(pool, { userId, amount, orderId, payment }) {
  await pool.request()
    .input('user_id', sql.NVarChar, userId)
    .input('order_id', sql.NVarChar, orderId)
    .input('payment_key', sql.NVarChar, payment.paymentKey || null)
    .input('plan_type', sql.NVarChar, 'EXTEND')
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

  await pool.request()
    .input('user_id', sql.NVarChar, userId)
    .query(`
      UPDATE tb_user
      SET end_date = DATEADD(WEEK, 2,
        CASE
          WHEN end_date IS NULL OR end_date < CONVERT(DATE, GETDATE())
          THEN CONVERT(DATE, GETDATE())
          ELSE end_date
        END)
      WHERE user_id = @user_id
    `);
}

// 2주 연장 결제 실패 이력 저장 (완료 건이 없을 때만)
async function saveExtendPaymentFailure(pool, { userId, orderId, amount, error }) {
  const existing = await pool.request()
    .input('order_id', sql.NVarChar, orderId)
    .query(`
      SELECT TOP 1 status
      FROM tb_subscription_payment
      WHERE order_id = @order_id
    `);

  if (existing.recordset.length > 0) return;

  await pool.request()
    .input('user_id', sql.NVarChar, userId)
    .input('order_id', sql.NVarChar, orderId)
    .input('plan_type', sql.NVarChar, 'EXTEND')
    .input('amount', sql.Int, amount)
    .input('status', sql.NVarChar, 'FAILED')
    .input('raw_response', sql.NVarChar, JSON.stringify(error.tossResponse || { message: error.message }))
    .query(`
      INSERT INTO tb_subscription_payment (user_id, order_id, plan_type, amount, status, raw_response)
      VALUES (@user_id, @order_id, @plan_type, @amount, @status, @raw_response)
    `);
}

// 구독/빌링키 레코드 저장 (결제 성공 시)
async function upsertSubscriptionRecord(pool, { userId, customerKey, billingKey, planType, amount }) {
  const existing = await pool.request()
    .input('customer_key', sql.NVarChar, customerKey)
    .query(`SELECT TOP 1 seq FROM tb_subscription WHERE customer_key = @customer_key`);

  if (existing.recordset.length > 0) {
    await pool.request()
      .input('customer_key', sql.NVarChar, customerKey)
      .input('billing_key', sql.NVarChar, billingKey)
      .input('plan_type', sql.NVarChar, planType)
      .input('amount', sql.Int, amount)
      .query(`
        UPDATE tb_subscription
        SET billing_key = @billing_key,
            plan_type = @plan_type,
            amount = @amount,
            status = 'ACTIVE',
            next_pay_date = DATEADD(MONTH, 1, CONVERT(DATE, GETDATE())),
            updated_at = GETDATE()
        WHERE customer_key = @customer_key
      `);
    return;
  }

  await pool.request()
    .input('user_id', sql.NVarChar, userId)
    .input('customer_key', sql.NVarChar, customerKey)
    .input('billing_key', sql.NVarChar, billingKey)
    .input('plan_type', sql.NVarChar, planType)
    .input('amount', sql.Int, amount)
    .query(`
      INSERT INTO tb_subscription (user_id, customer_key, billing_key, plan_type, amount, status, next_pay_date)
      VALUES (@user_id, @customer_key, @billing_key, @plan_type, @amount, 'ACTIVE', DATEADD(MONTH, 1, CONVERT(DATE, GETDATE())))
    `);
}

// 구독 결제 실패 이력 저장 (완료 건이 없을 때만)
async function saveSubscriptionPaymentFailure(pool, { userId, orderId, planType, amount, error }) {
  const existing = await pool.request()
    .input('order_id', sql.NVarChar, orderId)
    .query(`
      SELECT TOP 1 status
      FROM tb_subscription_payment
      WHERE order_id = @order_id
    `);

  if (existing.recordset.length > 0) return;

  await pool.request()
    .input('user_id', sql.NVarChar, userId)
    .input('order_id', sql.NVarChar, orderId)
    .input('plan_type', sql.NVarChar, planType)
    .input('amount', sql.Int, amount)
    .input('status', sql.NVarChar, 'FAILED')
    .input('raw_response', sql.NVarChar, JSON.stringify(error.tossResponse || { message: error.message }))
    .query(`
      INSERT INTO tb_subscription_payment (user_id, order_id, plan_type, amount, status, raw_response)
      VALUES (@user_id, @order_id, @plan_type, @amount, @status, @raw_response)
    `);
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

  // 구독 상태/다음 결제일 업데이트 (기존 레코드 보강)
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

// 1) 결제 준비: customerKey 발급 (DB 저장 없음)
router.post('/prepare', async (req, res) => {
  try {
    const { userId, plan } = req.body;
    const planConfig = getPlanConfig(plan);

    if (!userId || !planConfig) {
      return res.status(400).json({ success: false, message: '필수 정보(userId, plan)가 올바르지 않습니다.' });
    }

    if (plan === 'EXTEND') {
      return res.status(400).json({ success: false, message: '2주 연장은 일회성 결제로 진행해주세요.' });
    }

    const pool = await getConnection();

    if (plan === 'BASIC' && await hasActiveSubscription(pool, userId)) {
      return res.status(400).json({ success: false, message: '이미 구독중입니다.' });
    }

    // 청구 금액(VAT 포함) 산정 - 기준정보관리의 구독료 기준
    const amount = await resolvePlanAmount(pool, plan);
    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: '구독료가 설정되어 있지 않습니다. 기준정보관리에서 구독료를 입력해주세요.' });
    }

    // 기존 customerKey 재사용(조회만), 없으면 신규 발급
    const existing = await pool.request()
      .input('user_id', sql.NVarChar, userId)
      .query(`SELECT TOP 1 customer_key FROM tb_subscription WHERE user_id = @user_id ORDER BY seq DESC`);

    const customerKey = (existing.recordset.length > 0 && existing.recordset[0].customer_key)
      ? existing.recordset[0].customer_key
      : generateCustomerKey(userId);

    res.json({ success: true, data: { customerKey, amount } });
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

    if (plan === 'EXTEND') {
      return res.status(400).json({ success: false, message: '2주 연장은 일회성 결제로 진행해주세요.' });
    }

    const pool = await getConnection();

    if (plan === 'BASIC' && await hasActiveSubscription(pool, userId)) {
      return res.status(400).json({ success: false, message: '이미 구독중입니다.' });
    }

    // 청구 금액(VAT 포함) 재산정 - 기준정보관리의 구독료 기준 (서버에서 강제)
    const amount = await resolvePlanAmount(pool, plan);
    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: '구독료가 설정되어 있지 않습니다. 기준정보관리에서 구독료를 입력해주세요.' });
    }

    const orderId = generateOrderId(userId);

    try {
      const billing = await issueBillingKey(authKey, customerKey);
      const billingKey = billing.billingKey;

      const payment = await requestBilling(billingKey, {
        customerKey,
        amount,
        orderId,
        orderName: planConfig.orderName
      });

      await upsertSubscriptionRecord(pool, {
        userId,
        customerKey,
        billingKey,
        planType: plan,
        amount
      });

      await applySuccessfulPayment(pool, {
        userId,
        planType: plan,
        amount,
        orderId,
        payment
      });

      res.json({ success: true, data: { orderId, status: payment.status } });
    } catch (error) {
      console.error('빌링키 발급/결제 오류:', error);

      try {
        await saveSubscriptionPaymentFailure(pool, {
          userId,
          orderId,
          planType: plan,
          amount,
          error
        });
      } catch (e) {
        console.error('구독 결제 실패 이력 저장 오류:', e);
      }

      res.status(500).json({ success: false, message: error.message || '구독 결제 처리 중 오류가 발생했습니다.' });
    }
  } catch (error) {
    console.error('빌링키 발급/결제 처리 오류:', error);
    res.status(500).json({ success: false, message: error.message || '구독 결제 처리 중 오류가 발생했습니다.' });
  }
});

// 2-1) 2주 연장 일회성 결제 준비
router.post('/extend/prepare', async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ success: false, message: 'userId가 필요합니다.' });
    }

    const amount = PLAN_META.EXTEND.amount;
    const orderId = generateExtendOrderId(userId);
    const orderName = PLAN_META.EXTEND.orderName;

    res.json({
      success: true,
      data: { orderId, amount, orderName }
    });
  } catch (error) {
    console.error('2주 연장 결제 준비 오류:', error);
    res.status(500).json({ success: false, message: '결제 준비 중 오류가 발생했습니다.' });
  }
});

// 2-2) 2주 연장 일회성 결제 승인
router.post('/extend/confirm', async (req, res) => {
  try {
    const { paymentKey, orderId, amount, userId } = req.body;

    if (!paymentKey || !orderId || !amount || !userId) {
      return res.status(400).json({ success: false, message: '결제 정보가 누락되었습니다.' });
    }

    const pool = await getConnection();

    if (!isValidExtendOrderId(orderId, userId)) {
      return res.status(400).json({ success: false, message: '유효하지 않은 주문입니다.' });
    }

    const existing = await pool.request()
      .input('order_id', sql.NVarChar, orderId)
      .query(`
        SELECT TOP 1 status
        FROM tb_subscription_payment
        WHERE order_id = @order_id
      `);

    if (existing.recordset.length > 0) {
      if (existing.recordset[0].status === 'DONE') {
        return res.json({ success: true, data: { orderId, status: 'DONE' } });
      }
      return res.status(400).json({ success: false, message: '이미 처리된 주문입니다.' });
    }

    if (Number(amount) !== PLAN_META.EXTEND.amount) {
      return res.status(400).json({ success: false, message: '결제 금액이 일치하지 않습니다.' });
    }

    const payment = await confirmPayment({ paymentKey, orderId, amount: PLAN_META.EXTEND.amount });

    await applyExtendPayment(pool, {
      userId,
      amount: PLAN_META.EXTEND.amount,
      orderId,
      payment
    });

    res.json({ success: true, data: { orderId, status: payment.status || 'DONE' } });
  } catch (error) {
    console.error('2주 연장 결제 승인 오류:', error);

    try {
      const { orderId, amount, userId } = req.body || {};
      if (orderId && userId && isValidExtendOrderId(orderId, userId)) {
        const failPool = await getConnection();
        await saveExtendPaymentFailure(failPool, {
          userId,
          orderId,
          amount: Number(amount) || PLAN_META.EXTEND.amount,
          error
        });
      }
    } catch (e) {
      console.error('2주 연장 결제 실패 이력 저장 오류:', e);
    }

    res.status(500).json({ success: false, message: error.message || '결제 승인 중 오류가 발생했습니다.' });
  }
});

// 3) 구독 상태 조회
router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const pool = await getConnection();
    const isActive = await hasActiveSubscription(pool, userId);

    // ACTIVE 구독 우선, 없으면 최신 레코드 반환
    const result = await pool.request()
      .input('user_id', sql.NVarChar, userId)
      .query(`
        SELECT TOP 1 user_id, plan_type, amount, status, next_pay_date,
               CASE WHEN billing_key IS NULL THEN 0 ELSE 1 END AS has_billing_key,
               created_at, updated_at
        FROM tb_subscription
        WHERE user_id = @user_id
        ORDER BY
          CASE WHEN status = 'ACTIVE' THEN 0 ELSE 1 END,
          seq DESC
      `);

    res.json({
      success: true,
      isActive,
      data: result.recordset[0] || null
    });
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
  const { user_id: userId, billing_key: billingKey, customer_key: customerKey, plan_type: planType, amount: storedAmount } = subscription;
  const orderName = (getPlanConfig(planType) || {}).orderName || 'C1B 구독';
  const orderId = generateOrderId(userId);

  // 정기결제 시점의 기준정보 구독료(VAT 포함)로 재산정. 미설정 시 저장된 금액 사용.
  const resolved = await resolvePlanAmount(pool, planType);
  const amount = resolved && resolved > 0 ? resolved : storedAmount;

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
