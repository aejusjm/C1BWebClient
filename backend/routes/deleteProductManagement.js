// 삭제상품관리 관련 API 라우트
const express = require('express');
const router = express.Router();
const { getConnection, sql } = require('../config/database');

// 삭제상품 목록 조회 API
router.get('/', async (req, res) => {
  try {
    const { delType, productName, userKeyword, cohortSeq } = req.query;
    
    console.log('🗑️ 삭제상품 목록 조회 API 호출됨, delType:', delType, 'productName:', productName, 'userKeyword:', userKeyword, 'cohortSeq:', cohortSeq);
    
    let delTypeCondition = '';
    if (delType) {
      delTypeCondition = `AND A.del_type = N'${delType}'`;
    }

    let productNameCondition = '';
    let userCondition = '';
    let cohortCondition = '';
    const pool = await getConnection();
    const request = pool.request();
    if (productName && String(productName).trim()) {
      productNameCondition = 'AND B.good_name LIKE @productName';
      request.input('productName', sql.NVarChar, `%${String(productName).trim()}%`);
    }
    if (userKeyword && String(userKeyword).trim()) {
      userCondition = 'AND (A.user_id LIKE @userKeyword OR D.user_name LIKE @userKeyword)';
      request.input('userKeyword', sql.NVarChar, `%${String(userKeyword).trim()}%`);
    }
    if (cohortSeq !== undefined && cohortSeq !== null && String(cohortSeq).trim() !== '') {
      const parsedCohortSeq = parseInt(String(cohortSeq), 10);
      if (Number.isFinite(parsedCohortSeq)) {
        cohortCondition = 'AND D.cohort_seq = @cohortSeq';
        request.input('cohortSeq', sql.Int, parsedCohortSeq);
      }
    }
    
    const result = await request
      .query(`
        SELECT 
          A.seq,
          A.user_id,
          D.user_name,
          A.gu_seq,
          A.del_reason,
          A.del_yn,
          A.del_type,
          A.del_confirm,
          A.del_date,
          A.input_date,
          B.gm_seq,
          B.good_name,
          ('https://c1b.co.kr/CDN/' + C.base_folder + '/' + C.item_id + '/' + C.main_img_url) AS img_url,
          CASE 
            WHEN EXISTS (
              SELECT 1 
              FROM tb_del_request 
              WHERE dr_seq = A.seq
            ) THEN 1 
            ELSE 0 
          END AS has_child_requests
        FROM tb_del_request A
        INNER JOIN tb_good_user B
                ON A.gu_seq = B.seq 
        INNER JOIN tb_good_master C
                ON B.gm_seq = C.seq 
        INNER JOIN tb_user D
                ON A.user_id = D.user_id
        WHERE 1=1
        ${delTypeCondition}
        ${productNameCondition}
        ${userCondition}
        ${cohortCondition}
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

// 삭제확인 처리 API
router.put('/:seq/confirm', async (req, res) => {
  try {
    const { seq } = req.params;

    const pool = await getConnection();

    await pool.request()
      .input('seq', sql.Int, seq)
      .query(`
        UPDATE tb_del_request
        SET del_confirm = 'Y'
        WHERE seq = @seq
      `);

    res.json({
      success: true,
      message: '삭제확인 처리되었습니다.'
    });
  } catch (error) {
    console.error('삭제확인 처리 오류:', error);
    res.status(500).json({
      success: false,
      message: '삭제확인 처리 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 삭제확인 취소 API
router.put('/:seq/cancel-confirm', async (req, res) => {
  try {
    const { seq } = req.params;

    const pool = await getConnection();

    const result = await pool.request()
      .input('seq', sql.Int, seq)
      .query(`
        UPDATE tb_del_request
        SET del_confirm = 'N'
        WHERE seq = @seq
          AND del_confirm = 'Y'
          AND del_date IS NULL
      `);

    if (result.rowsAffected[0] === 0) {
      return res.status(400).json({
        success: false,
        message: '확인취소할 수 없습니다. 삭제일자가 있는 경우 확인취소가 불가합니다.'
      });
    }

    res.json({
      success: true,
      message: '삭제확인이 취소되었습니다.'
    });
  } catch (error) {
    console.error('삭제확인 취소 오류:', error);
    res.status(500).json({
      success: false,
      message: '삭제확인 취소 중 오류가 발생했습니다.',
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
    
    console.log('🗑️ 전체 삭제 요청 - seq:', seq);
    
    const pool = await getConnection();
    
    // 제공된 쿼리를 사용하여 전체 삭제 요청 추가
    const insertQuery = `
      INSERT INTO tb_del_request (user_id, gu_seq, biz_idx, del_reason, del_type, dr_seq) 
      SELECT 
           user_id 
         , seq
         , biz_idx 
         , N'판매금지상품'
         , N'일괄삭제'
         , @seq
      FROM tb_good_user 
      WHERE gm_seq IN 
      (
        SELECT gm_seq
        FROM tb_del_request a 
        INNER JOIN tb_good_user b
                ON a.gu_seq = b.seq 
        WHERE a.seq = @seq
      )
      AND seq NOT IN (
        SELECT gu_seq 
        FROM tb_del_request 
        WHERE del_yn = 'N'
      )
    `;
    
    const result = await pool.request()
      .input('seq', sql.Int, seq)
      .query(insertQuery);
    
    console.log('🗑️ 전체 삭제 요청 완료 - 추가된 레코드 수:', result.rowsAffected[0]);

    // 전체삭제 요청 시 해당 항목의 삭제확인도 함께 처리
    await pool.request()
      .input('seq', sql.Int, seq)
      .query(`
        UPDATE tb_del_request
        SET del_confirm = 'Y'
        WHERE seq = @seq
      `);

    console.log('🗑️ 삭제확인 처리 완료 - seq:', seq);
    
    // tb_good_master 테이블 업데이트
    const updateMasterQuery = `
      UPDATE tb_good_master
      SET use_yn = 'N'
        , del_yn = 'Y'
      WHERE seq IN 
      (
        SELECT gm_seq
        FROM tb_del_request a 
        INNER JOIN tb_good_user b
                ON a.gu_seq = b.seq 
        WHERE a.seq = @seq
      )
    `;
    
    const updateResult = await pool.request()
      .input('seq', sql.Int, seq)
      .query(updateMasterQuery);
    
    console.log('🗑️ tb_good_master 업데이트 완료 - 영향받은 레코드 수:', updateResult.rowsAffected[0]);
    
    res.json({
      success: true,
      message: `전체 삭제 요청이 처리되었습니다. (${result.rowsAffected[0]}개 추가)`,
      count: result.rowsAffected[0]
    });
  } catch (error) {
    console.error('🗑️ 전체 삭제 요청 오류:', error);
    res.status(500).json({
      success: false,
      message: '전체 삭제 요청 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

module.exports = router;
