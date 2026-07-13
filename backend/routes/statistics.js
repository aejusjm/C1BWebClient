// 통계 관련 API 라우트
const express = require('express');
const router = express.Router();
const { getConnection, sql } = require('../config/database');

/** 주문 집계: 판매자코드 길이 7~11자만 (주문관리·대시보드와 동일) */
const SELLER_CD_LEN_FILTER = 'AND LEN(A.seller_cd) BETWEEN 7 AND 11';

function buildCohortCondition(alias, cohortSeq) {
  if (cohortSeq === undefined || cohortSeq === null || String(cohortSeq).trim() === '') return '';
  const n = parseInt(String(cohortSeq), 10);
  if (!Number.isFinite(n)) return '';
  return `AND ${alias}.cohort_seq = ${n}`;
}

// 사용자별 매출 통계 조회 API
router.get('/user-sales', async (req, res) => {
  try {
    const { 
      dateFilter = 'today', 
      userName = '',
      startDate,
      endDate,
      sortField = 'total_sales',
      sortOrder = 'desc',
      cohortSeq
    } = req.query;
    
    const pool = await getConnection();
    
    // 날짜 필터 조건 생성 (한국 시간 기준)
    let dateCondition = '';
    
    if (startDate && endDate) {
      dateCondition = `AND CONVERT(DATE, A.pay_date) >= '${startDate}' AND CONVERT(DATE, A.pay_date) <= '${endDate}'`;
    } else {
      // 동적 월 필터 처리 (month-YYYY-M 형식)
      if (dateFilter && dateFilter.startsWith('month-')) {
        const parts = dateFilter.split('-');
        if (parts.length === 3) {
          const year = parts[1];
          const month = parts[2];
          dateCondition = `AND YEAR(A.pay_date) = ${year} AND MONTH(A.pay_date) = ${month}`;
        } else {
          dateCondition = 'AND CONVERT(DATE, A.pay_date) = CONVERT(DATE, DATEADD(HOUR, 9, GETUTCDATE()))';
        }
      } else {
        switch(dateFilter) {
          case 'today':
            dateCondition = 'AND CONVERT(DATE, A.pay_date) = CONVERT(DATE, DATEADD(HOUR, 9, GETUTCDATE()))';
            break;
          case 'yesterday':
            dateCondition = 'AND CONVERT(DATE, A.pay_date) = CONVERT(DATE, DATEADD(DAY, -1, DATEADD(HOUR, 9, GETUTCDATE())))';
            break;
          case 'thisWeek':
            dateCondition = 'AND A.pay_date >= DATEADD(DAY, 1 - DATEPART(WEEKDAY, DATEADD(HOUR, 9, GETUTCDATE())), CONVERT(DATE, DATEADD(HOUR, 9, GETUTCDATE()))) AND A.pay_date < DATEADD(DAY, 8 - DATEPART(WEEKDAY, DATEADD(HOUR, 9, GETUTCDATE())), CONVERT(DATE, DATEADD(HOUR, 9, GETUTCDATE())))';
            break;
          case 'lastWeek':
            dateCondition = 'AND A.pay_date >= DATEADD(DAY, -6 - DATEPART(WEEKDAY, DATEADD(HOUR, 9, GETUTCDATE())), CONVERT(DATE, DATEADD(HOUR, 9, GETUTCDATE()))) AND A.pay_date < DATEADD(DAY, 1 - DATEPART(WEEKDAY, DATEADD(HOUR, 9, GETUTCDATE())), CONVERT(DATE, DATEADD(HOUR, 9, GETUTCDATE())))';
            break;
          case 'thisMonth':
            dateCondition = 'AND YEAR(A.pay_date) = YEAR(DATEADD(HOUR, 9, GETUTCDATE())) AND MONTH(A.pay_date) = MONTH(DATEADD(HOUR, 9, GETUTCDATE()))';
            break;
          case 'lastMonth':
            dateCondition = 'AND YEAR(A.pay_date) = YEAR(DATEADD(MONTH, -1, DATEADD(HOUR, 9, GETUTCDATE()))) AND MONTH(A.pay_date) = MONTH(DATEADD(MONTH, -1, DATEADD(HOUR, 9, GETUTCDATE())))';
            break;
          default:
            dateCondition = 'AND CONVERT(DATE, A.pay_date) = CONVERT(DATE, DATEADD(HOUR, 9, GETUTCDATE()))';
        }
      }
    }
    
    // 사용자명 필터 조건
    let userNameCondition = '';
    if (userName && userName.trim() !== '') {
      userNameCondition = `AND U.user_name LIKE N'%${userName.trim()}%'`;
    }
    const cohortCondition = buildCohortCondition('U', cohortSeq);
    
    // 정렬 조건
    let orderByClause = '';
    const validSortFields = {
      'user_name': 'user_name',
      'total_order_count': 'total_order_count',
      'total_sales': 'total_sales'
    };
    const sortColumn = validSortFields[sortField] || 'total_sales';
    const sortDirection = sortOrder === 'asc' ? 'ASC' : 'DESC';
    orderByClause = `ORDER BY ${sortColumn} ${sortDirection}`;
    
    // 사용자별 매출 통계 쿼리
    const statsQuery = `
      WITH UserStats AS (
        SELECT 
          U.user_id,
          U.user_name,
          U.user_type,
          U.end_date,
          -- 스마트스토어 통계
          (SELECT COUNT(DISTINCT biz_idx) 
           FROM tb_user_market_ss 
           WHERE user_id = U.user_id AND use_yn = 'Y') as ss_store_count,
          ISNULL((SELECT COUNT(*)
           FROM tb_order_info A
           WHERE A.user_id = U.user_id
           AND A.seller_cd NOT LIKE 'C[_]%'
           AND A.order_status IS NOT NULL
           AND A.order_status != ''
           AND A.market_type = 'SS'
           AND A.order_status NOT IN (N'CANCELED', N'RETURNED')
           ${dateCondition}
           ${SELLER_CD_LEN_FILTER}
          ), 0) as ss_order_count,
          ISNULL((SELECT SUM(CAST(A.pay_amt AS BIGINT))
           FROM tb_order_info A
           WHERE A.user_id = U.user_id
           AND A.seller_cd NOT LIKE 'C[_]%'
           AND A.order_status IS NOT NULL
           AND A.order_status != ''
           AND A.market_type = 'SS'
           AND A.order_status NOT IN (N'CANCELED', N'RETURNED')
           ${dateCondition}
           ${SELLER_CD_LEN_FILTER}
          ), 0) as ss_sales,
          -- 쿠팡 통계
          (SELECT COUNT(DISTINCT biz_idx) 
           FROM tb_user_market_cp 
           WHERE user_id = U.user_id AND use_yn = 'Y') as cp_store_count,
          ISNULL((SELECT COUNT(*)
           FROM tb_order_info A
           WHERE A.user_id = U.user_id
           AND A.seller_cd NOT LIKE 'C[_]%'
           AND A.order_status IS NOT NULL
           AND A.order_status != ''
           AND A.market_type = 'CP'
           AND A.order_status NOT IN (N'CANCELED', N'RETURNED')
           ${dateCondition}
           ${SELLER_CD_LEN_FILTER}
          ), 0) as cp_order_count,
          ISNULL((SELECT SUM(CAST(A.pay_amt AS BIGINT))
           FROM tb_order_info A
           WHERE A.user_id = U.user_id
           AND A.seller_cd NOT LIKE 'C[_]%'
           AND A.order_status IS NOT NULL
           AND A.order_status != ''
           AND A.market_type = 'CP'
           AND A.order_status NOT IN (N'CANCELED', N'RETURNED')
           ${dateCondition}
           ${SELLER_CD_LEN_FILTER}
          ), 0) as cp_sales
        FROM tb_user U
        WHERE U.use_yn = 'Y'
        AND U.user_type != N'가구매'
        ${userNameCondition}
        ${cohortCondition}
      )
      SELECT 
        user_id,
        user_name,
        user_type,
        end_date,
        ss_store_count,
        ss_order_count,
        ss_sales,
        cp_store_count,
        cp_order_count,
        cp_sales,
        (ss_order_count + cp_order_count) as total_order_count,
        (ss_sales + cp_sales) as total_sales,
        (ss_sales + cp_sales) * ISNULL((SELECT TOP 1 rate_of_return FROM tb_setting_info), 27) / 100 as total_profit,
        CASE 
          WHEN (ss_sales + cp_sales) >= ISNULL((SELECT TOP 1 base_sub_amt FROM tb_setting_info), 0) 
          THEN ISNULL((SELECT TOP 1 sub_fee FROM tb_setting_info), 0)
          ELSE (ss_sales + cp_sales) * ISNULL((SELECT TOP 1 rate_of_return FROM tb_setting_info), 27) / 100 / 2
        END as subscription_fee
      FROM UserStats
      ${orderByClause}
    `;
    
    console.log('사용자별 매출 통계 쿼리:', statsQuery);
    
    const result = await pool.request().query(statsQuery);
    
    console.log('사용자별 매출 통계 결과:', result.recordset.length, '건');
    
    res.json({
      success: true,
      data: result.recordset
    });
  } catch (error) {
    console.error('사용자별 매출 통계 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '사용자별 매출 통계 조회 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 일자별 매출 통계 조회 API (특정 사용자)
router.get('/daily-sales/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { 
      dateFilter = 'today', 
      startDate,
      endDate
    } = req.query;
    
    const pool = await getConnection();
    
    // 날짜 필터 조건 생성
    let dateCondition = '';
    
    if (startDate && endDate) {
      dateCondition = `AND CONVERT(DATE, A.pay_date) >= '${startDate}' AND CONVERT(DATE, A.pay_date) <= '${endDate}'`;
    } else {
      // 동적 월 필터 처리 (month-YYYY-M 형식)
      if (dateFilter && dateFilter.startsWith('month-')) {
        const parts = dateFilter.split('-');
        if (parts.length === 3) {
          const year = parts[1];
          const month = parts[2];
          dateCondition = `AND YEAR(A.pay_date) = ${year} AND MONTH(A.pay_date) = ${month}`;
        } else {
          dateCondition = 'AND CONVERT(DATE, A.pay_date) = CONVERT(DATE, DATEADD(HOUR, 9, GETUTCDATE()))';
        }
      } else {
        switch(dateFilter) {
          case 'today':
            dateCondition = 'AND CONVERT(DATE, A.pay_date) = CONVERT(DATE, DATEADD(HOUR, 9, GETUTCDATE()))';
            break;
          case 'yesterday':
            dateCondition = 'AND CONVERT(DATE, A.pay_date) = CONVERT(DATE, DATEADD(DAY, -1, DATEADD(HOUR, 9, GETUTCDATE())))';
            break;
          case 'thisWeek':
            dateCondition = 'AND A.pay_date >= DATEADD(DAY, 1 - DATEPART(WEEKDAY, DATEADD(HOUR, 9, GETUTCDATE())), CONVERT(DATE, DATEADD(HOUR, 9, GETUTCDATE()))) AND A.pay_date < DATEADD(DAY, 8 - DATEPART(WEEKDAY, DATEADD(HOUR, 9, GETUTCDATE())), CONVERT(DATE, DATEADD(HOUR, 9, GETUTCDATE())))';
            break;
          case 'lastWeek':
            dateCondition = 'AND A.pay_date >= DATEADD(DAY, -6 - DATEPART(WEEKDAY, DATEADD(HOUR, 9, GETUTCDATE())), CONVERT(DATE, DATEADD(HOUR, 9, GETUTCDATE()))) AND A.pay_date < DATEADD(DAY, 1 - DATEPART(WEEKDAY, DATEADD(HOUR, 9, GETUTCDATE())), CONVERT(DATE, DATEADD(HOUR, 9, GETUTCDATE())))';
            break;
          case 'thisMonth':
            dateCondition = 'AND YEAR(A.pay_date) = YEAR(DATEADD(HOUR, 9, GETUTCDATE())) AND MONTH(A.pay_date) = MONTH(DATEADD(HOUR, 9, GETUTCDATE()))';
            break;
          case 'lastMonth':
            dateCondition = 'AND YEAR(A.pay_date) = YEAR(DATEADD(MONTH, -1, DATEADD(HOUR, 9, GETUTCDATE()))) AND MONTH(A.pay_date) = MONTH(DATEADD(MONTH, -1, DATEADD(HOUR, 9, GETUTCDATE())))';
            break;
          default:
            dateCondition = 'AND CONVERT(DATE, A.pay_date) = CONVERT(DATE, DATEADD(HOUR, 9, GETUTCDATE()))';
        }
      }
    }
    
    // 일자별 매출 통계 쿼리
    const statsQuery = `
      SELECT 
        pay_date,
        market,
        store,
        biz_idx,
        order_cnt,
        pay_anmt,
        pre_amt
      FROM 
      (
        -- 스마트스토어 통계
        SELECT
          CAST(A.pay_date AS date) AS pay_date,
          N'스마트스토어' AS market,
          B.store_name AS store,
          B.biz_idx,
          COUNT(*) AS order_cnt,
          SUM(CAST(A.pay_amt AS BIGINT)) AS pay_anmt,
          SUM(CAST(A.pay_amt AS BIGINT)) * ISNULL((SELECT TOP 1 rate_of_return FROM tb_setting_info), 27) / 100 AS pre_amt
        FROM tb_order_info A
        INNER JOIN tb_user_market_ss B
          ON A.user_id = B.user_id
          AND A.biz_idx = B.biz_idx
        WHERE B.use_yn = 'Y'
          AND A.user_id = @userId
          AND A.seller_cd NOT LIKE 'C[_]%'
          AND A.order_status IS NOT NULL
          AND A.order_status != ''
          AND A.market_type = 'SS'
          AND A.order_status NOT IN (N'CANCELED', N'RETURNED')
          ${dateCondition}
        GROUP BY CAST(A.pay_date AS date), B.store_name, B.biz_idx
        
        UNION ALL   
        
        -- 쿠팡 통계
        SELECT
          CAST(A.pay_date AS date) AS pay_date,
          N'쿠팡' AS market,
          B.store_name AS store,
          B.biz_idx,
          COUNT(*) AS order_cnt,
          SUM(CAST(A.pay_amt AS BIGINT)) AS pay_anmt,
          SUM(CAST(A.pay_amt AS BIGINT)) * ISNULL((SELECT TOP 1 rate_of_return FROM tb_setting_info), 27) / 100 AS pre_amt
        FROM tb_order_info A
        INNER JOIN tb_user_market_cp B
          ON A.user_id = B.user_id
          AND A.biz_idx = B.biz_idx
        WHERE B.use_yn = 'Y'
          AND A.user_id = @userId
          AND A.seller_cd NOT LIKE 'C[_]%'
          AND A.order_status IS NOT NULL
          AND A.order_status != ''
          AND A.market_type = 'CP'
          AND A.order_status NOT IN (N'CANCELED', N'RETURNED')
          ${dateCondition}
        GROUP BY CAST(A.pay_date AS date), B.store_name, B.biz_idx
      ) T
      ORDER BY pay_date, market, biz_idx
    `;
    
    console.log('일자별 매출 통계 쿼리 실행 - userId:', userId);
    
    const result = await pool.request()
      .input('userId', sql.NVarChar, userId)
      .query(statsQuery);
    
    console.log('일자별 매출 통계 결과:', result.recordset.length, '건');
    
    res.json({
      success: true,
      data: result.recordset
    });
  } catch (error) {
    console.error('일자별 매출 통계 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '일자별 매출 통계 조회 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 전체 사용자 일자별 매출 통계 조회 API (관리자용)
router.get('/daily-sales-by-user', async (req, res) => {
  try {
    const { 
      dateFilter = 'today', 
      startDate,
      endDate,
      cohortSeq
    } = req.query;
    
    const pool = await getConnection();
    
    // 날짜 필터 조건 생성
    let dateCondition = '';
    
    if (startDate && endDate) {
      dateCondition = `AND CONVERT(DATE, A.pay_date) >= '${startDate}' AND CONVERT(DATE, A.pay_date) <= '${endDate}'`;
    } else {
      // 동적 월 필터 처리 (month-YYYY-M 형식)
      if (dateFilter && dateFilter.startsWith('month-')) {
        const parts = dateFilter.split('-');
        if (parts.length === 3) {
          const year = parts[1];
          const month = parts[2];
          dateCondition = `AND YEAR(A.pay_date) = ${year} AND MONTH(A.pay_date) = ${month}`;
        } else {
          dateCondition = 'AND CONVERT(DATE, A.pay_date) = CONVERT(DATE, DATEADD(HOUR, 9, GETUTCDATE()))';
        }
      } else {
        switch(dateFilter) {
          case 'today':
            dateCondition = 'AND CONVERT(DATE, A.pay_date) = CONVERT(DATE, DATEADD(HOUR, 9, GETUTCDATE()))';
            break;
          case 'yesterday':
            dateCondition = 'AND CONVERT(DATE, A.pay_date) = CONVERT(DATE, DATEADD(DAY, -1, DATEADD(HOUR, 9, GETUTCDATE())))';
            break;
          case 'thisWeek':
            dateCondition = 'AND A.pay_date >= DATEADD(DAY, 1 - DATEPART(WEEKDAY, DATEADD(HOUR, 9, GETUTCDATE())), CONVERT(DATE, DATEADD(HOUR, 9, GETUTCDATE()))) AND A.pay_date < DATEADD(DAY, 8 - DATEPART(WEEKDAY, DATEADD(HOUR, 9, GETUTCDATE())), CONVERT(DATE, DATEADD(HOUR, 9, GETUTCDATE())))';
            break;
          case 'lastWeek':
            dateCondition = 'AND A.pay_date >= DATEADD(DAY, -6 - DATEPART(WEEKDAY, DATEADD(HOUR, 9, GETUTCDATE())), CONVERT(DATE, DATEADD(HOUR, 9, GETUTCDATE()))) AND A.pay_date < DATEADD(DAY, 1 - DATEPART(WEEKDAY, DATEADD(HOUR, 9, GETUTCDATE())), CONVERT(DATE, DATEADD(HOUR, 9, GETUTCDATE())))';
            break;
          case 'thisMonth':
            dateCondition = 'AND YEAR(A.pay_date) = YEAR(DATEADD(HOUR, 9, GETUTCDATE())) AND MONTH(A.pay_date) = MONTH(DATEADD(HOUR, 9, GETUTCDATE()))';
            break;
          case 'lastMonth':
            dateCondition = 'AND YEAR(A.pay_date) = YEAR(DATEADD(MONTH, -1, DATEADD(HOUR, 9, GETUTCDATE()))) AND MONTH(A.pay_date) = MONTH(DATEADD(MONTH, -1, DATEADD(HOUR, 9, GETUTCDATE())))';
            break;
          default:
            dateCondition = 'AND CONVERT(DATE, A.pay_date) = CONVERT(DATE, DATEADD(HOUR, 9, GETUTCDATE()))';
        }
      }
    }
    
    const cohortCondition = buildCohortCondition('U', cohortSeq);

    // 사용자별 일자별 매출 통계 쿼리
    const statsQuery = `
      SELECT 
        user_id,
        user_name,
        pay_date,
        total_sales
      FROM 
      (
        SELECT
          U.user_id,
          U.user_name,
          CAST(A.pay_date AS date) AS pay_date,
          SUM(CAST(A.pay_amt AS BIGINT)) AS total_sales
        FROM tb_order_info A
        INNER JOIN tb_user U ON A.user_id = U.user_id
        WHERE U.use_yn = 'Y'
          AND U.user_type != N'가구매'
          AND U.user_id NOT IN ('user1', 'user2', 'user3', 'ybin583', 'admin', 'payuser')
          AND A.seller_cd NOT LIKE 'C[_]%'
          AND A.order_status IS NOT NULL
          AND A.order_status != ''
          AND A.order_status NOT IN (N'CANCELED', N'RETURNED')
          ${dateCondition}
          ${cohortCondition}
          ${SELLER_CD_LEN_FILTER}
        GROUP BY U.user_id, U.user_name, CAST(A.pay_date AS date)
      ) T
      ORDER BY user_name, pay_date
    `;
    
    console.log('사용자별 일자별 매출 통계 쿼리 실행');
    
    const result = await pool.request().query(statsQuery);
    
    console.log('사용자별 일자별 매출 통계 결과:', result.recordset.length, '건');
    
    res.json({
      success: true,
      data: result.recordset
    });
  } catch (error) {
    console.error('사용자별 일자별 매출 통계 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '사용자별 일자별 매출 통계 조회 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 기간 조건: tb_good_user.get_date (한국시간 기준, 사용자별 매출 API와 동일한 프리셋)
function buildGoodUserDateCondition(dateFilter, startDate, endDate) {
  if (dateFilter === 'all') {
    return '';
  }
  if (startDate && endDate) {
    return `AND CONVERT(DATE, a.get_date) >= '${startDate}' AND CONVERT(DATE, a.get_date) <= '${endDate}'`;
  }
  switch (dateFilter) {
    case 'today':
      return 'AND CONVERT(DATE, a.get_date) = CONVERT(DATE, DATEADD(HOUR, 9, GETUTCDATE()))';
    case 'yesterday':
      return 'AND CONVERT(DATE, a.get_date) = CONVERT(DATE, DATEADD(DAY, -1, DATEADD(HOUR, 9, GETUTCDATE())))';
    case 'thisWeek':
      return `AND a.get_date >= DATEADD(DAY, 1 - DATEPART(WEEKDAY, DATEADD(HOUR, 9, GETUTCDATE())), CONVERT(DATE, DATEADD(HOUR, 9, GETUTCDATE()))) 
              AND a.get_date < DATEADD(DAY, 8 - DATEPART(WEEKDAY, DATEADD(HOUR, 9, GETUTCDATE())), CONVERT(DATE, DATEADD(HOUR, 9, GETUTCDATE())))`;
    case 'lastWeek':
      return `AND a.get_date >= DATEADD(DAY, -6 - DATEPART(WEEKDAY, DATEADD(HOUR, 9, GETUTCDATE())), CONVERT(DATE, DATEADD(HOUR, 9, GETUTCDATE()))) 
              AND a.get_date < DATEADD(DAY, 1 - DATEPART(WEEKDAY, DATEADD(HOUR, 9, GETUTCDATE())), CONVERT(DATE, DATEADD(HOUR, 9, GETUTCDATE())))`;
    case 'thisMonth':
      return 'AND YEAR(a.get_date) = YEAR(DATEADD(HOUR, 9, GETUTCDATE())) AND MONTH(a.get_date) = MONTH(DATEADD(HOUR, 9, GETUTCDATE()))';
    case 'lastMonth':
      return 'AND YEAR(a.get_date) = YEAR(DATEADD(MONTH, -1, DATEADD(HOUR, 9, GETUTCDATE()))) AND MONTH(a.get_date) = MONTH(DATEADD(MONTH, -1, DATEADD(HOUR, 9, GETUTCDATE())))';
    default:
      return 'AND CONVERT(DATE, a.get_date) = CONVERT(DATE, DATEADD(HOUR, 9, GETUTCDATE()))';
  }
}

// 상품등록 현황 (스토어별 스마트스토어/쿠팡 등록 건수)
router.get('/upload-product', async (req, res) => {
  try {
    const {
      dateFilter = 'all',
      userName = '',
      startDate,
      endDate,
      cohortSeq
    } = req.query;

    const pool = await getConnection();
    const rangeStart = startDate && String(startDate).trim() ? startDate : null;
    const rangeEnd = endDate && String(endDate).trim() ? endDate : null;
    const dateCond = buildGoodUserDateCondition(
      String(dateFilter),
      rangeStart,
      rangeEnd
    );

    let userNameCondition = '';
    if (userName && String(userName).trim() !== '') {
      userNameCondition = `AND b.user_name LIKE N'%${String(userName).trim().replace(/'/g, "''")}%'`;
    }
    const cohortCondition = buildCohortCondition('b', cohortSeq);

    // 전체: 기간 제한·get_date NULL 제외 없음. 그 외: get_date 있어야 날짜 조건이 의미 있음
    const getDateNotNull = dateFilter === 'all' ? '' : 'AND a.get_date IS NOT NULL';

    const statsQuery = `
      SELECT 
        a.user_id,
        b.user_name,
        a.biz_idx AS store_idx,
        SUM(CASE WHEN a.result_ss = N'성공' AND a.del_date IS NULL THEN 1 ELSE 0 END) AS smartsotre_cnt,
        SUM(CASE WHEN a.result_cp = N'성공' AND a.del_date IS NULL THEN 1 ELSE 0 END) AS cupang_cnt
      FROM tb_good_user a
      INNER JOIN tb_user b ON a.user_id = b.user_id
      WHERE a.use_yn = 'Y'
        ${getDateNotNull}
        ${dateCond}
        ${userNameCondition}
        ${cohortCondition}
      GROUP BY a.user_id, b.user_name, a.biz_idx
      ORDER BY b.user_name, a.user_id, a.biz_idx
    `;

    const result = await pool.request().query(statsQuery);

    res.json({
      success: true,
      data: result.recordset
    });
  } catch (error) {
    console.error('상품등록 현황 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '상품등록 현황 조회 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

module.exports = router;
