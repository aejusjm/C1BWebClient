// 구독관리(관리자) - 사용자 구독결제 리스트 조회 API
const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { getConnection, sql } = require('../config/database');
const { cancelPayment } = require('../services/tossPayments');

// 구독결제 목록 조회 (검색: 사용자, 결제일자 범위)
router.get('/', async (req, res) => {
  try {
    const { userKeyword, startDate, endDate, cohortSeq } = req.query;
    const pool = await getConnection();

    const request = pool.request();
    let whereClause = 'WHERE 1 = 1';

    if (userKeyword && userKeyword.trim()) {
      request.input('userKeyword', sql.NVarChar, `%${userKeyword.trim()}%`);
      whereClause += ' AND (u.user_name LIKE @userKeyword OR p.user_id LIKE @userKeyword)';
    }

    // 결제일자(paid_at) 범위 검색
    if (startDate && startDate.trim()) {
      request.input('startDate', sql.Date, startDate.trim());
      whereClause += ' AND p.paid_at >= @startDate';
    }
    if (endDate && endDate.trim()) {
      request.input('endDate', sql.Date, endDate.trim());
      // 종료일 포함 (다음날 0시 미만)
      whereClause += ' AND p.paid_at < DATEADD(DAY, 1, @endDate)';
    }
    if (cohortSeq !== undefined && cohortSeq !== null && String(cohortSeq).trim() !== '') {
      const parsedCohortSeq = parseInt(String(cohortSeq), 10);
      if (Number.isFinite(parsedCohortSeq)) {
        request.input('cohortSeq', sql.Int, parsedCohortSeq);
        whereClause += ' AND u.cohort_seq = @cohortSeq';
      }
    }

    const query = `
      SELECT
        p.seq,
        p.user_id,
        u.user_name,
        p.plan_type,
        p.amount,
        p.status,
        p.order_id,
        p.payment_key,
        p.paid_at,
        p.created_at,
        p.refund_amount,
        p.refund_reason,
        p.refunded_at,
        s.next_pay_date,
        s.status AS sub_status,
        u.end_date
      FROM tb_subscription_payment p
      LEFT JOIN tb_user u ON p.user_id = u.user_id
      OUTER APPLY (
        SELECT TOP 1 next_pay_date, status
        FROM tb_subscription sub
        WHERE sub.user_id = p.user_id
        ORDER BY sub.seq DESC
      ) s
      ${whereClause}
      ORDER BY COALESCE(p.paid_at, p.created_at) DESC, p.seq DESC
    `;

    const result = await request.query(query);
    res.json({ success: true, data: result.recordset });
  } catch (error) {
    console.error('구독결제 목록 조회 오류:', error);
    res.status(500).json({ success: false, message: '구독결제 목록 조회 중 오류가 발생했습니다.' });
  }
});

// 환불(부분/전액) 처리 - Toss 결제 취소 연동
router.post('/:seq/refund', async (req, res) => {
  try {
    const { seq } = req.params;
    const { cancelAmount, cancelReason } = req.body;

    const reason = (cancelReason && cancelReason.trim()) || '구독 환불';
    const amountToCancel = parseInt(cancelAmount, 10);

    if (!amountToCancel || amountToCancel <= 0) {
      return res.status(400).json({ success: false, message: '환불 금액이 올바르지 않습니다.' });
    }

    const pool = await getConnection();

    // 결제 건 조회
    const paymentResult = await pool.request()
      .input('seq', sql.Int, seq)
      .query(`
        SELECT seq, payment_key, amount, refund_amount, status
        FROM tb_subscription_payment
        WHERE seq = @seq
      `);

    if (paymentResult.recordset.length === 0) {
      return res.status(404).json({ success: false, message: '결제 내역을 찾을 수 없습니다.' });
    }

    const payment = paymentResult.recordset[0];

    if (!payment.payment_key) {
      return res.status(400).json({ success: false, message: '결제키가 없어 환불할 수 없습니다.(미결제/실패 건)' });
    }
    if (payment.status === 'FAILED') {
      return res.status(400).json({ success: false, message: '실패한 결제는 환불할 수 없습니다.' });
    }
    if (payment.status === 'CANCELED') {
      return res.status(400).json({ success: false, message: '이미 전액 환불된 결제입니다.' });
    }

    const alreadyRefunded = payment.refund_amount || 0;
    const remaining = payment.amount - alreadyRefunded;

    if (amountToCancel > remaining) {
      return res.status(400).json({
        success: false,
        message: `환불 가능 금액(${remaining.toLocaleString()}원)을 초과했습니다.`
      });
    }

    // Toss 결제 취소 호출 (멱등키로 중복 환불 방지)
    const idempotencyKey = crypto.randomUUID
      ? crypto.randomUUID()
      : crypto.randomBytes(16).toString('hex');

    const tossResult = await cancelPayment(
      payment.payment_key,
      { cancelReason: reason, cancelAmount: amountToCancel },
      idempotencyKey
    );

    // 환불 누계/상태 갱신
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
        UPDATE tb_subscription_payment
        SET refund_amount = @refund_amount,
            refund_reason = @refund_reason,
            refunded_at = GETDATE(),
            status = @status,
            raw_response = @raw_response
        WHERE seq = @seq
      `);

    res.json({
      success: true,
      data: {
        seq: Number(seq),
        refundAmount: amountToCancel,
        totalRefunded: newRefundTotal,
        status: newStatus
      }
    });
  } catch (error) {
    console.error('환불 처리 오류:', error);
    res.status(500).json({ success: false, message: error.message || '환불 처리 중 오류가 발생했습니다.' });
  }
});

module.exports = router;
