// C1B 가입 결제(일회성, 비로그인) API 라우트
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { getConnection, sql } = require('../config/database');
const { confirmPayment } = require('../services/tossPayments');

// 가입 결제 금액(VAT 포함) - 서버에서 강제
const SIGNUP_AMOUNT = 6600000;
const ORDER_NAME = 'C1B 가입 결제';

function generateOrderId() {
  const rand = crypto.randomBytes(5).toString('hex');
  return `JOIN_${Date.now()}_${rand}`;
}

// 1) 결제 준비: 가입자 정보 저장 + orderId 발급
router.post('/prepare', async (req, res) => {
  try {
    const { name, phone } = req.body;

    if (!name || !String(name).trim() || !phone || !String(phone).trim()) {
      return res.status(400).json({ success: false, message: '가입자명과 연락처를 입력해주세요.' });
    }

    const pool = await getConnection();
    const orderId = generateOrderId();

    await pool.request()
      .input('joiner_name', sql.NVarChar, String(name).trim())
      .input('joiner_phone', sql.NVarChar, String(phone).trim())
      .input('order_id', sql.NVarChar, orderId)
      .input('order_name', sql.NVarChar, ORDER_NAME)
      .input('amount', sql.Int, SIGNUP_AMOUNT)
      .query(`
        INSERT INTO tb_signup_payment (joiner_name, joiner_phone, order_id, order_name, amount, status)
        VALUES (@joiner_name, @joiner_phone, @order_id, @order_name, @amount, 'READY')
      `);

    res.json({
      success: true,
      data: { orderId, amount: SIGNUP_AMOUNT, orderName: ORDER_NAME, customerName: String(name).trim() }
    });
  } catch (error) {
    console.error('가입 결제 준비 오류:', error);
    res.status(500).json({ success: false, message: '결제 준비 중 오류가 발생했습니다.' });
  }
});

// 2) 결제 승인: 토스 결제 승인 후 저장
router.post('/confirm', async (req, res) => {
  try {
    const { paymentKey, orderId, amount } = req.body;

    if (!paymentKey || !orderId || !amount) {
      return res.status(400).json({ success: false, message: '결제 정보가 누락되었습니다.' });
    }

    const pool = await getConnection();

    // 주문 조회
    const orderResult = await pool.request()
      .input('order_id', sql.NVarChar, orderId)
      .query(`SELECT TOP 1 seq, amount, status FROM tb_signup_payment WHERE order_id = @order_id`);

    if (orderResult.recordset.length === 0) {
      return res.status(404).json({ success: false, message: '주문 정보를 찾을 수 없습니다.' });
    }

    const order = orderResult.recordset[0];

    // 이미 완료된 주문이면 멱등 처리
    if (order.status === 'DONE') {
      return res.json({ success: true, data: { orderId, status: 'DONE' } });
    }

    // 금액 검증 (서버 저장 금액과 일치해야 함)
    if (Number(amount) !== order.amount) {
      return res.status(400).json({ success: false, message: '결제 금액이 일치하지 않습니다.' });
    }

    // 토스 결제 승인
    const payment = await confirmPayment({ paymentKey, orderId, amount: order.amount });

    await pool.request()
      .input('order_id', sql.NVarChar, orderId)
      .input('payment_key', sql.NVarChar, payment.paymentKey || paymentKey)
      .input('status', sql.NVarChar, payment.status || 'DONE')
      .input('paid_at', sql.DateTime, payment.approvedAt ? new Date(payment.approvedAt) : new Date())
      .input('raw_response', sql.NVarChar, JSON.stringify(payment))
      .query(`
        UPDATE tb_signup_payment
        SET payment_key = @payment_key,
            status = @status,
            paid_at = @paid_at,
            raw_response = @raw_response
        WHERE order_id = @order_id
      `);

    res.json({ success: true, data: { orderId, status: payment.status || 'DONE' } });
  } catch (error) {
    console.error('가입 결제 승인 오류:', error);

    // 승인 실패 시 상태 갱신 (best-effort)
    try {
      if (req.body && req.body.orderId) {
        const pool = await getConnection();
        await pool.request()
          .input('order_id', sql.NVarChar, req.body.orderId)
          .input('raw_response', sql.NVarChar, JSON.stringify(error.tossResponse || { message: error.message }))
          .query(`
            UPDATE tb_signup_payment
            SET status = 'FAILED', raw_response = @raw_response
            WHERE order_id = @order_id AND status <> 'DONE'
          `);
      }
    } catch (e) {
      console.error('가입 결제 실패 상태 갱신 오류:', e);
    }

    res.status(500).json({ success: false, message: error.message || '결제 승인 중 오류가 발생했습니다.' });
  }
});

module.exports = router;
