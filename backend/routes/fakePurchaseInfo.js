// 가구매정보 API 라우트
const express = require('express');
const router = express.Router();
const { getConnection, sql } = require('../config/database');

// 가구매정보 목록 조회
router.get('/', async (req, res) => {
  try {
    const { userId, orderDate, userName, storeName, mainOrderId, orderId, productName, ordrr_name, invo_no } = req.query;

    let query = `
      SELECT 
          CAST(pay_date AS date) AS order_date 
        , A.user_id
        , C.user_name 
        , B.store_name 
        , B.ga_grp_seq 
        , D.grp_name
        , B.ga_buy_idx
        , A.main_order_id
        , A.order_id
        , A.product_name 
        , A.ordrr_name
        , A.biz_idx
        , A.recvr_name
        , A.pay_date 
        , A.dispatch_date
        , A.purch_decided_date
        , A.ga_buy_chk_date 
        , A.invo_no 
        , A.ga_invo_no
      FROM tb_order_info A
      INNER JOIN tb_user_market_ss B
              ON A.user_id = B.user_id 
              AND A.biz_idx = B.biz_idx 
      INNER JOIN tb_user C
              ON A.user_id = C.user_id 
      INNER JOIN tb_ga_date_grp D
              ON B.ga_grp_seq = D.seq 
      WHERE 1=1
      AND A.buy_type = '가구매'
      AND A.ga_buy_chk_date IS NOT NULL
      AND A.order_status != 'CANCELED'
      AND A.order_status != 'RETURNED'
    `;

    // 사용자 ID 필터가 있는 경우
    if (userId) {
      query += ` AND A.user_id = @userId`;
    }

    // 주문일자 필터가 있는 경우
    if (orderDate) {
      query += ` AND CAST(A.pay_date AS date) = @orderDate`;
    }

    // 사용자명 필터
    if (userName) {
      query += ` AND C.user_name LIKE @userName`;
    }

    // 스토어명 필터
    if (storeName) {
      query += ` AND B.store_name LIKE @storeName`;
    }

    // 주문번호 필터
    if (mainOrderId) {
      query += ` AND A.main_order_id LIKE @mainOrderId`;
    }

    // 상품주문번호 필터
    if (orderId) {
      query += ` AND A.order_id LIKE @orderId`;
    }

    // 상품명 필터
    if (productName) {
      query += ` AND A.product_name LIKE @productName`;
    }

    // 구매자 필터
    if (ordrr_name) {
      query += ` AND A.ordrr_name LIKE @ordrr_name`;
    }

    // 송장번호 필터
    if (invo_no) {
      query += ` AND A.invo_no LIKE @invo_no`;
    }

    query += ` ORDER BY CAST(pay_date AS date) DESC , B.ga_buy_idx ASC, A.biz_idx ASC, C.user_name ASC, A.ordrr_name ASC`;

    console.log('가구매정보 목록 조회 쿼리 실행, 필터:', { userId, orderDate, userName, storeName, mainOrderId, orderId, productName, ordrr_name, invo_no });
    console.log('실행 쿼리:\n', query);
    
    const pool = await getConnection();
    const request = pool.request();
    
    if (userId) {
      request.input('userId', sql.NVarChar, userId);
    }
    if (orderDate) {
      request.input('orderDate', sql.Date, orderDate);
    }
    if (userName) {
      request.input('userName', sql.NVarChar, `%${userName}%`);
    }
    if (storeName) {
      request.input('storeName', sql.NVarChar, `%${storeName}%`);
    }
    if (mainOrderId) {
      request.input('mainOrderId', sql.NVarChar, `%${mainOrderId}%`);
    }
    if (orderId) {
      request.input('orderId', sql.NVarChar, `%${orderId}%`);
    }
    if (productName) {
      request.input('productName', sql.NVarChar, `%${productName}%`);
    }
    if (ordrr_name) {
      request.input('ordrr_name', sql.NVarChar, `%${ordrr_name}%`);
    }
    if (invo_no) {
      request.input('invo_no', sql.NVarChar, `%${invo_no}%`);
    }
    
    const result = await request.query(query);
    
    console.log('쿼리 실행 완료, 결과:', result.recordset.length, '건');
    
    res.json({
      success: true,
      data: result.recordset
    });
  } catch (error) {
    console.error('가구매정보 목록 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '가구매정보 목록 조회 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

module.exports = router;
