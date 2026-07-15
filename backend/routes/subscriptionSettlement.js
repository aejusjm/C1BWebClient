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

/** KST 기준 현재 정산년·월·일 */
function getCurrentKstDateParts() {
  const kst = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
  return {
    settleYear: kst.getFullYear(),
    settleMonth: kst.getMonth() + 1,
    todayDay: kst.getDate()
  };
}

/** 오늘(일)이 기수 구독공지 시작일~종료일 범위 안인지 */
function isDayInNoticeRange(todayDay, startDay, endDay) {
  if (startDay == null || endDay == null) return false;
  const s = Number(startDay);
  const e = Number(endDay);
  const d = Number(todayDay);
  if (!Number.isFinite(s) || !Number.isFinite(e) || !Number.isFinite(d)) return false;
  if (s < 1 || s > 31 || e < 1 || e > 31 || d < 1 || d > 31) return false;
  if (s <= e) return d >= s && d <= e;
  // 시작일 > 종료일: 월말~익월 초 구간
  return d >= s || d <= e;
}

/** 만원 미만 절삭 (예: 719000 → 710000, 25250 → 25000) */
function truncateToManwon(amount) {
  return Math.floor(Math.max(0, Number(amount) || 0) / 10000) * 10000;
}

/** 정산 총매출 기준 구독료 산정 (구독료정산 실행과 동일) */
function calcSubscriptionFee(totalSales, baseSubAmt, baseSubFee, rateOfReturn) {
  const sales = Number(totalSales) || 0;
  const threshold = Number(baseSubAmt) || 0;
  const fee = Math.round(Number(baseSubFee) || 0);
  const rate = Number(rateOfReturn) || 0;
  const calculated = sales >= threshold ? fee : Math.round(sales * rate / 100 / 2);
  return truncateToManwon(calculated);
}

function calcRefundAmount(baseSubFee, subscriptionFee) {
  const refund = Math.max(0, Math.round(Number(baseSubFee) || 0) - Math.round(Number(subscriptionFee) || 0));
  return truncateToManwon(refund);
}

