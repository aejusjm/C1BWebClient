// 공지관리 관련 API 라우트 
const express = require('express');
const router = express.Router();
const { getConnection, sql } = require('../config/database');

let noticeTableReady = false;

async function ensureNoticeTable(pool) {
  if (noticeTableReady) return;
  await pool.request().query(`
    IF COL_LENGTH('tb_notice', 'contents') IS NOT NULL
    BEGIN
      DECLARE @contentsType NVARCHAR(128);
      SELECT @contentsType = DATA_TYPE + CASE
        WHEN CHARACTER_MAXIMUM_LENGTH IS NULL THEN '(max)'
        WHEN CHARACTER_MAXIMUM_LENGTH = -1 THEN '(max)'
        ELSE '(' + CAST(CHARACTER_MAXIMUM_LENGTH AS VARCHAR(20)) + ')'
      END
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'tb_notice' AND COLUMN_NAME = 'contents';

      IF @contentsType NOT IN ('nvarchar(max)', 'ntext')
        ALTER TABLE tb_notice ALTER COLUMN contents NVARCHAR(MAX) NULL;
    END
  `);
  noticeTableReady = true;
}

function normalizeNoticePayload(body = {}) {
  return {
    gubun: String(body.gubun || '').trim() || null,
    title: String(body.title || '').trim(),
    contents: String(body.contents || ''),
    fix_yn: String(body.fix_yn || 'N').trim() || 'N',
    notice_type: String(body.notice_type || '').trim() || null,
    popup_yn: String(body.popup_yn || 'N').trim() || 'N',
    use_yn: String(body.use_yn || 'Y').trim() || 'Y'
  };
}

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
    await ensureNoticeTable(pool);
    
    // seq는 IDENTITY 컬럼으로 자동 증가되므로 INSERT에서 제외
    const payload = normalizeNoticePayload(req.body);
    if (!payload.title || !payload.contents) {
      return res.status(400).json({
        success: false,
        message: '제목과 내용을 입력해주세요.'
      });
    }

    const result = await pool.request()
      .input('gubun', sql.NVarChar, payload.gubun)
      .input('title', sql.NVarChar, payload.title)
      .input('contents', sql.NVarChar(sql.MAX), payload.contents)
      .input('fix_yn', sql.NVarChar, payload.fix_yn)
      .input('notice_type', sql.NVarChar, payload.notice_type)
      .input('popup_yn', sql.NVarChar, payload.popup_yn)
      .input('use_yn', sql.NVarChar, payload.use_yn)
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
    const message = String(error.message || '');
    const isTruncate = message.includes('truncated');
    res.status(500).json({
      success: false,
      message: isTruncate
        ? '공지 내용이 너무 깁니다. 내용 길이를 줄여주세요.'
        : '공지 추가 중 오류가 발생했습니다.',
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
    await ensureNoticeTable(pool);

    const payload = normalizeNoticePayload(req.body);
    if (!payload.title || !payload.contents) {
      return res.status(400).json({
        success: false,
        message: '제목과 내용을 입력해주세요.'
      });
    }
    
    await pool.request()
      .input('seq', sql.Int, seq)
      .input('gubun', sql.NVarChar, payload.gubun)
      .input('title', sql.NVarChar, payload.title)
      .input('contents', sql.NVarChar(sql.MAX), payload.contents)
      .input('fix_yn', sql.NVarChar, payload.fix_yn)
      .input('notice_type', sql.NVarChar, payload.notice_type)
      .input('popup_yn', sql.NVarChar, payload.popup_yn)
      .input('use_yn', sql.NVarChar, payload.use_yn)
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
