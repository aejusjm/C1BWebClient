// 관리자 직접 결제 API
const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { getConnection, sql } = require('../config/database');
const { issueBillingKey, requestBilling, confirmPayment, toKoreaDateTimeString, extractCardInfo } = require('../services/tossPayments');

function generateCustomerKey(userId) {
  const rand = crypto.randomBytes(8).toString('hex');
  return `cus_${userId}_${rand}`;
}

function generateSubOrderId(userId) {
  const rand = crypto.randomBytes(4).toString('hex');
  return `ADM_SUB_${userId}_${Date.now()}_${rand}`;
}

function generateOnceOrderId(userId) {
  const rand = crypto.randomBytes(4).toString('hex');
  return `ADM_ONCE_${userId}_${Date.now()}_${rand}`;
}

function isValidOnceOrderId(orderId, userId) {
  return String(orderId || '').startsWith(`ADM_ONCE_${userId}_`);
}

let planTypeColumnsReady = false;

// 결제명 저장을 위해 plan_type 컬럼 길이 확보
async function ensurePlanTypeWidth(pool) {
  if (planTypeColumnsReady) return;
  await pool.request().query(`
    IF COL_LENGTH('tb_subscription_payment', 'plan_type') IS NOT NULL
      ALTER TABLE tb_subscription_payment ALTER COLUMN plan_type NVARCHAR(200) NULL;
    IF COL_LENGTH('tb_subscription', 'plan_type') IS NOT NULL
      ALTER TABLE tb_subscription ALTER COLUMN plan_type NVARCHAR(200) NOT NULL;
  `);
  planTypeColumnsReady = true;
}

async function extendUserEndDate(pool, userId) {
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
}

