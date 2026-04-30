// 삭제상품관리 관련 API 라우트
const express = require('express');
const router = express.Router();
const { getConnection, sql } = require('../config/database');

// 삭제상품 목록 조회 API
router.get('/', async (req, res) => {
  try {
    console.log('🗑️ 삭제상품 목록 조회 API 호출됨');
    const pool = await getConnection();
    const result = await pool.request()
      .query(`
        SELECT 
          A.seq,
          A.user_id,
          D.user_name,
          A.gu_seq,
          A.del_reason,
          A.del_yn,
          A.del_type,
          A.del_date,
          A.input_date,
          B.gm_seq,
          B.good_name,
          ('https://c1b.co.kr/CDN/' + C.base_folder + '/' + C.item_id + '/' + C.main_img_url) AS img_url
        FROM tb_del_request A
        INNER JOIN tb_good_user B
                ON A.gu_seq = B.seq 
        INNER JOIN tb_good_master C
                ON B.gm_seq = C.seq 
        INNER JOIN tb_user D
                ON A.user_id = D.user_id
        ORDER BY A.seq DESC
      `);
    
    console.log('🗑️ 삭제상품 목록 조회 결과:', result.recordset.length, '건');
    if (result.recordset.length > 0) {
      console.log('🗑️ 첫 번째 레코드 날짜 샘플:', {
        input_date: result.recordset[0].input_date,
        del_date: result.recordset[0].del_date
      });
    }
    
    res.json({
      success: true,
      data: result.recordset
    });
  } catch (error) {
    console.error('🗑️ 삭제상품 목록 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '삭제상품 목록 조회 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 삭제상품 단건 삭제 처리 API
router.put('/:seq', async (req, res) => {
  try {
    const { seq } = req.params;
    
    const pool = await getConnection();
    
    await pool.request()
      .input('seq', sql.Int, seq)
      .query(`
        UPDATE tb_del_request
        SET del_yn = 'Y'
        WHERE seq = @seq
      `);
    
    res.json({
      success: true,
      message: '삭제 처리되었습니다.'
    });
  } catch (error) {
    console.error('삭제 처리 오류:', error);
    res.status(500).json({
      success: false,
      message: '삭제 처리 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 전체 삭제 요청 API
router.post('/delete-all', async (req, res) => {
  try {
    const { seq } = req.body;
    
    if (!seq) {
      return res.status(400).json({
        success: false,
        message: '상품 SEQ가 필요합니다.'
      });
    }
    
    const pool = await getConnection();
    
    // 먼저 해당 seq의 gu_seq를 조회
    const seqResult = await pool.request()
      .input('seq', sql.Int, seq)
      .query(`
        SELECT gu_seq FROM tb_del_request WHERE seq = @seq
      `);
    
    if (seqResult.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: '해당 상품을 찾을 수 없습니다.'
      });
    }
    
    const guSeq = seqResult.recordset[0].gu_seq;
    
    // 같은 gu_seq를 가진 모든 레코드 업데이트
    await pool.request()
      .input('guSeq', sql.Int, guSeq)
      .query(`
        UPDATE tb_del_request
        SET 
          input_date = GETDATE(),
          del_date = NULL,
          del_type = N'일괄삭제',
          del_yn = 'N'
        WHERE gu_seq = @guSeq
      `);
    
    res.json({
      success: true,
      message: '전체 삭제 요청이 처리되었습니다.'
    });
  } catch (error) {
    console.error('전체 삭제 요청 오류:', error);
    res.status(500).json({
      success: false,
      message: '전체 삭제 요청 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

module.exports = router;
