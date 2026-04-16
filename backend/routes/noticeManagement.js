// 공지관리 관련 API 라우트 
const express = require('express');
const router = express.Router();
const { getConnection, sql } = require('../config/database');

// 공지 목록 조회 API (페이징)
router.get('/list', async (req, res) => {
  try {
    const { page = 1, limit = 5 } = req.query;
    
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    
    const pool = await getConnection();
    
    // 전체 카운트
    const countResult = await pool.request()
      .query(`SELECT COUNT(*) as total FROM tb_notice WHERE use_yn = 'Y'`);
    
    const totalCount = countResult.recordset[0].total;
    
    // 고정 공지 조회
    const fixedResult = await pool.request()
      .query(`
        SELECT 
          seq, gubun, title, contents, fix_yn, notice_type,
          popup_yn, input_date, use_yn, update_date
        FROM tb_notice
        WHERE use_yn = 'Y' AND fix_yn = 'Y'
        ORDER BY input_date DESC, seq DESC
      `);
    
    const fixedNotices = fixedResult.recordset;
    const fixedCount = fixedNotices.length;
    
    console.log('고정 공지 개수:', fixedCount);
    console.log('요청된 limit:', limitNum);
    
    // 일반 공지 조회 (limit에서 고정 공지 개수만큼 빼기)
    const remainingLimit = limitNum - fixedCount;
    console.log('일반 공지 가져올 개수:', remainingLimit);
    let normalNotices = [];
    
    if (remainingLimit > 0) {
      const normalResult = await pool.request()
        .input('limit', sql.Int, remainingLimit)
        .query(`
          SELECT 
            seq, gubun, title, contents, fix_yn, notice_type,
            popup_yn, input_date, use_yn, update_date
          FROM tb_notice
          WHERE use_yn = 'Y' AND (fix_yn = 'N' OR fix_yn IS NULL)
          ORDER BY input_date DESC, seq DESC
          OFFSET 0 ROWS
          FETCH NEXT @limit ROWS ONLY
        `);
      
      normalNotices = normalResult.recordset;
      console.log('일반 공지 조회 결과:', normalNotices.length, '개');
    }
    
    // 고정 공지 + 일반 공지 합치기
    const combinedNotices = [...fixedNotices, ...normalNotices];
    
    console.log('최종 공지 개수:', combinedNotices.length);
    console.log('고정:', fixedCount, '일반:', normalNotices.length);
    
    res.json({
      success: true,
      data: combinedNotices,
      pagination: {
        currentPage: pageNum,
        pageSize: limitNum,
        totalCount: totalCount,
        totalPages: Math.ceil(totalCount / limitNum)
      }
    });
  } catch (error) {
    console.error('공지 목록 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '공지 목록 조회 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 공지 전체 목록 조회 API (관리자용)
router.get('/', async (req, res) => {
  try {
    const pool = await getConnection();
    const result = await pool.request()
      .query(`
        SELECT 
          seq, gubun, title, contents, fix_yn, notice_type,
          popup_yn, input_date, use_yn, update_date
        FROM tb_notice
        ORDER BY fix_yn DESC, input_date DESC, seq DESC
      `);
    
    res.json({
      success: true,
      data: result.recordset
    });
  } catch (error) {
    console.error('공지 목록 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '공지 목록 조회 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 팝업 공지 조회 API (/:seq보다 먼저 정의되어야 함)
router.get('/popup', async (req, res) => {
  try {
    console.log('🔔 팝업 공지 조회 API 호출됨');
    const pool = await getConnection();
    
    const result = await pool.request()
      .query(`
        SELECT 
          seq, gubun, title, contents, fix_yn, notice_type,
          popup_yn, input_date, use_yn, update_date
        FROM tb_notice
        WHERE use_yn = 'Y' AND popup_yn = 'Y'
        ORDER BY input_date DESC, seq DESC
      `);
    
    console.log('🔔 팝업 공지 조회 결과:', result.recordset.length, '건');
    if (result.recordset.length > 0) {
      console.log('🔔 팝업 공지 목록:', result.recordset.map(n => ({ seq: n.seq, title: n.title, popup_yn: n.popup_yn, use_yn: n.use_yn })));
    }
    
    res.json({
      success: true,
      data: result.recordset
    });
  } catch (error) {
    console.error('🔔 팝업 공지 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '팝업 공지 조회 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 특정 공지 조회 API
router.get('/:seq', async (req, res) => {
  try {
    const { seq } = req.params;
    
    const pool = await getConnection();
    const result = await pool.request()
      .input('seq', sql.Int, seq)
      .query(`
        SELECT 
          seq, gubun, title, contents, fix_yn, notice_type,
          popup_yn, input_date, use_yn, update_date
        FROM tb_notice
        WHERE seq = @seq
      `);
    
    if (result.recordset.length > 0) {
      res.json({
        success: true,
        data: result.recordset[0]
      });
    } else {
      res.status(404).json({
        success: false,
        message: '공지를 찾을 수 없습니다.'
      });
    }
  } catch (error) {
    console.error('공지 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '공지 조회 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 공지 추가 API
router.post('/', async (req, res) => {
  try {
    const {
      gubun, title, contents, fix_yn, notice_type,
      popup_yn, use_yn
    } = req.body;
    
    const pool = await getConnection();
    
    // seq는 IDENTITY 컬럼으로 자동 증가되므로 INSERT에서 제외
    const result = await pool.request()
      .input('gubun', sql.NVarChar, gubun)
      .input('title', sql.NVarChar, title)
      .input('contents', sql.NVarChar, contents)
      .input('fix_yn', sql.NVarChar, fix_yn || 'N')
      .input('notice_type', sql.NVarChar, notice_type)
      .input('popup_yn', sql.NVarChar, popup_yn || 'N')
      .input('use_yn', sql.NVarChar, use_yn || 'Y')
      .query(`
        INSERT INTO tb_notice (gubun, title, contents, fix_yn, notice_type, popup_yn, use_yn, input_date)
        VALUES (@gubun, @title, @contents, @fix_yn, @notice_type, @popup_yn, @use_yn, GETDATE());
        SELECT SCOPE_IDENTITY() AS seq;
      `);
    
    const newSeq = result.recordset[0].seq;
    
    res.json({
      success: true,
      message: '공지가 등록되었습니다.',
      seq: newSeq
    });
  } catch (error) {
    console.error('공지 추가 오류:', error);
    res.status(500).json({
      success: false,
      message: '공지 추가 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 공지 수정 API
router.put('/:seq', async (req, res) => {
  try {
    const { seq } = req.params;
    const {
      gubun, title, contents, fix_yn, notice_type,
      popup_yn, use_yn
    } = req.body;
    
    const pool = await getConnection();
    
    await pool.request()
      .input('seq', sql.Int, seq)
      .input('gubun', sql.NVarChar, gubun)
      .input('title', sql.NVarChar, title)
      .input('contents', sql.NVarChar, contents)
      .input('fix_yn', sql.NVarChar, fix_yn)
      .input('notice_type', sql.NVarChar, notice_type)
      .input('popup_yn', sql.NVarChar, popup_yn)
      .input('use_yn', sql.NVarChar, use_yn)
      .query(`
        UPDATE tb_notice
        SET 
          gubun = @gubun,
          title = @title,
          contents = @contents,
          fix_yn = @fix_yn,
          notice_type = @notice_type,
          popup_yn = @popup_yn,
          use_yn = @use_yn,
          update_date = GETDATE()
        WHERE seq = @seq
      `);
    
    res.json({
      success: true,
      message: '공지가 수정되었습니다.'
    });
  } catch (error) {
    console.error('공지 수정 오류:', error);
    res.status(500).json({
      success: false,
      message: '공지 수정 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 공지 삭제 API
router.delete('/:seq', async (req, res) => {
  try {
    const { seq } = req.params;
    
    const pool = await getConnection();
    
    await pool.request()
      .input('seq', sql.Int, seq)
      .query('DELETE FROM tb_notice WHERE seq = @seq');
    
    res.json({
      success: true,
      message: '공지가 삭제되었습니다.'
    });
  } catch (error) {
    console.error('공지 삭제 오류:', error);
    res.status(500).json({
      success: false,
      message: '공지 삭제 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

module.exports = router;
