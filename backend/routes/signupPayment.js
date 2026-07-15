// C1B 가입 결제(일회성, 비로그인) API 라우트
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { getConnection, sql } = require('../config/database');
const { confirmPayment, toKoreaDateTimeString } = require('../services/tossPayments');

// 가입 결제 금액(VAT 포함) - 서버에서 강제
const SIGNUP_AMOUNT = 6600000;
const ORDER_NAME = 'C1B 가입 결제';

function generateOrderId() {
  const rand = crypto.randomBytes(5).toString('hex');
  return `JOIN_${Date.now()}_${rand}`;
}

function isValidSignupOrderId(orderId) {
  return /^JOIN_\d+_[a-f0-9]+$/.test(String(orderId || ''));
}

async function saveSignupPaymentSuccess(pool, { name, phone, orderId, payment }) {
  await pool.request()
    .input('joiner_name', sql.NVarChar, String(name).trim())
    .input('joiner_phone', sql.NVarChar, String(phone).trim())
    .input('order_id', sql.NVarChar, orderId)
    .input('order_name', sql.NVarChar, ORDER_NAME)
    .input('payment_key', sql.NVarChar, payment.paymentKey || null)
    .input('amount', sql.Int, SIGNUP_AMOUNT)
    .input('status', sql.NVarChar, payment.status || 'DONE')
    .input('paid_at', sql.NVarChar, toKoreaDateTimeString(payment.approvedAt))
    .input('raw_response', sql.NVarChar, JSON.stringify(payment))
    .query(`
      INSERT INTO tb_signup_payment
        (joiner_name, joiner_phone, order_id, order_name, payment_key, amount, status, paid_at, raw_response)
      VALUES
        (@joiner_name, @joiner_phone, @order_id, @order_name, @payment_key, @amount, @status, CONVERT(DATETIME, @paid_at, 120), @raw_response)
    `);
}

async function saveSignupPaymentFailure(pool, { name, phone, orderId, error }) {
  const existing = await pool.request()
    .input('order_id', sql.NVarChar, orderId)
    .query(`SELECT TOP 1 status FROM tb_signup_payment WHERE order_id = @order_id`);

  if (existing.recordset.length > 0) return;

  await pool.request()
    .input('joiner_name', sql.NVarChar, String(name).trim())
    .input('joiner_phone', sql.NVarChar, String(phone).trim())
    .input('order_id', sql.NVarChar, orderId)
    .input('order_name', sql.NVarChar, ORDER_NAME)
    .input('amount', sql.Int, SIGNUP_AMOUNT)
    .input('status', sql.NVarChar, 'FAILED')
    .input('raw_response', sql.NVarChar, JSON.stringify(error.tossResponse || { message: error.message }))
    .query(`
      INSERT INTO tb_signup_payment
        (joiner_name, joiner_phone, order_id, order_name, amount, status, raw_response)
      VALUES
        (@joiner_name, @joiner_phone, @order_id, @order_name, @amount, @status, @raw_response)
    `);
}

// 1) 결제 준비: orderId 발급 (DB 저장 없음)
router.post('/prepare', async (req, res) => {
  try {
    const { name, phone } = req.body;

    if (!name || !String(name).trim() || !phone || !String(phone).trim()) {
      return res.status(400).json({ success: false, message: '가입자명과 연락처를 입력해주세요.' });
    }

    const orderId = generateOrderId();

    res.json({
      success: true,
      data: {
        orderId,
        amount: SIGNUP_AMOUNT,
        orderName: ORDER_NAME,
        customerName: String(name).trim()
      }
    });
  } catch (error) {
    console.error('가입 결제 준비 오류:', error);
    res.status(500).json({ success: false, message: '결제 준비 중 오류가 발생했습니다.' });
  }
});

// 2) 결제 승인: 토스 결제 승인 후 저장
router.post('/confirm', async (req, res) => {
  try {
    const { paymentKey, orderId, amount, name, phone } = req.body;

    if (!paymentKey || !orderId || !amount || !name || !phone) {
      return res.status(400).json({ success: false, message: '결제 정보가 누락되었습니다.' });
    }

    if (!isValidSignupOrderId(orderId)) {
      return res.status(400).json({ success: false, message: '유효하지 않은 주문입니다.' });
    }

    const pool = await getConnection();

    const orderResult = await pool.request()
      .input('order_id', sql.NVarChar, orderId)
      .query(`SELECT TOP 1 status FROM tb_signup_payment WHERE order_id = @order_id`);

    if (orderResult.recordset.length > 0) {
      if (orderResult.recordset[0].status === 'DONE') {
        return res.json({ success: true, data: { orderId, status: 'DONE' } });
      }
      return res.status(400).json({ success: false, message: '이미 처리된 주문입니다.' });
    }

    if (Number(amount) !== SIGNUP_AMOUNT) {
      return res.status(400).json({ success: false, message: '결제 금액이 일치하지 않습니다.' });
    }

    const payment = await confirmPayment({ paymentKey, orderId, amount: SIGNUP_AMOUNT });

    await saveSignupPaymentSuccess(pool, {
      name,
      phone,
      orderId,
      payment
    });

    res.json({ success: true, data: { orderId, status: payment.status || 'DONE' } });
  } catch (error) {
    console.error('가입 결제 승인 오류:', error);

    try {
      const { orderId, amount, name, phone } = req.body || {};
      if (orderId && name && phone && isValidSignupOrderId(orderId) && Number(amount) === SIGNUP_AMOUNT) {
        const failPool = await getConnection();
        await saveSignupPaymentFailure(failPool, { name, phone, orderId, error });
      }
    } catch (e) {
      console.error('가입 결제 실패 이력 저장 오류:', e);
    }

    res.status(500).json({ success: false, message: error.message || '결제 승인 중 오류가 발생했습니다.' });
  }
});

module.exports = router;
