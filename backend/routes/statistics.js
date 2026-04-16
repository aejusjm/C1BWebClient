// 통계 관련 API 라우트
const express = require('express');
const router = express.Router();
const { getConnection, sql } = require('../config/database');

// 사용자별 매출 통계 조회 API
router.get('/user-sales', async (req, res) => {
  try {
    const { 
      dateFilter = 'today', 
      userName = '',
      startDate,
      endDate,
      sortField = 'total_sales',
      sortOrder = 'desc'
    } = req.query;
    
    const pool = await getConnection();
    
    // 날짜 필터 조건 생성 (한국 시간 기준)
    let dateCondition = '';
    
    if (startDate && endDate) {
      dateCondition = `AND CONVERT(DATE, A.pay_date) >= '${startDate}' AND CONVERT(DATE, A.pay_date) <= '${endDate}'`;
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
    
    // 사용자명 필터 조건
    let userNameCondition = '';
    if (userName && userName.trim() !== '') {
      userNameCondition = `AND U.user_name LIKE N'%${userName.trim()}%'`;
    }
    
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
          -- 스마트스토어 통계
          (SELECT COUNT(DISTINCT biz_idx) 
           FROM tb_user_market_ss 
           WHERE user_id = U.user_id AND use_yn = 'Y') as ss_store_count,
          ISNULL((SELECT COUNT(*) 
           FROM tb_order_info A
           WHERE A.user_id = U.user_id 
           AND A.market_type = 'SS'
           AND A.order_status NOT IN (N'CANCELED', N'RETURNED')
           ${dateCondition.replace('A.pay_date', 'A.pay_date')}
          ), 0) as ss_order_count,
          ISNULL((SELECT SUM(CAST(A.pay_amt AS BIGINT)) 
           FROM tb_order_info A
           WHERE A.user_id = U.user_id 
           AND A.market_type = 'SS'
           AND A.order_status NOT IN (N'CANCELED', N'RETURNED')
           ${dateCondition.replace('A.pay_date', 'A.pay_date')}
          ), 0) as ss_sales,
          -- 쿠팡 통계
          (SELECT COUNT(DISTINCT biz_idx) 
           FROM tb_user_market_cp 
           WHERE user_id = U.user_id AND use_yn = 'Y') as cp_store_count,
          ISNULL((SELECT COUNT(*) 
           FROM tb_order_info A
           WHERE A.user_id = U.user_id 
           AND A.market_type = 'CP'
           AND A.order_status NOT IN (N'CANCELED', N'RETURNED')
           ${dateCondition.replace('A.pay_date', 'A.pay_date')}
          ), 0) as cp_order_count,
          ISNULL((SELECT SUM(CAST(A.pay_amt AS BIGINT)) 
           FROM tb_order_info A
           WHERE A.user_id = U.user_id 
           AND A.market_type = 'CP'
           AND A.order_status NOT IN (N'CANCELED', N'RETURNED')
           ${dateCondition.replace('A.pay_date', 'A.pay_date')}
          ), 0) as cp_sales
        FROM tb_user U
        WHERE U.use_yn = 'Y'
        ${userNameCondition}
      )
      SELECT 
        user_id,
        user_name,
        ss_store_count,
        ss_order_count,
        ss_sales,
        cp_store_count,
        cp_order_count,
        cp_sales,
        (ss_order_count + cp_order_count) as total_order_count,
        (ss_sales + cp_sales) as total_sales
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

// 일자별 매출 통계 조회 API
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
          SUM(ISNULL(A.pre_amt, 0)) AS pre_amt
        FROM tb_order_info A
        INNER JOIN tb_user_market_ss B
          ON A.user_id = B.user_id 
          AND A.biz_idx = B.biz_idx 
        WHERE B.use_yn = 'Y'
          AND A.user_id = @userId
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
          SUM(ISNULL(A.pre_amt, 0)) AS pre_amt
        FROM tb_order_info A
        INNER JOIN tb_user_market_cp B
          ON A.user_id = B.user_id 
          AND A.biz_idx = B.biz_idx 
        WHERE B.use_yn = 'Y'    
          AND A.user_id = @userId
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

module.exports = router;
