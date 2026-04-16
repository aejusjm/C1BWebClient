// 배치로그관리 관련 API 라우트
const express = require('express');
const router = express.Router();
const { getConnection, sql } = require('../config/database');

// 배치로그 목록 조회 API
router.get('/', async (req, res) => {
  try {
    console.log('📋 배치로그 목록 조회 API 호출됨');
    const pool = await getConnection();
    const result = await pool.request()
      .query(`
        SELECT 
          A.seq,
          A.start_date,
          A.end_date,
          DATEDIFF(SECOND, A.start_date, A.end_date) AS run_time,
          A.user_id,
          B.user_name,
          A.biz_idx,
          A.get_cnt,
          A.result_msg
        FROM tb_batch_log A       
        INNER JOIN tb_user B
                ON A.user_id = B.user_id
        ORDER BY A.start_date DESC
      `);
    
    console.log('📋 배치로그 목록 조회 결과:', result.recordset.length, '건');
    if (result.recordset.length > 0) {
      console.log('📋 첫 번째 레코드 날짜 샘플:', {
        start_date: result.recordset[0].start_date,
        end_date: result.recordset[0].end_date,
        run_time: result.recordset[0].run_time
      });
    }
    
    res.json({
      success: true,
      data: result.recordset
    });
  } catch (error) {
    console.error('📋 배치로그 목록 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '배치로그 목록 조회 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

module.exports = router;
