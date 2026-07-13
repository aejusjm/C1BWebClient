// 가입신청내역(관리자) - tb_signup_payment 리스트 / 결제취소(환불) API
const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { getConnection, sql } = require('../config/database');
const { cancelPayment } = require('../services/tossPayments');

let refundColumnsReady = false;

// 환불 컬럼이 없으면 추가 (idempotent)
async function ensureRefundColumns(pool) {
  if (refundColumnsReady) return;
  await pool.request().query(`
    IF COL_LENGTH('tb_signup_payment', 'refund_amount') IS NULL
      ALTER TABLE tb_signup_payment ADD refund_amount INT NOT NULL DEFAULT 0;
    IF COL_LENGTH('tb_signup_payment', 'refund_reason') IS NULL
      ALTER TABLE tb_signup_payment ADD refund_reason NVARCHAR(500) NULL;
    IF COL_LENGTH('tb_signup_payment', 'refunded_at') IS NULL
      ALTER TABLE tb_signup_payment ADD refunded_at DATETIME NULL;
  `);
  refundColumnsReady = true;
}

// 가입 결제 목록 조회 (검색: 가입자명/연락처, 결제일자 범위)
router.get('/', async (req, res) => {
  try {
    const { keyword, startDate, endDate } = req.query;
    const pool = await getConnection();
    await ensureRefundColumns(pool);

    const request = pool.request();
    let whereClause = 'WHERE 1 = 1';

    if (keyword && keyword.trim()) {
      request.input('keyword', sql.NVarChar, `%${keyword.trim()}%`);
      whereClause += ' AND (p.joiner_name LIKE @keyword OR p.joiner_phone LIKE @keyword OR p.order_id LIKE @keyword)';
    }

    if (startDate && startDate.trim()) {
      request.input('startDate', sql.Date, startDate.trim());
      whereClause += ' AND p.paid_at >= @startDate';
    }
    if (endDate && endDate.trim()) {
      request.input('endDate', sql.Date, endDate.trim());
      whereClause += ' AND p.paid_at < DATEADD(DAY, 1, @endDate)';
    }

    const query = `
      SELECT
        p.seq,
        p.joiner_name,
        p.joiner_phone,
        p.order_id,
        p.order_name,
        p.payment_key,
        p.amount,
        p.status,
        p.paid_at,
        p.created_at,
        p.refund_amount,
        p.refund_reason,
        p.refunded_at
      FROM tb_signup_payment p
      ${whereClause}
      ORDER BY COALESCE(p.paid_at, p.created_at) DESC, p.seq DESC
    `;

    const result = await request.query(query);
    res.json({ success: true, data: result.recordset });
  } catch (error) {
    console.error('가입신청내역 목록 조회 오류:', error);
    res.status(500).json({ success: false, message: '가입신청내역 목록 조회 중 오류가 발생했습니다.' });
  }
});

// 결제취소(부분/전액 환불) - Toss 결제 취소 연동
router.post('/:seq/refund', async (req, res) => {
  try {
    const { seq } = req.params;
    const { cancelAmount, cancelReason } = req.body;

    const reason = (cancelReason && cancelReason.trim()) || '가입결제 취소';
    const amountToCancel = parseInt(cancelAmount, 10);

    if (!amountToCancel || amountToCancel <= 0) {
      return res.status(400).json({ success: false, message: '환불 금액이 올바르지 않습니다.' });
    }

    const pool = await getConnection();
    await ensureRefundColumns(pool);

    const paymentResult = await pool.request()
      .input('seq', sql.Int, seq)
      .query(`
        SELECT seq, payment_key, amount, refund_amount, status
        FROM tb_signup_payment
        WHERE seq = @seq
      `);

    if (paymentResult.recordset.length === 0) {
      return res.status(404).json({ success: false, message: '결제 내역을 찾을 수 없습니다.' });
    }

    const payment = paymentResult.recordset[0];

    if (!payment.payment_key) {
      return res.status(400).json({ success: false, message: '결제키가 없어 취소할 수 없습니다.(미결제/실패 건)' });
    }
    if (payment.status === 'FAILED' || payment.status === 'READY') {
      return res.status(400).json({ success: false, message: '취소할 수 없는 결제 상태입니다.' });
    }
    if (payment.status === 'CANCELED') {
      return res.status(400).json({ success: false, message: '이미 전액 취소된 결제입니다.' });
    }

    const alreadyRefunded = payment.refund_amount || 0;
    const remaining = payment.amount - alreadyRefunded;

    if (amountToCancel > remaining) {
      return res.status(400).json({
        success: false,
        message: `취소 가능 금액(${remaining.toLocaleString()}원)을 초과했습니다.`
      });
    }

    const idempotencyKey = crypto.randomUUID
      ? crypto.randomUUID()
      : crypto.randomBytes(16).toString('hex');

    const tossResult = await cancelPayment(
      payment.payment_key,
      { cancelReason: reason, cancelAmount: amountToCancel },
      idempotencyKey
    );

    const newRefundTotal = alreadyRefunded + amountToCancel;
    const newStatus = tossResult.status
      || (newRefundTotal >= payment.amount ? 'CANCELED' : 'PARTIAL_CANCELED');

    await pool.request()
      .input('seq', sql.Int, seq)
      .input('refund_amount', sql.Int, newRefundTotal)
      .input('refund_reason', sql.NVarChar, reason)
      .input('status', sql.NVarChar, newStatus)
      .input('raw_response', sql.NVarChar, JSON.stringify(tossResult))
      .query(`
        UPDATE tb_signup_payment
        SET refund_amount = @refund_amount,
            refund_reason = @refund_reason,
            refunded_at = GETDATE(),
            status = @status,
            raw_response = @raw_response
        WHERE seq = @seq
      `);

    res.json({
      success: true,
      message: '결제 취소가 완료되었습니다.',
      data: {
        refundAmount: amountToCancel,
        totalRefunded: newRefundTotal,
        status: newStatus
      }
    });
  } catch (error) {
    console.error('가입결제 취소 오류:', error);
    res.status(500).json({
      success: false,
      message: error.message || '결제 취소 중 오류가 발생했습니다.'
    });
  }
});

module.exports = router;