async function upsertSubscriptionRecord(pool, { userId, customerKey, billingKey, amount, planType, cardName, cardNumber }) {
  const existing = await pool.request()
    .input('customer_key', sql.NVarChar, customerKey)
    .query(`SELECT TOP 1 seq FROM tb_subscription WHERE customer_key = @customer_key`);

  if (existing.recordset.length > 0) {
    await pool.request()
      .input('customer_key', sql.NVarChar, customerKey)
      .input('billing_key', sql.NVarChar, billingKey)
      .input('plan_type', sql.NVarChar, planType)
      .input('amount', sql.Int, amount)
      .input('card_name', sql.NVarChar, cardName || null)
      .input('card_number', sql.NVarChar, cardNumber || null)
      .query(`
        UPDATE tb_subscription
        SET billing_key = @billing_key,
            plan_type = @plan_type,
            amount = @amount,
            status = 'ACTIVE',
            next_pay_date = DATEADD(MONTH, 1, CONVERT(DATE, GETDATE())),
            card_name = COALESCE(@card_name, card_name),
            card_number = COALESCE(@card_number, card_number),
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
    .input('card_name', sql.NVarChar, cardName || null)
    .input('card_number', sql.NVarChar, cardNumber || null)
    .query(`
      INSERT INTO tb_subscription (user_id, customer_key, billing_key, plan_type, amount, status, next_pay_date, card_name, card_number)
      VALUES (@user_id, @customer_key, @billing_key, @plan_type, @amount, 'ACTIVE', DATEADD(MONTH, 1, CONVERT(DATE, GETDATE())), @card_name, @card_number)
    `);
}

async function insertPayment(pool, { userId, orderId, paymentKey, planType, amount, status, paidAt, rawResponse, cardName, cardNumber }) {
  await pool.request()
    .input('user_id', sql.NVarChar, userId)
    .input('order_id', sql.NVarChar, orderId)
    .input('payment_key', sql.NVarChar, paymentKey || null)
    .input('plan_type', sql.NVarChar, planType)
    .input('amount', sql.Int, amount)
    .input('status', sql.NVarChar, status || 'DONE')
    .input('paid_at', sql.NVarChar, toKoreaDateTimeString(paidAt))
    .input('card_name', sql.NVarChar, cardName || null)
    .input('card_number', sql.NVarChar, cardNumber || null)
    .input('raw_response', sql.NVarChar, rawResponse || null)
    .query(`
      INSERT INTO tb_subscription_payment
        (user_id, order_id, payment_key, plan_type, amount, status, paid_at, card_name, card_number, raw_response)
      VALUES
        (@user_id, @order_id, @payment_key, @plan_type, @amount, @status, CONVERT(DATETIME, @paid_at, 120), @card_name, @card_number, @raw_response)
    `);
}

async function insertFailedPayment(pool, { userId, orderId, planType, amount, error }) {
  const existing = await pool.request()
    .input('order_id', sql.NVarChar, orderId)
    .query(`SELECT TOP 1 1 AS ok FROM tb_subscription_payment WHERE order_id = @order_id`);
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

// 사용자 콤보용 목록
router.get('/users', async (req, res) => {
  try {
    const pool = await getConnection();
    const result = await pool.request().query(`
      SELECT user_id, user_name
      FROM tb_user
      WHERE ISNULL(user_type, '') <> N'관리자'
      ORDER BY user_name, user_id
    `);
    res.json({ success: true, data: result.recordset });
  } catch (error) {
    console.error('관리자 직접결제 사용자 목록 오류:', error);
    res.status(500).json({ success: false, message: '사용자 목록 조회 중 오류가 발생했습니다.' });
  }
});

// 결제 준비
router.post('/prepare', async (req, res) => {
  try {
    const { userId, orderName, payType, amount } = req.body;
    const payAmount = parseInt(amount, 10);
    const name = String(orderName || '').trim();
    const type = String(payType || '').toUpperCase();

    if (!userId || !name || !payAmount || payAmount <= 0) {
      return res.status(400).json({ success: false, message: '사용자, 결제명, 결제금액을 올바르게 입력해주세요.' });
    }
    if (type !== 'SUBSCRIPTION' && type !== 'GENERAL') {
      return res.status(400).json({ success: false, message: '결제구분이 올바르지 않습니다.' });
    }

    const pool = await getConnection();
    const userResult = await pool.request()
      .input('user_id', sql.NVarChar, userId)
      .query(`SELECT TOP 1 user_id, user_name FROM tb_user WHERE user_id = @user_id`);

    if (userResult.recordset.length === 0) {
      return res.status(404).json({ success: false, message: '사용자를 찾을 수 없습니다.' });
    }

    const user = userResult.recordset[0];

    if (type === 'SUBSCRIPTION') {
      const existing = await pool.request()
        .input('user_id', sql.NVarChar, userId)
        .query(`SELECT TOP 1 customer_key FROM tb_subscription WHERE user_id = @user_id ORDER BY seq DESC`);

      const customerKey = (existing.recordset.length > 0 && existing.recordset[0].customer_key)
        ? existing.recordset[0].customer_key
        : generateCustomerKey(userId);

      return res.json({
        success: true,
        data: {
          payType: 'SUBSCRIPTION',
          userId,
          customerKey,
          amount: payAmount,
          orderName: name,
          customerName: user.user_name || userId
        }
      });
    }

    // GENERAL
    const orderId = generateOnceOrderId(userId);
    return res.json({
      success: true,
      data: {
        payType: 'GENERAL',
        userId,
        orderId,
        amount: payAmount,
        orderName: name,
        customerName: user.user_name || userId
      }
    });
  } catch (error) {
    console.error('관리자 직접결제 준비 오류:', error);
    res.status(500).json({ success: false, message: '결제 준비 중 오류가 발생했습니다.' });
  }
});

// 구독(빌링) 결제 승인
router.post('/confirm-subscription', async (req, res) => {
  try {
    const { authKey, customerKey, userId, amount, orderName } = req.body;
    const payAmount = parseInt(amount, 10);
    const name = String(orderName || '').trim();

    if (!authKey || !customerKey || !userId || !payAmount || payAmount <= 0 || !name) {
      return res.status(400).json({ success: false, message: '필수 정보가 누락되었습니다.' });
    }

    const pool = await getConnection();
    await ensurePlanTypeWidth(pool);
    const orderId = generateSubOrderId(userId);

    try {
      const billing = await issueBillingKey(authKey, customerKey);
      const billingKey = billing.billingKey;
      const billingCard = extractCardInfo(billing);

      const payment = await requestBilling(billingKey, {
        customerKey,
        amount: payAmount,
        orderId,
        orderName: name
      });
      const paymentCard = extractCardInfo(payment);

      await upsertSubscriptionRecord(pool, {
        userId,
        customerKey,
        billingKey,
        amount: payAmount,
        planType: name,
        cardName: billingCard.cardName || paymentCard.cardName,
        cardNumber: billingCard.cardNumber || paymentCard.cardNumber
      });

      await insertPayment(pool, {
        userId,
        orderId,
        paymentKey: payment.paymentKey || null,
        planType: name,
        amount: payAmount,
        status: payment.status || 'DONE',
        paidAt: payment.approvedAt ? new Date(payment.approvedAt) : new Date(),
        rawResponse: JSON.stringify(payment),
        cardName: paymentCard.cardName || billingCard.cardName,
        cardNumber: paymentCard.cardNumber || billingCard.cardNumber
      });

      await extendUserEndDate(pool, userId);

      res.json({ success: true, data: { orderId, status: payment.status || 'DONE' } });
    } catch (error) {
      try {
        await insertFailedPayment(pool, {
          userId,
          orderId,
          planType: name,
          amount: payAmount,
          error
        });
      } catch (e) {
        console.error('관리자 구독결제 실패 이력 저장 오류:', e);
      }
      throw error;
    }
  } catch (error) {
    console.error('관리자 구독결제 승인 오류:', error);
    res.status(500).json({ success: false, message: error.message || '구독 결제 처리 중 오류가 발생했습니다.' });
  }
});

// 일반(일회성) 결제 승인
router.post('/confirm-general', async (req, res) => {
  try {
    const { paymentKey, orderId, amount, userId, orderName } = req.body;
    const payAmount = parseInt(amount, 10);
    const name = String(orderName || '').trim();

    if (!paymentKey || !orderId || !userId || !payAmount || payAmount <= 0 || !name) {
      return res.status(400).json({ success: false, message: '필수 정보가 누락되었습니다.' });
    }
    if (!isValidOnceOrderId(orderId, userId)) {
      return res.status(400).json({ success: false, message: '유효하지 않은 주문입니다.' });
    }

    const pool = await getConnection();
    await ensurePlanTypeWidth(pool);

    const existing = await pool.request()
      .input('order_id', sql.NVarChar, orderId)
      .query(`SELECT TOP 1 status FROM tb_subscription_payment WHERE order_id = @order_id`);

    if (existing.recordset.length > 0) {
      if (existing.recordset[0].status === 'DONE') {
        return res.json({ success: true, data: { orderId, status: 'DONE' } });
      }
      return res.status(400).json({ success: false, message: '이미 처리된 주문입니다.' });
    }

    try {
      const payment = await confirmPayment({ paymentKey, orderId, amount: payAmount });
      const paymentCard = extractCardInfo(payment);

      await insertPayment(pool, {
        userId,
        orderId,
        paymentKey: payment.paymentKey || paymentKey,
        planType: name,
        amount: payAmount,
        status: payment.status || 'DONE',
        paidAt: payment.approvedAt ? new Date(payment.approvedAt) : new Date(),
        rawResponse: JSON.stringify({ ...payment, orderName: name }),
        cardName: paymentCard.cardName,
        cardNumber: paymentCard.cardNumber
      });

      res.json({ success: true, data: { orderId, status: payment.status || 'DONE' } });
    } catch (error) {
      try {
        await insertFailedPayment(pool, {
          userId,
          orderId,
          planType: name,
          amount: payAmount,
          error
        });
      } catch (e) {
        console.error('관리자 일반결제 실패 이력 저장 오류:', e);
      }
      throw error;
    }
  } catch (error) {
    console.error('관리자 일반결제 승인 오류:', error);
    res.status(500).json({ success: false, message: error.message || '일반 결제 처리 중 오류가 발생했습니다.' });
  }
});

module.exports = router;
