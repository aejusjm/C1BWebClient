// 가구매 일정관리 API 라우트
const express = require('express');
const router = express.Router();
const { getConnection, sql } = require('../config/database');

// 가구매그룹 목록 조회
router.get('/groups', async (req, res) => {
  try {
    const query = `
      SELECT 
        seq,
        grp_name,
        use_yn
      FROM tb_ga_date_grp
      WHERE use_yn = 'Y'
      ORDER BY seq
    `;

    console.log('가구매그룹 목록 조회 쿼리 실행');
    
    const pool = await getConnection();
    const result = await pool.request().query(query);
    
    console.log('가구매그룹 목록 결과:', result.recordset.length, '건');
    
    res.json({
      success: true,
      data: result.recordset
    });
  } catch (error) {
    console.error('가구매그룹 목록 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '가구매그룹 목록 조회 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 월별 가구매 일정 조회
router.get('/', async (req, res) => {
  try {
    const { year, month } = req.query;
    
    if (!year || !month) {
      return res.status(400).json({
        success: false,
        message: 'year와 month 파라미터가 필요합니다.'
      });
    }

    const query = `
      SELECT 
        A.seq,
        A.grp_seq,
        A.buy_date,
        A.use_yn,
        B.grp_name
      FROM tb_ga_date A
      INNER JOIN tb_ga_date_grp B
              ON A.grp_seq = B.seq
      WHERE A.use_yn = 'Y'
        AND YEAR(A.buy_date) = @year
        AND MONTH(A.buy_date) = @month
      ORDER BY A.buy_date, B.grp_name
    `;

    console.log(`가구매 일정 조회: ${year}년 ${month}월`);
    
    const pool = await getConnection();
    const result = await pool.request()
      .input('year', sql.Int, parseInt(year))
      .input('month', sql.Int, parseInt(month))
      .query(query);
    
    console.log('가구매 일정 결과:', result.recordset.length, '건');
    
    res.json({
      success: true,
      data: result.recordset
    });
  } catch (error) {
    console.error('가구매 일정 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '가구매 일정 조회 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 가구매 일정 저장
router.post('/', async (req, res) => {
  try {
    const { grp_seq, buy_date } = req.body;
    
    if (!grp_seq || !buy_date) {
      return res.status(400).json({
        success: false,
        message: 'grp_seq와 buy_date가 필요합니다.'
      });
    }

    // 중복 체크
    const checkQuery = `
      SELECT COUNT(*) as cnt
      FROM tb_ga_date
      WHERE grp_seq = @grp_seq
        AND buy_date = @buy_date
        AND use_yn = 'Y'
    `;

    const pool = await getConnection();
    const checkResult = await pool.request()
      .input('grp_seq', sql.Int, grp_seq)
      .input('buy_date', sql.Date, buy_date)
      .query(checkQuery);

    if (checkResult.recordset[0].cnt > 0) {
      return res.status(400).json({
        success: false,
        message: '이미 등록된 가구매 일정입니다.'
      });
    }

    // 일정 저장
    const insertQuery = `
      INSERT INTO tb_ga_date (grp_seq, buy_date, use_yn, input_date)
      VALUES (@grp_seq, @buy_date, 'Y', GETDATE())
    `;

    await pool.request()
      .input('grp_seq', sql.Int, grp_seq)
      .input('buy_date', sql.Date, buy_date)
      .query(insertQuery);

    console.log('가구매 일정 저장 완료:', grp_seq, buy_date);

    res.json({
      success: true,
      message: '가구매 일정이 저장되었습니다.'
    });
  } catch (error) {
    console.error('가구매 일정 저장 오류:', error);
    res.status(500).json({
      success: false,
      message: '가구매 일정 저장 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 가구매 일정 삭제
router.delete('/:seq', async (req, res) => {
  try {
    const { seq } = req.params;
    
    if (!seq) {
      return res.status(400).json({
        success: false,
        message: 'seq가 필요합니다.'
      });
    }

    const deleteQuery = `
      UPDATE tb_ga_date
      SET use_yn = 'N'
      WHERE seq = @seq
    `;

    const pool = await getConnection();
    await pool.request()
      .input('seq', sql.Int, parseInt(seq))
      .query(deleteQuery);

    console.log('가구매 일정 삭제 완료:', seq);

    res.json({
      success: true,
      message: '가구매 일정이 삭제되었습니다.'
    });
  } catch (error) {
    console.error('가구매 일정 삭제 오류:', error);
    res.status(500).json({
      success: false,
      message: '가구매 일정 삭제 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

module.exports = router;
