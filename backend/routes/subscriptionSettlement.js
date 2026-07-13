// 구독료 정산 API
const express = require('express');
const router = express.Router();
const { getConnection, sql } = require('../config/database');

const SELLER_CD_LEN_FILTER = 'AND LEN(A.seller_cd) BETWEEN 7 AND 11';

/** 사용자별 매출과 동일 — 테스트계정 제외 */
const EXCLUDED_TEST_USER_IDS = ['user1', 'user2', 'user3', 'ybin583', 'admin', 'payuser'];
const EXCLUDED_TEST_USER_SQL = EXCLUDED_TEST_USER_IDS.map((id) => `N'${id}'`).join(', ');

let tableReady = false;

async function ensureSettlementTable(pool) {
  if (tableReady) return;
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name = 'tb_subscription_settlement' AND xtype = 'U')
    BEGIN
      CREATE TABLE tb_subscription_settlement (
        seq               INT IDENTITY(1,1) PRIMARY KEY,
        cohort_seq        INT           NULL,
        settle_year       INT           NOT NULL,
        settle_month      INT           NOT NULL,
        period_start      DATE          NOT NULL,
        period_end        DATE          NOT NULL,
        user_id           NVARCHAR(50)  NOT NULL,
        user_name         NVARCHAR(100) NULL,
        total_sales       BIGINT        NOT NULL DEFAULT 0,
        subscription_fee  INT           NOT NULL DEFAULT 0,
        base_sub_fee      INT           NOT NULL DEFAULT 0,
        refund_amount     INT           NOT NULL DEFAULT 0,
        created_at        DATETIME      DEFAULT GETDATE()
      );

      CREATE INDEX IX_tb_subscription_settlement_ym
        ON tb_subscription_settlement (settle_year, settle_month);

      CREATE INDEX IX_tb_subscription_settlement_period
        ON tb_subscription_settlement (settle_year, settle_month, period_start, period_end);

      CREATE INDEX IX_tb_subscription_settlement_cohort
        ON tb_subscription_settlement (cohort_seq);

      CREATE UNIQUE INDEX UX_tb_subscription_settlement_user_period
        ON tb_subscription_settlement (settle_year, settle_month, period_start, period_end, user_id, cohort_seq);
    END

    IF COL_LENGTH('tb_subscription_settlement', 'cohort_seq') IS NULL
      ALTER TABLE tb_subscription_settlement ADD cohort_seq INT NULL;
  `);
  tableReady = true;
}

function parseSettleParams(body) {
  const cohortSeq = parseInt(body.cohortSeq, 10);
  const settleYear = parseInt(body.settleYear, 10);
  const settleMonth = parseInt(body.settleMonth, 10);
  const periodStart = String(body.periodStart || '').trim();
  const periodEnd = String(body.periodEnd || '').trim();

  if (!cohortSeq) {
    return { error: '기수를 선택해주세요.' };
  }
  if (!settleYear || settleYear < 2000 || settleYear > 2100) {
    return { error: '정산년을 올바르게 선택해주세요.' };
  }
  if (!settleMonth || settleMonth < 1 || settleMonth > 12) {
    return { error: '정산월을 올바르게 선택해주세요.' };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(periodStart) || !/^\d{4}-\d{2}-\d{2}$/.test(periodEnd)) {
    return { error: '정산기간을 올바르게 선택해주세요.' };
  }
  if (periodStart > periodEnd) {
    return { error: '정산기간 시작일이 종료일보다 클 수 없습니다.' };
  }

  return { cohortSeq, settleYear, settleMonth, periodStart, periodEnd };
}

// 정산 목록 조회
router.get('/', async (req, res) => {
  try {
    const { settleYear, settleMonth, userName, cohortSeq } = req.query;
    const pool = await getConnection();
    await ensureSettlementTable(pool);

    const request = pool.request();
    let where = 'WHERE 1 = 1';

    if (cohortSeq) {
      request.input('cohort_seq', sql.Int, parseInt(String(cohortSeq), 10));
      where += ' AND ISNULL(u.cohort_seq, s.cohort_seq) = @cohort_seq';
    }
    if (settleYear) {
      request.input('settle_year', sql.Int, parseInt(settleYear, 10));
      where += ' AND s.settle_year = @settle_year';
    }
    if (settleMonth) {
      request.input('settle_month', sql.Int, parseInt(settleMonth, 10));
      where += ' AND s.settle_month = @settle_month';
    }
    if (userName && String(userName).trim()) {
      request.input('user_name', sql.NVarChar, `%${String(userName).trim()}%`);
      where += ' AND (s.user_name LIKE @user_name OR s.user_id LIKE @user_name)';
    }

    where += ` AND s.user_id NOT IN (${EXCLUDED_TEST_USER_SQL})`;

    const result = await request.query(`
      SELECT
        s.seq, s.cohort_seq, c.cohort_name,
        s.settle_year, s.settle_month, s.period_start, s.period_end,
        s.user_id, s.user_name, s.total_sales, s.subscription_fee,
        s.base_sub_fee, s.refund_amount, s.created_at
      FROM tb_subscription_settlement s
      LEFT JOIN tb_user u ON u.user_id = s.user_id
      LEFT JOIN tb_cohort c ON c.seq = ISNULL(u.cohort_seq, s.cohort_seq)
      ${where}
      ORDER BY s.settle_year DESC, s.settle_month DESC, s.period_start DESC, c.cohort_name, s.user_name, s.user_id
    `);

    res.json({ success: true, data: result.recordset });
  } catch (error) {
    console.error('구독료정산 목록 조회 오류:', error);
    res.status(500).json({ success: false, message: '구독료정산 목록 조회 중 오류가 발생했습니다.' });
  }
});

// 정산 실행
router.post('/run', async (req, res) => {
  try {
    const parsed = parseSettleParams(req.body || {});
    if (parsed.error) {
      return res.status(400).json({ success: false, message: parsed.error });
    }

    const { cohortSeq, settleYear, settleMonth, periodStart, periodEnd } = parsed;
    const pool = await getConnection();
    await ensureSettlementTable(pool);

    // 동일 기수+정산월+기간 존재 여부
    const existing = await pool.request()
      .input('cohort_seq', sql.Int, cohortSeq)
      .input('settle_year', sql.Int, settleYear)
      .input('settle_month', sql.Int, settleMonth)
      .input('period_start', sql.Date, periodStart)
      .input('period_end', sql.Date, periodEnd)
      .query(`
        SELECT COUNT(*) AS cnt
        FROM tb_subscription_settlement
        WHERE cohort_seq = @cohort_seq
          AND settle_year = @settle_year
          AND settle_month = @settle_month
          AND period_start = @period_start
          AND period_end = @period_end
      `);

    if (existing.recordset[0].cnt > 0) {
      return res.status(400).json({
        success: false,
        message: '이미 해당 기수/정산월/정산기간의 정산 내역이 있습니다. 정산취소 후 다시 실행해주세요.'
      });
    }

    const cohortCheck = await pool.request()
      .input('cohort_seq', sql.Int, cohortSeq)
      .query('SELECT seq, cohort_name FROM tb_cohort WHERE seq = @cohort_seq');

    if (!cohortCheck.recordset.length) {
      return res.status(400).json({ success: false, message: '선택한 기수를 찾을 수 없습니다.' });
    }

    const settingResult = await pool.request().query(`
      SELECT TOP 1
        ISNULL(sub_fee, 0) AS sub_fee,
        ISNULL(base_sub_amt, 0) AS base_sub_amt,
        ISNULL(rate_of_return, 27) AS rate_of_return
      FROM tb_setting_info
    `);

    const setting = settingResult.recordset[0] || { sub_fee: 0, base_sub_amt: 0, rate_of_return: 27 };
    const baseSubFee = Math.round(Number(setting.sub_fee) || 0);
    const baseSubAmt = Number(setting.base_sub_amt) || 0;
    const rateOfReturn = Number(setting.rate_of_return) || 27;

    // 선택 기수 + 사용중 사용자만 정산
    const statsResult = await pool.request()
      .input('cohort_seq', sql.Int, cohortSeq)
      .input('period_start', sql.Date, periodStart)
      .input('period_end', sql.Date, periodEnd)
      .input('base_sub_amt', sql.Float, baseSubAmt)
      .input('sub_fee', sql.Int, baseSubFee)
      .input('rate_of_return', sql.Float, rateOfReturn)
      .query(`
        WITH UserStats AS (
          SELECT
            U.user_id,
            U.user_name,
            ISNULL((
              SELECT SUM(CAST(A.pay_amt AS BIGINT))
              FROM tb_order_info A
              WHERE A.user_id = U.user_id
                AND A.seller_cd NOT LIKE 'C[_]%'
                AND A.order_status IS NOT NULL
                AND A.order_status != ''
                AND A.order_status NOT IN (N'CANCELED', N'RETURNED')
                AND CONVERT(DATE, A.pay_date) >= @period_start
                AND CONVERT(DATE, A.pay_date) <= @period_end
                ${SELLER_CD_LEN_FILTER}
            ), 0) AS total_sales
          FROM tb_user U
          WHERE U.use_yn = 'Y'
            AND U.user_type != N'가구매'
            AND U.user_type != N'관리자'
            AND U.cohort_seq = @cohort_seq
            AND U.user_id NOT IN (${EXCLUDED_TEST_USER_SQL})
        )
        SELECT
          user_id,
          user_name,
          total_sales,
          CASE
            WHEN total_sales >= @base_sub_amt THEN @sub_fee
            ELSE CAST(ROUND(total_sales * @rate_of_return / 100.0 / 2.0, 0) AS INT)
          END AS subscription_fee
        FROM UserStats
        ORDER BY user_name, user_id
      `);

    const rows = statsResult.recordset || [];
    if (rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: '해당 기수에 정산 대상 사용자가 없습니다.'
      });
    }

    let inserted = 0;

    for (const row of rows) {
      const totalSales = Number(row.total_sales) || 0;
      const subscriptionFee = Math.round(Number(row.subscription_fee) || 0);
      const refundAmount = baseSubFee - subscriptionFee;

      await pool.request()
        .input('cohort_seq', sql.Int, cohortSeq)
        .input('settle_year', sql.Int, settleYear)
        .input('settle_month', sql.Int, settleMonth)
        .input('period_start', sql.Date, periodStart)
        .input('period_end', sql.Date, periodEnd)
        .input('user_id', sql.NVarChar, row.user_id)
        .input('user_name', sql.NVarChar, row.user_name || null)
        .input('total_sales', sql.BigInt, totalSales)
        .input('subscription_fee', sql.Int, subscriptionFee)
        .input('base_sub_fee', sql.Int, baseSubFee)
        .input('refund_amount', sql.Int, refundAmount)
        .query(`
          INSERT INTO tb_subscription_settlement
            (cohort_seq, settle_year, settle_month, period_start, period_end, user_id, user_name,
             total_sales, subscription_fee, base_sub_fee, refund_amount)
          VALUES
            (@cohort_seq, @settle_year, @settle_month, @period_start, @period_end, @user_id, @user_name,
             @total_sales, @subscription_fee, @base_sub_fee, @refund_amount)
        `);
      inserted += 1;
    }

    res.json({
      success: true,
      message: `정산이 완료되었습니다. (${inserted}명)`,
      data: { inserted, cohortSeq, settleYear, settleMonth, periodStart, periodEnd }
    });
  } catch (error) {
    console.error('구독료정산 실행 오류:', error);
    res.status(500).json({ success: false, message: error.message || '구독료정산 실행 중 오류가 발생했습니다.' });
  }
});

// 정산 취소 (해당 기수 + 정산월 + 정산기간 삭제)
router.post('/cancel', async (req, res) => {
  try {
    const parsed = parseSettleParams(req.body || {});
    if (parsed.error) {
      return res.status(400).json({ success: false, message: parsed.error });
    }

    const { cohortSeq, settleYear, settleMonth, periodStart, periodEnd } = parsed;
    const pool = await getConnection();
    await ensureSettlementTable(pool);

    const result = await pool.request()
      .input('cohort_seq', sql.Int, cohortSeq)
      .input('settle_year', sql.Int, settleYear)
      .input('settle_month', sql.Int, settleMonth)
      .input('period_start', sql.Date, periodStart)
      .input('period_end', sql.Date, periodEnd)
      .query(`
        DELETE FROM tb_subscription_settlement
        WHERE cohort_seq = @cohort_seq
          AND settle_year = @settle_year
          AND settle_month = @settle_month
          AND period_start = @period_start
          AND period_end = @period_end
      `);

    const deleted = (result.rowsAffected && result.rowsAffected[0]) || 0;
    if (deleted === 0) {
      return res.status(404).json({
        success: false,
        message: '취소할 정산 내역이 없습니다.'
      });
    }

    res.json({
      success: true,
      message: `정산이 취소되었습니다. (${deleted}건 삭제)`,
      data: { deleted }
    });
  } catch (error) {
    console.error('구독료정산 취소 오류:', error);
    res.status(500).json({ success: false, message: '구독료정산 취소 중 오류가 발생했습니다.' });
  }
});

module.exports = router;