// 로그인 사용자 이번달 구독료정산 안내
// (기수 구독공지 기간 내 + 정산 데이터 있을 때 프론트에서 표시)
router.get('/my-monthly-notice', async (req, res) => {
  try {
    const userId = String(req.headers['x-user-id'] || req.query.userId || '').trim();
    if (!userId) {
      return res.status(400).json({ success: false, message: '사용자 정보가 필요합니다.' });
    }

    const { settleYear, settleMonth, todayDay } = getCurrentKstDateParts();
    console.log('[my-monthly-notice] 요청:', { userId, settleYear, settleMonth, todayDay });

    const pool = await getConnection();
    await ensureSettlementTable(pool);

    const userResult = await pool.request()
      .input('user_id', sql.NVarChar, userId)
      .query(`
        SELECT TOP 1
          u.user_id, u.user_name, u.cohort_seq,
          c.sub_notice_start, c.sub_notice_end, c.cohort_name,
          ISNULL(c.sub_fee, 0) AS cohort_sub_fee
        FROM tb_user u
        LEFT JOIN tb_cohort c ON c.seq = u.cohort_seq
        WHERE u.user_id = @user_id
      `);

    const user = userResult.recordset[0] || null;
    const noticeStart = user?.sub_notice_start ?? null;
    const noticeEnd = user?.sub_notice_end ?? null;
    const inNoticePeriod = isDayInNoticeRange(todayDay, noticeStart, noticeEnd);

    if (!inNoticePeriod) {
      console.log('[my-monthly-notice] 구독공지 기간 외:', {
        userId,
        todayDay,
        notice_start: noticeStart,
        notice_end: noticeEnd
      });
      return res.json({
        success: true,
        show: false,
        reason: 'out_of_notice_period',
        data: {
          settle_year: settleYear,
          settle_month: settleMonth,
          has_settlement: false,
          notice_start: noticeStart,
          notice_end: noticeEnd,
          today_day: todayDay
        }
      });
    }

    const settleQuery = `
        SELECT TOP 1
          seq, cohort_seq, settle_year, settle_month,
          period_start, period_end, user_id, user_name,
          total_sales, subscription_fee, base_sub_fee, refund_amount, created_at
        FROM tb_subscription_settlement
        WHERE LTRIM(RTRIM(user_id)) = LTRIM(RTRIM(@user_id))
          AND settle_year = @settle_year
          AND settle_month = @settle_month
        ORDER BY created_at DESC, seq DESC
      `;
    console.log('[my-monthly-notice] 총매출 조회 쿼리:', settleQuery);
    console.log('[my-monthly-notice] 총매출 조회 파라미터:', {
      user_id: userId,
      settle_year: settleYear,
      settle_month: settleMonth
    });

    const settleResult = await pool.request()
      .input('user_id', sql.NVarChar, userId)
      .input('settle_year', sql.Int, settleYear)
      .input('settle_month', sql.Int, settleMonth)
      .query(settleQuery);

    const settlement = settleResult.recordset[0] || null;
    console.log('[my-monthly-notice] 총매출 조회 결과:', settlement
      ? {
          user_id: settlement.user_id,
          settle_year: settlement.settle_year,
          settle_month: settlement.settle_month,
          total_sales: Number(settlement.total_sales) || 0,
          subscription_fee: Number(settlement.subscription_fee) || 0,
          refund_amount: Number(settlement.refund_amount) || 0
        }
      : null);

    const settingResult = await pool.request().query(`
      SELECT TOP 1
        CAST(ISNULL(sub_fee, 0) AS FLOAT) AS sub_fee,
        CAST(ISNULL(base_sub_amt, 0) AS FLOAT) AS base_sub_amt,
        CAST(ISNULL(rate_of_return, 0) AS FLOAT) AS rate_of_return
      FROM tb_setting_info
    `);
    const setting = settingResult.recordset[0] || { sub_fee: 0, base_sub_amt: 0, rate_of_return: 0 };

    const cohortSubFee = Math.round(Number(user?.cohort_sub_fee) || 0);
    const defaultBaseSubFee = cohortSubFee > 0 ? cohortSubFee : Math.round(Number(setting.sub_fee) || 0);
    const rateOfReturn = Number(setting.rate_of_return) || 0;
    const settingBaseSubAmt = Number(setting.base_sub_amt) || 0;
    const settingSubFee = Math.round(Number(setting.sub_fee) || 0);

    let totalSales = 0;
    let subscriptionFee = 0;
    let baseSubFee = defaultBaseSubFee;
    let refundAmount = 0;

    if (settlement) {
      totalSales = Number(settlement.total_sales) || 0;
      baseSubFee = Math.round(Number(settlement.base_sub_fee) || 0) || defaultBaseSubFee;
      subscriptionFee = calcSubscriptionFee(totalSales, settingBaseSubAmt, baseSubFee, rateOfReturn);
      refundAmount = calcRefundAmount(baseSubFee, subscriptionFee);
    }

    const payload = {
      settle_year: settlement ? settlement.settle_year : settleYear,
      settle_month: settlement ? settlement.settle_month : settleMonth,
      has_settlement: Boolean(settlement),
      period_start: settlement?.period_start ?? null,
      period_end: settlement?.period_end ?? null,
      user_id: user?.user_id || userId,
      user_name: settlement?.user_name || user?.user_name || null,
      cohort_name: user?.cohort_name || null,
      total_sales: totalSales,
      subscription_fee: subscriptionFee,
      base_sub_fee: baseSubFee,
      refund_amount: refundAmount,
      base_sub_amt: settingBaseSubAmt,
      setting_sub_fee: settingSubFee,
      rate_of_return: rateOfReturn,
      notice_start: noticeStart,
      notice_end: noticeEnd,
      today_day: todayDay,
      in_notice_period: true
    };
    console.log('[my-monthly-notice] 응답:', {
      userId: payload.user_id,
      has_settlement: payload.has_settlement,
      total_sales: payload.total_sales,
      subscription_fee: payload.subscription_fee,
      notice_start: noticeStart,
      notice_end: noticeEnd,
      today_day: todayDay
    });

    res.json({
      success: true,
      show: Boolean(settlement),
      data: payload
    });
  } catch (error) {
    console.error('구독료정산 안내 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '구독료정산 안내 조회 중 오류가 발생했습니다.'
    });
  }
});

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
      ORDER BY s.settle_year DESC, s.settle_month DESC, c.cohort_name ASC, s.total_sales DESC
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

    // 동일 기수+정산월+기간 존재 여부 (기수 미저장 옛 데이터도 해당 기수 사용자면 포함)
    const existing = await pool.request()
      .input('cohort_seq', sql.Int, cohortSeq)
      .input('settle_year', sql.Int, settleYear)
      .input('settle_month', sql.Int, settleMonth)
      .input('period_start', sql.Date, periodStart)
      .input('period_end', sql.Date, periodEnd)
      .query(`
        SELECT COUNT(*) AS cnt
        FROM tb_subscription_settlement s
        WHERE s.settle_year = @settle_year
          AND s.settle_month = @settle_month
          AND s.period_start = @period_start
          AND s.period_end = @period_end
          AND (
            s.cohort_seq = @cohort_seq
            OR (
              s.cohort_seq IS NULL
              AND EXISTS (
                SELECT 1 FROM tb_user u
                WHERE u.user_id = s.user_id AND u.cohort_seq = @cohort_seq
              )
            )
          )
      `);

    if (existing.recordset[0].cnt > 0) {
      return res.status(400).json({
        success: false,
        message: '이미 해당 기수/정산월/정산기간의 정산 내역이 있습니다. 정산취소 후 다시 실행해주세요.'
      });
    }

    const cohortCheck = await pool.request()
      .input('cohort_seq', sql.Int, cohortSeq)
      .query(`
        SELECT seq, cohort_name, ISNULL(sub_fee, 0) AS sub_fee
        FROM tb_cohort
        WHERE seq = @cohort_seq
      `);

    if (!cohortCheck.recordset.length) {
      return res.status(400).json({ success: false, message: '선택한 기수를 찾을 수 없습니다.' });
    }

    const cohort = cohortCheck.recordset[0];
    const settingResult = await pool.request().query(`
      SELECT TOP 1
        ISNULL(sub_fee, 0) AS sub_fee,
        ISNULL(base_sub_amt, 0) AS base_sub_amt,
        ISNULL(rate_of_return, 0) AS rate_of_return
      FROM tb_setting_info
    `);

    const setting = settingResult.recordset[0] || { sub_fee: 0, base_sub_amt: 0, rate_of_return: 0 };
    // 기수 구독료 우선 적용 (없으면 기준정보 구독료)
    const cohortSubFee = Math.round(Number(cohort.sub_fee) || 0);
    const baseSubFee = cohortSubFee > 0 ? cohortSubFee : Math.round(Number(setting.sub_fee) || 0);
    const baseSubAmt = Number(setting.base_sub_amt) || 0;
    const rateOfReturn = Number(setting.rate_of_return) || 0;

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
      const subscriptionFee = truncateToManwon(Math.round(Number(row.subscription_fee) || 0));
      const refundAmount = calcRefundAmount(baseSubFee, subscriptionFee);

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

