// 기수관리 관련 API 라우트
const express = require('express');
const router = express.Router();
const { getConnection, sql } = require('../config/database');

let tableReady = false;

async function ensureCohortTable(pool) {
  if (tableReady) return;
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name = 'tb_cohort' AND xtype = 'U')
    BEGIN
      CREATE TABLE tb_cohort (
        seq               INT IDENTITY(1,1) PRIMARY KEY,
        cohort_name       NVARCHAR(100) NOT NULL,
        ot_date           DATE          NULL,
        start_date        DATE          NULL,
        end_date          DATE          NULL,
        signup_fee        INT           NOT NULL DEFAULT 0,
        sub_base_start    DATE          NULL,
        sub_base_end      DATE          NULL,
        sub_fee           INT           NOT NULL DEFAULT 0,
        sub_notice_start  DATE          NULL,
        sub_notice_end    DATE          NULL,
        created_at        DATETIME      DEFAULT GETDATE(),
        updated_at        DATETIME      NULL
      );

      CREATE INDEX IX_tb_cohort_name ON tb_cohort (cohort_name);
      CREATE INDEX IX_tb_cohort_period ON tb_cohort (start_date, end_date);
    END
  `);
  tableReady = true;
}

function toNullableDate(value) {
  if (value === undefined || value === null || String(value).trim() === '') return null;
  return String(value).trim().slice(0, 10);
}

function toIntAmount(value) {
  if (value === undefined || value === null || value === '') return 0;
  const n = parseInt(String(value).replace(/,/g, ''), 10);
  return Number.isFinite(n) ? n : 0;
}

// 기수 목록 조회
router.get('/', async (req, res) => {
  try {
    const pool = await getConnection();
    await ensureCohortTable(pool);

    const result = await pool.request().query(`
      SELECT
        seq, cohort_name, ot_date, start_date, end_date, signup_fee,
        sub_base_start, sub_base_end, sub_fee, sub_notice_start, sub_notice_end,
        created_at, updated_at
      FROM tb_cohort
      ORDER BY start_date DESC, seq DESC
    `);

    res.json({ success: true, data: result.recordset });
  } catch (error) {
    console.error('기수 목록 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '기수 목록 조회 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 기수 단건 조회
router.get('/:seq', async (req, res) => {
  try {
    const seq = parseInt(req.params.seq, 10);
    if (!seq) {
      return res.status(400).json({ success: false, message: '잘못된 기수 번호입니다.' });
    }

    const pool = await getConnection();
    await ensureCohortTable(pool);

    const result = await pool.request()
      .input('seq', sql.Int, seq)
      .query(`
        SELECT
          seq, cohort_name, ot_date, start_date, end_date, signup_fee,
          sub_base_start, sub_base_end, sub_fee, sub_notice_start, sub_notice_end,
          created_at, updated_at
        FROM tb_cohort
        WHERE seq = @seq
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ success: false, message: '기수를 찾을 수 없습니다.' });
    }

    res.json({ success: true, data: result.recordset[0] });
  } catch (error) {
    console.error('기수 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '기수 조회 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 기수 추가
router.post('/', async (req, res) => {
  try {
    const body = req.body || {};
    const cohortName = String(body.cohort_name || '').trim();

    if (!cohortName) {
      return res.status(400).json({
        success: false,
        message: '기수명을 입력해주세요.'
      });
    }

    const pool = await getConnection();
    await ensureCohortTable(pool);

    await pool.request()
      .input('cohort_name', sql.NVarChar, cohortName)
      .input('ot_date', sql.Date, toNullableDate(body.ot_date))
      .input('start_date', sql.Date, toNullableDate(body.start_date))
      .input('end_date', sql.Date, toNullableDate(body.end_date))
      .input('signup_fee', sql.Int, toIntAmount(body.signup_fee))
      .input('sub_base_start', sql.Date, toNullableDate(body.sub_base_start))
      .input('sub_base_end', sql.Date, toNullableDate(body.sub_base_end))
      .input('sub_fee', sql.Int, toIntAmount(body.sub_fee))
      .input('sub_notice_start', sql.Date, toNullableDate(body.sub_notice_start))
      .input('sub_notice_end', sql.Date, toNullableDate(body.sub_notice_end))
      .query(`
        INSERT INTO tb_cohort (
          cohort_name, ot_date, start_date, end_date, signup_fee,
          sub_base_start, sub_base_end, sub_fee, sub_notice_start, sub_notice_end, created_at
        )
        VALUES (
          @cohort_name, @ot_date, @start_date, @end_date, @signup_fee,
          @sub_base_start, @sub_base_end, @sub_fee, @sub_notice_start, @sub_notice_end, GETDATE()
        )
      `);

    res.json({ success: true, message: '기수가 등록되었습니다.' });
  } catch (error) {
    console.error('기수 추가 오류:', error);
    res.status(500).json({
      success: false,
      message: '기수 추가 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 기수 수정
router.put('/:seq', async (req, res) => {
  try {
    const seq = parseInt(req.params.seq, 10);
    const body = req.body || {};
    const cohortName = String(body.cohort_name || '').trim();

    if (!seq) {
      return res.status(400).json({ success: false, message: '잘못된 기수 번호입니다.' });
    }
    if (!cohortName) {
      return res.status(400).json({ success: false, message: '기수명을 입력해주세요.' });
    }

    const pool = await getConnection();
    await ensureCohortTable(pool);

    const result = await pool.request()
      .input('seq', sql.Int, seq)
      .input('cohort_name', sql.NVarChar, cohortName)
      .input('ot_date', sql.Date, toNullableDate(body.ot_date))
      .input('start_date', sql.Date, toNullableDate(body.start_date))
      .input('end_date', sql.Date, toNullableDate(body.end_date))
      .input('signup_fee', sql.Int, toIntAmount(body.signup_fee))
      .input('sub_base_start', sql.Date, toNullableDate(body.sub_base_start))
      .input('sub_base_end', sql.Date, toNullableDate(body.sub_base_end))
      .input('sub_fee', sql.Int, toIntAmount(body.sub_fee))
      .input('sub_notice_start', sql.Date, toNullableDate(body.sub_notice_start))
      .input('sub_notice_end', sql.Date, toNullableDate(body.sub_notice_end))
      .query(`
        UPDATE tb_cohort
        SET
          cohort_name = @cohort_name,
          ot_date = @ot_date,
          start_date = @start_date,
          end_date = @end_date,
          signup_fee = @signup_fee,
          sub_base_start = @sub_base_start,
          sub_base_end = @sub_base_end,
          sub_fee = @sub_fee,
          sub_notice_start = @sub_notice_start,
          sub_notice_end = @sub_notice_end,
          updated_at = GETDATE()
        WHERE seq = @seq
      `);

    if ((result.rowsAffected && result.rowsAffected[0]) === 0) {
      return res.status(404).json({ success: false, message: '기수를 찾을 수 없습니다.' });
    }

    res.json({ success: true, message: '기수가 수정되었습니다.' });
  } catch (error) {
    console.error('기수 수정 오류:', error);
    res.status(500).json({
      success: false,
      message: '기수 수정 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 기수 삭제
router.delete('/:seq', async (req, res) => {
  try {
    const seq = parseInt(req.params.seq, 10);
    if (!seq) {
      return res.status(400).json({ success: false, message: '잘못된 기수 번호입니다.' });
    }

    const pool = await getConnection();
    await ensureCohortTable(pool);

    const result = await pool.request()
      .input('seq', sql.Int, seq)
      .query('DELETE FROM tb_cohort WHERE seq = @seq');

    if ((result.rowsAffected && result.rowsAffected[0]) === 0) {
      return res.status(404).json({ success: false, message: '기수를 찾을 수 없습니다.' });
    }

    res.json({ success: true, message: '기수가 삭제되었습니다.' });
  } catch (error) {
    console.error('기수 삭제 오류:', error);
    res.status(500).json({
      success: false,
      message: '기수 삭제 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

module.exports = router;
