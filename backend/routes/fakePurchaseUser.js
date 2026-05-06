// 가구매 사용자관리 API 라우트
const express = require('express');
const router = express.Router();
const { getConnection, sql } = require('../config/database');

// 가구매 사용자 목록 조회
router.get('/', async (req, res) => {
  try {
    const query = `
      SELECT 
        A.user_id
      , A.user_name 
      , A.user_type 
      , B.biz_idx 
      , B.store_name 
      , B.ga_buy_cnt 
      , COUNT(C.user_id) as prod_cnt
      , D.grp_name
      FROM tb_user A
      INNER JOIN tb_user_market_ss B
              ON A.user_id = B.user_id
      LEFT OUTER JOIN tb_ga_product_user C
              ON B.user_id = C.user_id 
              AND B.biz_idx = C.biz_idx
      LEFT OUTER JOIN tb_ga_date_grp D
              ON B.ga_grp_seq = D.seq
      WHERE B.ga_buy_yn = 'Y'   
      GROUP BY  
        A.user_id
      , A.user_name 
      , A.user_type 
      , B.biz_idx 
      , B.store_name 
      , B.ga_buy_cnt 
      , D.grp_name
      ORDER BY A.user_name
    `;

    console.log('가구매 사용자 목록 조회 쿼리 실행');
    
    const pool = await getConnection();
    const result = await pool.request().query(query);
    
    console.log('가구매 사용자 목록 결과:', result.recordset.length, '건');
    
    res.json({
      success: true,
      data: result.recordset
    });
  } catch (error) {
    console.error('가구매 사용자 목록 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '가구매 사용자 목록 조회 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

module.exports = router;