// 정산 취소 (해당 기수 + 정산년월 삭제, 기간은 있으면 추가 조건)
router.post('/cancel', async (req, res) => {
  try {
    const body = req.body || {};
    const cohortSeq = parseInt(body.cohortSeq, 10);
    const settleYear = parseInt(body.settleYear, 10);
    const settleMonth = parseInt(body.settleMonth, 10);
    const periodStart = String(body.periodStart || '').trim();
    const periodEnd = String(body.periodEnd || '').trim();

    if (!cohortSeq) {
      return res.status(400).json({ success: false, message: '기수를 선택해주세요.' });
    }
    if (!settleYear || settleYear < 2000 || settleYear > 2100) {
      return res.status(400).json({ success: false, message: '정산년을 올바르게 선택해주세요.' });
    }
    if (!settleMonth || settleMonth < 1 || settleMonth > 12) {
      return res.status(400).json({ success: false, message: '정산월을 올바르게 선택해주세요.' });
    }

    const pool = await getConnection();
    await ensureSettlementTable(pool);

    console.log('[settlement/cancel] 요청:', {
      cohortSeq, settleYear, settleMonth, periodStart, periodEnd
    });

    const request = pool.request()
      .input('cohort_seq', sql.Int, cohortSeq)
      .input('settle_year', sql.Int, settleYear)
      .input('settle_month', sql.Int, settleMonth);

    // 기본: 기수 + 정산년월
    let where = `
        settle_year = @settle_year
        AND settle_month = @settle_month
        AND (
          cohort_seq = @cohort_seq
          OR (
            cohort_seq IS NULL
            AND user_id IN (
              SELECT user_id FROM tb_user WHERE cohort_seq = @cohort_seq
            )
          )
        )
    `;

    // 정산기간이 있으면 추가 조건 (날짜 문자열 비교로 타임존 이슈 완화)
    const hasPeriod =
      /^\d{4}-\d{2}-\d{2}$/.test(periodStart) &&
      /^\d{4}-\d{2}-\d{2}$/.test(periodEnd);

    if (hasPeriod) {
      request
        .input('period_start', sql.NVarChar, periodStart)
        .input('period_end', sql.NVarChar, periodEnd);
      where += `
        AND CONVERT(varchar(10), period_start, 23) = @period_start
        AND CONVERT(varchar(10), period_end, 23) = @period_end
      `;
    }

    // 기간 조건으로 0건이면 기수+년월만으로 재시도
    let result = await request.query(`
      DELETE FROM tb_subscription_settlement
      WHERE ${where}
    `);
    let deleted = (result.rowsAffected && result.rowsAffected[0]) || 0;

    if (deleted === 0 && hasPeriod) {
      const fallback = await pool.request()
        .input('cohort_seq', sql.Int, cohortSeq)
        .input('settle_year', sql.Int, settleYear)
        .input('settle_month', sql.Int, settleMonth)
        .query(`
          DELETE FROM tb_subscription_settlement
          WHERE settle_year = @settle_year
            AND settle_month = @settle_month
            AND (
              cohort_seq = @cohort_seq
              OR (
                cohort_seq IS NULL
                AND user_id IN (
                  SELECT user_id FROM tb_user WHERE cohort_seq = @cohort_seq
                )
              )
            )
        `);
      deleted = (fallback.rowsAffected && fallback.rowsAffected[0]) || 0;
      console.log('[settlement/cancel] 기간 불일치 → 기수/년월 기준 삭제:', deleted);
    }

    console.log('[settlement/cancel] 삭제 건수:', deleted);

    if (deleted === 0) {
      return res.status(400).json({
        success: false,
        message: '취소할 정산 내역이 없습니다. 기수/정산년/정산월을 확인해주세요.'
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
