// 금지어관리 API 라우트
const express = require('express');
const router = express.Router();
const { getConnection, sql } = require('../config/database');

// 금지어 목록 조회 (페이징 지원)
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 20, keyword = '' } = req.query;
    const offset = (page - 1) * limit;

    const pool = await getConnection();

    // 검색 조건
    let whereClause = '';
    if (keyword) {
      whereClause = `WHERE no_word LIKE @keyword`;
    }

    // 전체 개수 조회
    const countQuery = `
      SELECT COUNT(*) as total
      FROM tb_no_word
      ${whereClause}
    `;

    const countRequest = pool.request();
    if (keyword) {
      countRequest.input('keyword', sql.NVarChar, `%${keyword}%`);
    }
    const countResult = await countRequest.query(countQuery);
    const total = countResult.recordset[0].total;

    // 목록 조회
    const listQuery = `
      SELECT 
        seq,
        no_word,
        gubun,
        apply_ym,
        word_type,
        use_yn,
        input_date
      FROM tb_no_word
      ${whereClause}
      ORDER BY seq DESC
      OFFSET @offset ROWS
      FETCH NEXT @limit ROWS ONLY
    `;

    const listRequest = pool.request();
    if (keyword) {
      listRequest.input('keyword', sql.NVarChar, `%${keyword}%`);
    }
    listRequest.input('offset', sql.Int, offset);
    listRequest.input('limit', sql.Int, parseInt(limit));

    const listResult = await listRequest.query(listQuery);

    res.json({
      success: true,
      data: listResult.recordset,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('금지어 목록 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '금지어 목록 조회 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 금지어 상세 조회
router.get('/:seq', async (req, res) => {
  try {
    const { seq } = req.params;
    const pool = await getConnection();

    const query = `
      SELECT 
        seq,
        no_word,
        gubun,
        apply_ym,
        word_type,
        use_yn,
        input_date
      FROM tb_no_word
      WHERE seq = @seq
    `;

    const request = pool.request();
    request.input('seq', sql.Int, seq);
    const result = await request.query(query);

    if (result.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: '금지어를 찾을 수 없습니다.'
      });
    }

    res.json({
      success: true,
      data: result.recordset[0]
    });
  } catch (error) {
    console.error('금지어 상세 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '금지어 상세 조회 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 금지어 추가
router.post('/', async (req, res) => {
  try {
    const { no_word, word_type, apply_ym, use_yn = 'Y' } = req.body;

    if (!no_word) {
      return res.status(400).json({
        success: false,
        message: '금지어를 입력해주세요.'
      });
    }

    // word_type에 따라 gubun 값 설정
    let gubun = null;
    if (word_type === '수집제외') {
      gubun = '1';
    } else if (word_type === '제품명제외') {
      gubun = '2';
    }

    const pool = await getConnection();

    // 중복 체크
    const checkQuery = `
      SELECT COUNT(*) as count
      FROM tb_no_word
      WHERE no_word = @no_word
    `;

    const checkRequest = pool.request();
    checkRequest.input('no_word', sql.NVarChar, no_word);
    const checkResult = await checkRequest.query(checkQuery);

    if (checkResult.recordset[0].count > 0) {
      return res.status(400).json({
        success: false,
        message: '이미 등록된 금지어입니다.'
      });
    }

    // 금지어 추가
    const insertQuery = `
      INSERT INTO tb_no_word (no_word, gubun, apply_ym, word_type, use_yn, input_date)
      VALUES (@no_word, @gubun, @apply_ym, @word_type, @use_yn, GETDATE())
    `;

    const insertRequest = pool.request();
    insertRequest.input('no_word', sql.NVarChar, no_word);
    insertRequest.input('gubun', sql.NVarChar, gubun);
    insertRequest.input('apply_ym', sql.NVarChar, apply_ym || null);
    insertRequest.input('word_type', sql.NVarChar, word_type || null);
    insertRequest.input('use_yn', sql.NVarChar, use_yn);

    await insertRequest.query(insertQuery);

    res.json({
      success: true,
      message: '금지어가 추가되었습니다.'
    });
  } catch (error) {
    console.error('금지어 추가 오류:', error);
    res.status(500).json({
      success: false,
      message: '금지어 추가 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 금지어 수정
router.put('/:seq', async (req, res) => {
  try {
    const { seq } = req.params;
    const { no_word, word_type, apply_ym, use_yn } = req.body;

    if (!no_word) {
      return res.status(400).json({
        success: false,
        message: '금지어를 입력해주세요.'
      });
    }

    // word_type에 따라 gubun 값 설정
    let gubun = null;
    if (word_type === '수집제외') {
      gubun = '1';
    } else if (word_type === '제품명제외') {
      gubun = '2';
    }

    const pool = await getConnection();

    // 중복 체크 (자신 제외)
    const checkQuery = `
      SELECT COUNT(*) as count
      FROM tb_no_word
      WHERE no_word = @no_word AND seq != @seq
    `;

    const checkRequest = pool.request();
    checkRequest.input('no_word', sql.NVarChar, no_word);
    checkRequest.input('seq', sql.Int, seq);
    const checkResult = await checkRequest.query(checkQuery);

    if (checkResult.recordset[0].count > 0) {
      return res.status(400).json({
        success: false,
        message: '이미 등록된 금지어입니다.'
      });
    }

    // 금지어 수정
    const updateQuery = `
      UPDATE tb_no_word
      SET no_word = @no_word,
          gubun = @gubun,
          apply_ym = @apply_ym,
          word_type = @word_type,
          use_yn = @use_yn
      WHERE seq = @seq
    `;

    const updateRequest = pool.request();
    updateRequest.input('seq', sql.Int, seq);
    updateRequest.input('no_word', sql.NVarChar, no_word);
    updateRequest.input('gubun', sql.NVarChar, gubun);
    updateRequest.input('apply_ym', sql.NVarChar, apply_ym || null);
    updateRequest.input('word_type', sql.NVarChar, word_type || null);
    updateRequest.input('use_yn', sql.NVarChar, use_yn);

    const result = await updateRequest.query(updateQuery);

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({
        success: false,
        message: '금지어를 찾을 수 없습니다.'
      });
    }

    res.json({
      success: true,
      message: '금지어가 수정되었습니다.'
    });
  } catch (error) {
    console.error('금지어 수정 오류:', error);
    res.status(500).json({
      success: false,
      message: '금지어 수정 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 금지어 삭제
router.delete('/:seq', async (req, res) => {
  try {
    const { seq } = req.params;
    const pool = await getConnection();

    const deleteQuery = `
      DELETE FROM tb_no_word
      WHERE seq = @seq
    `;

    const request = pool.request();
    request.input('seq', sql.Int, seq);
    const result = await request.query(deleteQuery);

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({
        success: false,
        message: '금지어를 찾을 수 없습니다.'
      });
    }

    res.json({
      success: true,
      message: '금지어가 삭제되었습니다.'
    });
  } catch (error) {
    console.error('금지어 삭제 오류:', error);
    res.status(500).json({
      success: false,
      message: '금지어 삭제 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

module.exports = router;
