// 주문관리 관련 API 라우트
const express = require('express');
const router = express.Router();
const { getConnection, sql } = require('../config/database');

/** 주문/대시보드: 판매자코드 길이 7~11자만 */
const SELLER_CD_LEN_FILTER = 'AND LEN(A.seller_cd) BETWEEN 7 AND 11';

// 주문 목록 조회 API
router.get('/orders/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 20, dateFilter = 'today', startDate = '', endDate = '', smartStore = 'true', coupang = 'true', stores = '', status = '' } = req.query;
    
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;
    
    const pool = await getConnection();
    
    // 날짜 필터 조건 생성
    let dateCondition = '';
    
    // 사용자 정의 날짜 범위가 있으면 우선 적용
    if (startDate && endDate) {
      dateCondition = `AND CONVERT(DATE, A.pay_date) >= '${startDate}' AND CONVERT(DATE, A.pay_date) <= '${endDate}'`;
    } else {
      // 기본 날짜 필터 적용
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
    
    // 마켓 필터 조건 생성
    let marketCondition = '';
    const isSmartStore = smartStore === 'true';
    const isCoupang = coupang === 'true';
    
    if (isSmartStore && !isCoupang) {
      marketCondition = "AND A.market_type = 'SS'";
    } else if (!isSmartStore && isCoupang) {
      marketCondition = "AND A.market_type = 'CP'";
    } else if (!isSmartStore && !isCoupang) {
      // 둘 다 선택 안 함 - 결과 없음
      marketCondition = "AND 1 = 0";
    }
    // 둘 다 선택된 경우 조건 없음 (모두 표시)
    
    // 스토어 필터 조건 생성
    let storeCondition = '';
    if (stores && stores.trim() !== '') {
      const storeList = stores.split(',').map(s => parseInt(s.trim())).filter(s => !isNaN(s));
      if (storeList.length > 0) {
        storeCondition = `AND A.biz_idx IN (${storeList.join(',')})`;
      } else {
        // 빈 배열인 경우 (모두 체크 해제) - 결과 없음
        storeCondition = 'AND 1 = 0';
      }
    } else {
      // stores 파라미터가 없거나 빈 문자열인 경우 - 결과 없음
      storeCondition = 'AND 1 = 0';
    }
    
    // 주문 상태 필터 조건 생성
    let statusCondition = '';
    if (status && status.trim() !== '') {
      // 한글 상태를 DB 상태 코드로 매핑
      const statusMap = {
        '신규주문': ['ACCEPT', 'PAYED'],
        '상품준비중': ['DEPARTURE', 'INSTRUCT'],
        '배송중': ['DELIVERING'],
        '배송완료': ['PURCHASE_DECIDED', 'FINAL_DELIVERY'],
        '취소': ['CANCELED'],
        '반품': ['RETURNED']
      };
      
      const dbStatuses = statusMap[status.trim()];
      if (dbStatuses && dbStatuses.length > 0) {
        const statusList = dbStatuses.map(s => `N'${s}'`).join(',');
        statusCondition = `AND A.order_status IN (${statusList})`;
      }
    }
    
    // 전체 카운트 쿼리
    const countQuery = `
      SELECT COUNT(*) as total
      FROM tb_order_info A
      INNER JOIN tb_user_market_ss B
        ON A.user_id = B.user_id 
        AND A.biz_idx = B.biz_idx 
      LEFT OUTER JOIN tb_good_master C
        ON TRY_CAST(RIGHT(A.seller_cd, 7) AS INT) = C.seq 
      WHERE B.user_id = @userId
      ${dateCondition}
      ${marketCondition}
      ${storeCondition}
      ${statusCondition}
      ${SELLER_CD_LEN_FILTER}
    `;
    
    const countResult = await pool.request()
      .input('userId', sql.NVarChar, userId)
      .query(countQuery);
    
    const totalCount = countResult.recordset[0].total;
    
    // 데이터 조회 쿼리
    const dataQuery = `
      SELECT
        A.seq,
        A.user_id,
        A.biz_idx,
        A.market_type,
        A.order_id,
        A.product_id,
        A.product_name,
        A.order_status,
        A.opt_info,
        A.seller_cd,
        A.org_seller_cd,
        A.pay_amt,
        A.ordrr_name,
        A.orderer_Id,
        A.ordrr_tel,
        A.recvr_name,
        A.recvr_tel,
        A.recvr_addr,
        A.invo_no,
        A.PCCC,
        CONVERT(VARCHAR(19), A.pay_date, 120) as pay_date,
        CONVERT(VARCHAR(19), A.dispatch_date, 120) as dispatch_date,
        CONVERT(VARCHAR(19), A.dlvy_done_date, 120) as dlvy_done_date,
        CONVERT(VARCHAR(19), A.purch_decided_date, 120) as purch_decided_date,
        CONVERT(VARCHAR(19), A.cancel_date, 120) as cancel_date,
        CONVERT(VARCHAR(19), A.return_date, 120) as return_date,
        CONVERT(VARCHAR(19), A.pccc_req_date, 120) as pccc_req_date,
        B.store_name,
        B.store_id,
        C.SEQ AS C_SEQ,
        C.t_img_url,
        C.main_img_url,
        C.base_folder,
        C.item_id,
        C.t_url,
        D.display_id_ss,
        D.display_id_cp,
        ISNULL(A.taobao_order_no, '') as taobao_order_no,
        ISNULL(A.taobao_pay_cn, 0) as taobao_pay_cn,
        ISNULL(A.taobao_pay_kr, 0) as taobao_pay_kr,
        ISNULL(A.delv_order_no, '') as delv_order_no,
        ISNULL(A.delv_price, 0) as delv_price
      FROM tb_order_info A
      INNER JOIN tb_user_market_ss B
        ON A.user_id = B.user_id 
        AND A.biz_idx = B.biz_idx 
      LEFT OUTER JOIN tb_good_master C
        ON TRY_CAST(RIGHT(A.seller_cd, 7) AS INT) = C.seq 
      LEFT OUTER JOIN tb_good_user D
        ON D.gm_seq = C.seq 
        AND D.user_id = @userId
      WHERE B.user_id = @userId
      ${dateCondition}
      ${marketCondition}
      ${storeCondition}
      ${statusCondition}
      ${SELLER_CD_LEN_FILTER}
      ORDER BY A.pay_date DESC
      OFFSET @offset ROWS 
      FETCH NEXT @limit ROWS ONLY
    `;
    
    const dataResult = await pool.request()
      .input('userId', sql.NVarChar, userId)
      .input('offset', sql.Int, offset)
      .input('limit', sql.Int, limitNum)
      .query(dataQuery);
    
    res.json({
      success: true,
      data: dataResult.recordset,
      pagination: {
        currentPage: pageNum,
        pageSize: limitNum,
        totalCount: totalCount,
        totalPages: Math.ceil(totalCount / limitNum)
      }
    });
  } catch (error) {
    console.error('주문 목록 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '주문 목록 조회 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 주문 상태별 통계 조회 API
router.get('/stats/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { dateFilter = 'today', startDate = '', endDate = '', smartStore = 'true', coupang = 'true', stores = '' } = req.query;
    
    const pool = await getConnection();
    
    // 날짜 필터 조건 생성
    let dateCondition = '';
    
    // 사용자 정의 날짜 범위가 있으면 우선 적용
    if (startDate && endDate) {
      dateCondition = `AND CONVERT(DATE, A.pay_date) >= '${startDate}' AND CONVERT(DATE, A.pay_date) <= '${endDate}'`;
    } else {
      // 기본 날짜 필터 적용
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
    
    // 마켓 필터 조건 생성
    let marketCondition = '';
    const isSmartStore = smartStore === 'true';
    const isCoupang = coupang === 'true';
    
    if (isSmartStore && !isCoupang) {
      marketCondition = "AND A.market_type = 'SS'";
    } else if (!isSmartStore && isCoupang) {
      marketCondition = "AND A.market_type = 'CP'";
    } else if (!isSmartStore && !isCoupang) {
      marketCondition = "AND 1 = 0";
    }
    
    // 스토어 필터 조건 생성
    let storeCondition = '';
    if (stores && stores.trim() !== '') {
      const storeList = stores.split(',').map(s => parseInt(s.trim())).filter(s => !isNaN(s));
      if (storeList.length > 0) {
        storeCondition = `AND A.biz_idx IN (${storeList.join(',')})`;
      } else {
        // 빈 배열인 경우 (모두 체크 해제) - 결과 없음
        storeCondition = 'AND 1 = 0';
      }
    } else {
      // stores 파라미터가 없거나 빈 문자열인 경우 - 결과 없음
      storeCondition = 'AND 1 = 0';
    }
    
    // 상태별 통계 쿼리
    const statsQuery = `
      SELECT 
        SUM(CASE WHEN A.order_status IN ('ACCEPT', 'PAYED') THEN 1 ELSE 0 END) as new_orders,
        SUM(CASE WHEN A.order_status IN ('DEPARTURE', 'INSTRUCT') THEN 1 ELSE 0 END) as preparing,
        SUM(CASE WHEN A.order_status = 'DELIVERING' THEN 1 ELSE 0 END) as delivering,
        SUM(CASE WHEN A.order_status IN ('PURCHASE_DECIDED', 'FINAL_DELIVERY') THEN 1 ELSE 0 END) as delivered,
        SUM(CASE WHEN A.order_status = 'CANCELED' THEN 1 ELSE 0 END) as canceled,
        SUM(CASE WHEN A.order_status = 'RETURNED' THEN 1 ELSE 0 END) as returned
      FROM tb_order_info A
      INNER JOIN tb_user_market_ss B
        ON A.user_id = B.user_id 
        AND A.biz_idx = B.biz_idx 
      WHERE B.user_id = @userId
      ${dateCondition}
      ${marketCondition}
      ${storeCondition}
      ${SELLER_CD_LEN_FILTER}
    `;
    
    const statsResult = await pool.request()
      .input('userId', sql.NVarChar, userId)
      .query(statsQuery);
    
    res.json({
      success: true,
      data: statsResult.recordset[0]
    });
  } catch (error) {
    console.error('주문 통계 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '주문 통계 조회 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 사용자 스토어 목록 조회 API
router.get('/stores/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    console.log('스토어 목록 조회 요청 - userId:', userId);
    
    const pool = await getConnection();
    
    const storesQuery = `
      SELECT 
        user_id,
        biz_idx,
        CONVERT(VARCHAR(50), store_name) as store_name
      FROM tb_user_market_ss
      WHERE user_id = @userId
      ORDER BY biz_idx
    `;
    
    const storesResult = await pool.request()
      .input('userId', sql.NVarChar, userId)
      .query(storesQuery);
    
    console.log('스토어 조회 결과:', storesResult.recordset.length, '개');
    console.log('스토어 데이터:', storesResult.recordset);
    
    res.json({
      success: true,
      data: storesResult.recordset
    });
  } catch (error) {
    console.error('스토어 목록 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '스토어 목록 조회 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 대시보드 마켓별 주문 통계 API
router.get('/dashboard/market-stats/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { dateFilter = 'today', stores = '', startDate, endDate } = req.query;
    
    const pool = await getConnection();
    
    // 날짜 필터 조건 생성
    let dateCondition = '';
    
    // 사용자 정의 날짜 범위가 있으면 우선 적용
    if (startDate && endDate) {
      dateCondition = `AND CONVERT(DATE, A.pay_date) >= '${startDate}' AND CONVERT(DATE, A.pay_date) <= '${endDate}'`;
    } else {
      // 기본 날짜 필터 적용
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
    
    // 스토어 필터 조건 생성
    let storeCondition = '';
    if (stores && stores.trim() !== '') {
      const storeList = stores.split(',').map(s => parseInt(s.trim())).filter(s => !isNaN(s));
      if (storeList.length > 0) {
        storeCondition = `AND A.biz_idx IN (${storeList.join(',')})`;
      } else {
        storeCondition = 'AND 1 = 0';
      }
    } else {
      storeCondition = 'AND 1 = 0';
    }
    
    // 마켓별 통계 쿼리 (취소, 반품 제외)
    const marketStatsQuery = `
      SELECT 
        A.market_type,
        COUNT(*) as order_count,
        SUM(CAST(A.pay_amt AS BIGINT)) as total_amount
      FROM tb_order_info A
      INNER JOIN tb_user_market_ss B
        ON A.user_id = B.user_id 
        AND A.biz_idx = B.biz_idx 
      WHERE B.user_id = @userId
      AND A.order_status NOT IN (N'CANCELED', N'RETURNED')
      ${dateCondition}
      ${storeCondition}
      ${SELLER_CD_LEN_FILTER}
      GROUP BY A.market_type
    `;
    
    const marketStatsResult = await pool.request()
      .input('userId', sql.NVarChar, userId)
      .query(marketStatsQuery);
    
    res.json({
      success: true,
      data: marketStatsResult.recordset
    });
  } catch (error) {
    console.error('마켓별 통계 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '마켓별 통계 조회 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 대시보드 스토어별 주문 통계 API
router.get('/dashboard/store-stats/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { dateFilter = 'today', smartStore = 'true', coupang = 'true', stores = '', startDate, endDate } = req.query;
    
    const pool = await getConnection();
    
    // 날짜 필터 조건 생성
    let dateCondition = '';
    
    // 사용자 정의 날짜 범위가 있으면 우선 적용
    if (startDate && endDate) {
      dateCondition = `AND CONVERT(DATE, A.pay_date) >= '${startDate}' AND CONVERT(DATE, A.pay_date) <= '${endDate}'`;
    } else {
      // 기본 날짜 필터 적용
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
    
    // 마켓 필터 조건 생성
    let marketCondition = '';
    const isSmartStore = smartStore === 'true';
    const isCoupang = coupang === 'true';
    
    if (isSmartStore && !isCoupang) {
      marketCondition = "AND A.market_type = 'SS'";
    } else if (!isSmartStore && isCoupang) {
      marketCondition = "AND A.market_type = 'CP'";
    } else if (!isSmartStore && !isCoupang) {
      marketCondition = "AND 1 = 0";
    }
    
    // 스토어 필터 조건 생성
    let storeCondition = '';
    if (stores && stores.trim() !== '') {
      const storeList = stores.split(',').map(s => parseInt(s.trim())).filter(s => !isNaN(s));
      if (storeList.length > 0) {
        storeCondition = `AND A.biz_idx IN (${storeList.join(',')})`;
      } else {
        storeCondition = 'AND 1 = 0';
      }
    } else {
      storeCondition = 'AND 1 = 0';
    }
    
    // 스토어별 통계 쿼리 (취소, 반품 제외)
    const storeStatsQuery = `
      SELECT 
        A.biz_idx,
        CONVERT(VARCHAR(50), B.store_name) as store_name,
        COUNT(*) as order_count,
        SUM(CAST(A.pay_amt AS BIGINT)) as total_amount
      FROM tb_order_info A
      INNER JOIN tb_user_market_ss B
        ON A.user_id = B.user_id 
        AND A.biz_idx = B.biz_idx 
      WHERE B.user_id = @userId
      AND A.order_status NOT IN (N'CANCELED', N'RETURNED')
      ${dateCondition}
      ${marketCondition}
      ${storeCondition}
      ${SELLER_CD_LEN_FILTER}
      GROUP BY A.biz_idx, B.store_name
      ORDER BY A.biz_idx
    `;
    
    const storeStatsResult = await pool.request()
      .input('userId', sql.NVarChar, userId)
      .query(storeStatsQuery);
    
    res.json({
      success: true,
      data: storeStatsResult.recordset
    });
  } catch (error) {
    console.error('스토어별 통계 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '스토어별 통계 조회 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 일자별 주문추이 조회 API (대시보드용)
router.get('/dashboard/order-trend/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { dateFilter = 'today', smartStore = 'true', coupang = 'true', stores = '', startDate, endDate } = req.query;
    
    const pool = await getConnection();
    
    // 날짜 필터 조건 생성
    let dateCondition = '';
    
    // 사용자 정의 날짜 범위가 있으면 우선 적용
    if (startDate && endDate) {
      dateCondition = `AND CONVERT(DATE, A.pay_date) >= '${startDate}' AND CONVERT(DATE, A.pay_date) <= '${endDate}'`;
    } else {
      // 기본 날짜 필터 적용
      if (dateFilter === 'today') {
        dateCondition = "AND CONVERT(DATE, A.pay_date) = CONVERT(DATE, DATEADD(HOUR, 9, GETUTCDATE()))";
      } else if (dateFilter === 'yesterday') {
        dateCondition = "AND CONVERT(DATE, A.pay_date) = CONVERT(DATE, DATEADD(DAY, -1, DATEADD(HOUR, 9, GETUTCDATE())))";
      } else if (dateFilter === 'thisWeek') {
        dateCondition = "AND A.pay_date >= DATEADD(DAY, 1 - DATEPART(WEEKDAY, DATEADD(HOUR, 9, GETUTCDATE())), CONVERT(DATE, DATEADD(HOUR, 9, GETUTCDATE()))) AND A.pay_date < DATEADD(DAY, 8 - DATEPART(WEEKDAY, DATEADD(HOUR, 9, GETUTCDATE())), CONVERT(DATE, DATEADD(HOUR, 9, GETUTCDATE())))";
      } else if (dateFilter === 'lastWeek') {
        dateCondition = "AND A.pay_date >= DATEADD(DAY, -6 - DATEPART(WEEKDAY, DATEADD(HOUR, 9, GETUTCDATE())), CONVERT(DATE, DATEADD(HOUR, 9, GETUTCDATE()))) AND A.pay_date < DATEADD(DAY, 1 - DATEPART(WEEKDAY, DATEADD(HOUR, 9, GETUTCDATE())), CONVERT(DATE, DATEADD(HOUR, 9, GETUTCDATE())))";
      } else if (dateFilter === 'thisMonth') {
        dateCondition = "AND YEAR(A.pay_date) = YEAR(DATEADD(HOUR, 9, GETUTCDATE())) AND MONTH(A.pay_date) = MONTH(DATEADD(HOUR, 9, GETUTCDATE()))";
      } else if (dateFilter === 'lastMonth') {
        dateCondition = "AND YEAR(A.pay_date) = YEAR(DATEADD(MONTH, -1, DATEADD(HOUR, 9, GETUTCDATE()))) AND MONTH(A.pay_date) = MONTH(DATEADD(MONTH, -1, DATEADD(HOUR, 9, GETUTCDATE())))";
      } else {
        // 기본값: 오늘
        dateCondition = "AND CONVERT(DATE, A.pay_date) = CONVERT(DATE, DATEADD(HOUR, 9, GETUTCDATE()))";
      }
    }
    
    console.log('🔍 주문추이 조회 요청 - userId:', userId, 'dateFilter:', dateFilter, 'smartStore:', smartStore, 'coupang:', coupang, 'stores:', stores, 'startDate:', startDate, 'endDate:', endDate);
    console.log('📅 적용된 날짜 조건:', dateCondition);
    
    // 마켓 필터 조건 생성
    const isSmartStore = smartStore === 'true';
    const isCoupang = coupang === 'true';
    let marketCondition = '';
    if (isSmartStore && !isCoupang) {
      marketCondition = "AND A.market_type = 'SS'";
    } else if (!isSmartStore && isCoupang) {
      marketCondition = "AND A.market_type = 'CP'";
    } else if (!isSmartStore && !isCoupang) {
      marketCondition = "AND 1 = 0";
    }
    
    // 스토어 필터 조건 생성
    let storeCondition = '';
    if (stores && stores.trim() !== '') {
      const storeList = stores.split(',').map(s => parseInt(s.trim())).filter(s => !isNaN(s));
      if (storeList.length > 0) {
        storeCondition = `AND A.biz_idx IN (${storeList.join(',')})`;
      } else {
        storeCondition = 'AND 1 = 0';
      }
    } else {
      storeCondition = 'AND 1 = 0';
    }
    
    // 일자별 마켓별 주문 건수 쿼리 (취소, 반품 제외)
    const orderTrendQuery = `
      SELECT 
        CONVERT(VARCHAR(10), A.pay_date, 23) as order_date,
        A.market_type,
        COUNT(*) as order_count
      FROM tb_order_info A
      INNER JOIN tb_user_market_ss B
        ON A.user_id = B.user_id 
        AND A.biz_idx = B.biz_idx 
      WHERE B.user_id = @userId
      AND A.order_status NOT IN (N'CANCELED', N'RETURNED')
      ${dateCondition}
      ${marketCondition}
      ${storeCondition}
      ${SELLER_CD_LEN_FILTER}
      GROUP BY CONVERT(VARCHAR(10), A.pay_date, 23), A.market_type
      ORDER BY CONVERT(VARCHAR(10), A.pay_date, 23)
    `;
    
    const orderTrendResult = await pool.request()
      .input('userId', sql.NVarChar, userId)
      .query(orderTrendQuery);
    
    console.log('주문추이 쿼리 결과:', orderTrendResult.recordset.length, '건');
    console.log('주문추이 데이터:', orderTrendResult.recordset);
    
    res.json({
      success: true,
      data: orderTrendResult.recordset
    });
  } catch (error) {
    console.error('주문추이 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '주문추이 조회 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 일자별 매출추이 조회 API (대시보드용)
router.get('/dashboard/sales-trend/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { dateFilter = 'today', smartStore = 'true', coupang = 'true', stores = '', startDate, endDate } = req.query;
    
    const pool = await getConnection();
    
    // 날짜 필터 조건 생성
    let dateCondition = '';
    
    // 사용자 정의 날짜 범위가 있으면 우선 적용
    if (startDate && endDate) {
      dateCondition = `AND CONVERT(DATE, A.pay_date) >= '${startDate}' AND CONVERT(DATE, A.pay_date) <= '${endDate}'`;
    } else {
      // 기본 날짜 필터 적용
      if (dateFilter === 'today') {
        dateCondition = "AND CONVERT(DATE, A.pay_date) = CONVERT(DATE, DATEADD(HOUR, 9, GETUTCDATE()))";
      } else if (dateFilter === 'yesterday') {
        dateCondition = "AND CONVERT(DATE, A.pay_date) = CONVERT(DATE, DATEADD(DAY, -1, DATEADD(HOUR, 9, GETUTCDATE())))";
      } else if (dateFilter === 'thisWeek') {
        dateCondition = "AND A.pay_date >= DATEADD(DAY, 1 - DATEPART(WEEKDAY, DATEADD(HOUR, 9, GETUTCDATE())), CONVERT(DATE, DATEADD(HOUR, 9, GETUTCDATE()))) AND A.pay_date < DATEADD(DAY, 8 - DATEPART(WEEKDAY, DATEADD(HOUR, 9, GETUTCDATE())), CONVERT(DATE, DATEADD(HOUR, 9, GETUTCDATE())))";
      } else if (dateFilter === 'lastWeek') {
        dateCondition = "AND A.pay_date >= DATEADD(DAY, -6 - DATEPART(WEEKDAY, DATEADD(HOUR, 9, GETUTCDATE())), CONVERT(DATE, DATEADD(HOUR, 9, GETUTCDATE()))) AND A.pay_date < DATEADD(DAY, 1 - DATEPART(WEEKDAY, DATEADD(HOUR, 9, GETUTCDATE())), CONVERT(DATE, DATEADD(HOUR, 9, GETUTCDATE())))";
      } else if (dateFilter === 'thisMonth') {
        dateCondition = "AND YEAR(A.pay_date) = YEAR(DATEADD(HOUR, 9, GETUTCDATE())) AND MONTH(A.pay_date) = MONTH(DATEADD(HOUR, 9, GETUTCDATE()))";
      } else if (dateFilter === 'lastMonth') {
        dateCondition = "AND YEAR(A.pay_date) = YEAR(DATEADD(MONTH, -1, DATEADD(HOUR, 9, GETUTCDATE()))) AND MONTH(A.pay_date) = MONTH(DATEADD(MONTH, -1, DATEADD(HOUR, 9, GETUTCDATE())))";
      } else {
        // 기본값: 오늘
        dateCondition = "AND CONVERT(DATE, A.pay_date) = CONVERT(DATE, DATEADD(HOUR, 9, GETUTCDATE()))";
      }
    }
    
    console.log('🔍 매출추이 조회 요청 - userId:', userId, 'dateFilter:', dateFilter, 'smartStore:', smartStore, 'coupang:', coupang, 'stores:', stores, 'startDate:', startDate, 'endDate:', endDate);
    console.log('📅 적용된 날짜 조건:', dateCondition);
    
    // 마켓 필터 조건 생성
    const isSmartStore = smartStore === 'true';
    const isCoupang = coupang === 'true';
    let marketCondition = '';
    if (isSmartStore && !isCoupang) {
      marketCondition = "AND A.market_type = 'SS'";
    } else if (!isSmartStore && isCoupang) {
      marketCondition = "AND A.market_type = 'CP'";
    } else if (!isSmartStore && !isCoupang) {
      marketCondition = "AND 1 = 0";
    }
    
    // 스토어 필터 조건 생성
    let storeCondition = '';
    if (stores && stores.trim() !== '') {
      const storeList = stores.split(',').map(s => parseInt(s.trim())).filter(s => !isNaN(s));
      if (storeList.length > 0) {
        storeCondition = `AND A.biz_idx IN (${storeList.join(',')})`;
      } else {
        storeCondition = 'AND 1 = 0';
      }
    } else {
      storeCondition = 'AND 1 = 0';
    }
    
    // 일자별 마켓별 매출액 쿼리 (취소, 반품 제외)
    const salesTrendQuery = `
      SELECT 
        CONVERT(VARCHAR(10), A.pay_date, 23) as order_date,
        A.market_type,
        SUM(CAST(A.pay_amt AS BIGINT)) as total_amount
      FROM tb_order_info A
      INNER JOIN tb_user_market_ss B
        ON A.user_id = B.user_id 
        AND A.biz_idx = B.biz_idx 
      WHERE B.user_id = @userId
      AND A.order_status NOT IN (N'CANCELED', N'RETURNED')
      ${dateCondition}
      ${marketCondition}
      ${storeCondition}
      ${SELLER_CD_LEN_FILTER}
      GROUP BY CONVERT(VARCHAR(10), A.pay_date, 23), A.market_type
      ORDER BY CONVERT(VARCHAR(10), A.pay_date, 23)
    `;
    
    const salesTrendResult = await pool.request()
      .input('userId', sql.NVarChar, userId)
      .query(salesTrendQuery);
    
    console.log('매출추이 쿼리 결과:', salesTrendResult.recordset.length, '건');
    console.log('매출추이 데이터:', salesTrendResult.recordset);
    
    res.json({
      success: true,
      data: salesTrendResult.recordset
    });
  } catch (error) {
    console.error('매출추이 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '매출추이 조회 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 주문&매출 현황 요약 API
router.get('/dashboard/summary/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { dateFilter = 'today', smartStore = 'true', coupang = 'true', stores = '', startDate, endDate } = req.query;
    
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
    
    // 마켓 필터 조건 생성
    const isSmartStore = smartStore === 'true';
    const isCoupang = coupang === 'true';
    let marketCondition = '';
    if (isSmartStore && !isCoupang) {
      marketCondition = "AND A.market_type = 'SS'";
    } else if (!isSmartStore && isCoupang) {
      marketCondition = "AND A.market_type = 'CP'";
    } else if (!isSmartStore && !isCoupang) {
      marketCondition = "AND 1 = 0";
    }
    
    // 스토어 필터 조건 생성
    let storeCondition = '';
    if (stores && stores.trim() !== '') {
      const storeList = stores.split(',').map(s => parseInt(s.trim())).filter(s => !isNaN(s));
      if (storeList.length > 0) {
        storeCondition = `AND A.biz_idx IN (${storeList.join(',')})`;
      } else {
        storeCondition = 'AND 1 = 0';
      }
    } else {
      storeCondition = 'AND 1 = 0';
    }
    
    // 총 매출 및 예상수익 쿼리 (취소, 반품 제외)
    const summaryQuery = `
      SELECT 
        SUM(CAST(A.pay_amt AS BIGINT)) as total_sales,
        SUM(ISNULL(TRY_CAST(A.pre_amt AS BIGINT), 0)) as expected_profit
      FROM tb_order_info A
      INNER JOIN tb_user_market_ss B
        ON A.user_id = B.user_id 
        AND A.biz_idx = B.biz_idx 
      WHERE B.user_id = @userId
      AND A.order_status NOT IN (N'CANCELED', N'RETURNED')
      ${dateCondition}
      ${marketCondition}
      ${storeCondition}
      ${SELLER_CD_LEN_FILTER}
    `;
    
    const summaryResult = await pool.request()
      .input('userId', sql.NVarChar, userId)
      .query(summaryQuery);
    
    console.log('주문&매출 현황 요약:', summaryResult.recordset[0]);
    
    res.json({
      success: true,
      data: summaryResult.recordset[0]
    });
  } catch (error) {
    console.error('주문&매출 현황 요약 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '주문&매출 현황 요약 조회 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 통관번호 요청 API
router.post('/customs-request', async (req, res) => {
  try {
    const { user_id, order_id, tel_no, title, ordrr_name, product_name, pay_date } = req.body;
    
    console.log('통관번호 요청 - user_id:', user_id, 'order_id:', order_id, 'tel_no:', tel_no, 'title:', title);
    
    if (!user_id || !order_id) {
      return res.status(400).json({
        success: false,
        message: '사용자ID와 주문ID는 필수입니다.'
      });
    }
    
    // title 값에 따라 저장할 title과 tpl_code 결정
    let finalTitle = '통관번호입력요청'; // 기본값 (최초 요청)
    let tplCode = 'UH_0682'; // 기본값 (최초 요청)
    
    if (title === '아직 못받음') {
      finalTitle = '미입력';
      tplCode = 'UH_0683';
    } else if (title === '잘못된 통관번호 받음') {
      finalTitle = '통관번호오류';
      tplCode = 'UH_0684';
    }
    
    const pool = await getConnection();
    
    // SQL Server의 NEWID() 함수를 직접 사용하여 GUID 생성
    await pool.request()
      .input('user_id', sql.NVarChar, user_id)
      .input('order_id', sql.NVarChar, order_id)
      .input('tel_no', sql.NVarChar, tel_no || '')
      .input('job_type', sql.NVarChar, '통관번호')
      .input('title', sql.NVarChar, finalTitle)
      .input('tpl_code', sql.NVarChar, tplCode)
      .input('param_1', sql.NVarChar, ordrr_name || '')
      .input('param_2', sql.NVarChar, product_name || '')
      .input('param_3', sql.NVarChar, pay_date || '')
      .query(`
        INSERT INTO tb_kakao_msg
          (user_id, order_id, tel_no, pccc_guid, job_type, title, tpl_code, param_1, param_2, param_3, input_date)
        VALUES
          (@user_id, @order_id, @tel_no, REPLACE(NEWID(), '-', ''), @job_type, @title, @tpl_code, @param_1, @param_2, @param_3, GETDATE())
      `);
    
    // 주문 테이블의 pccc_req_date 업데이트
    await pool.request()
      .input('order_id', sql.NVarChar, order_id)
      .query(`
        UPDATE tb_order_info
        SET pccc_req_date = GETDATE()
        WHERE order_id = @order_id
      `);
    
    console.log('통관번호 요청 완료 - order_id:', order_id, 'title:', title);
    
    res.json({
      success: true,
      message: '통관번호 요청이 완료되었습니다.'
    });
  } catch (error) {
    console.error('통관번호 요청 오류:', error);
    res.status(500).json({
      success: false,
      message: '통관번호 요청 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 매입 정보 저장 API
router.put('/:seq/purchase', async (req, res) => {
  try {
    const { seq } = req.params;
    const { taobao_order_no, taobao_pay_cn, taobao_pay_kr, delv_order_no, delv_price } = req.body;
    
    console.log('매입 정보 저장 - seq:', seq, 'taobao_order_no:', taobao_order_no, 'taobao_pay_cn:', taobao_pay_cn);
    
    if (!taobao_order_no || !taobao_pay_cn) {
      return res.status(400).json({
        success: false,
        message: '타오바오 주문번호와 결제금액은 필수입니다.'
      });
    }
    
    const pool = await getConnection();
    
    await pool.request()
      .input('seq', sql.Int, seq)
      .input('taobao_order_no', sql.NVarChar, taobao_order_no)
      .input('taobao_pay_cn', sql.Decimal(18, 2), taobao_pay_cn)
      .input('taobao_pay_kr', sql.Decimal(18, 2), taobao_pay_kr)
      .input('delv_order_no', sql.NVarChar, delv_order_no || null)
      .input('delv_price', sql.Decimal(18, 2), delv_price || null)
      .query(`
        UPDATE tb_order_info
        SET taobao_order_no = @taobao_order_no,
            taobao_pay_cn = @taobao_pay_cn,
            taobao_pay_kr = @taobao_pay_kr,
            delv_order_no = @delv_order_no,
            delv_price = @delv_price
        WHERE seq = @seq
      `);
    
    console.log('매입 정보 저장 완료 - seq:', seq);
    
    res.json({
      success: true,
      message: '매입 정보가 저장되었습니다.'
    });
    
  } catch (error) {
    console.error('매입 정보 저장 오류:', error);
    res.status(500).json({
      success: false,
      message: '매입 정보 저장 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

module.exports = router;
