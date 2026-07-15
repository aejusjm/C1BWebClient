// 기수 구독공지 시작/종료일 컬럼을 DATE → INT(일)로 변경
// 실행: node scripts/alterCohortSubNoticeToDay.js
const { getConnection, closeConnection } = require('../config/database');

async function alterColumns() {
  try {
    const pool = await getConnection();

    const colCheck = await pool.request().query(`
      SELECT DATA_TYPE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'tb_cohort'
        AND COLUMN_NAME = 'sub_notice_start'
    `);
    const dataType = colCheck.recordset[0]?.DATA_TYPE;

    if (dataType === 'date') {
      await pool.request().query(`
        ALTER TABLE tb_cohort ADD sub_notice_start_day INT NULL;
        ALTER TABLE tb_cohort ADD sub_notice_end_day INT NULL;
      `);
      await pool.request().query(`
        UPDATE tb_cohort
        SET
          sub_notice_start_day = CASE WHEN sub_notice_start IS NULL THEN NULL ELSE DAY(sub_notice_start) END,
          sub_notice_end_day = CASE WHEN sub_notice_end IS NULL THEN NULL ELSE DAY(sub_notice_end) END;
      `);
      await pool.request().query(`
        ALTER TABLE tb_cohort DROP COLUMN sub_notice_start;
        ALTER TABLE tb_cohort DROP COLUMN sub_notice_end;
      `);
      await pool.request().query(`
        EXEC sp_rename 'tb_cohort.sub_notice_start_day', 'sub_notice_start', 'COLUMN';
      `);
      await pool.request().query(`
        EXEC sp_rename 'tb_cohort.sub_notice_end_day', 'sub_notice_end', 'COLUMN';
      `);
      console.log('✅ tb_cohort.sub_notice_start/end INT(일) 전환 완료');
    } else if (dataType === 'int') {
      console.log('ℹ️ 이미 INT 타입입니다. 변경 없음');
    } else {
      console.log(`ℹ️ sub_notice_start 컬럼 상태: ${dataType || '없음'}`);
    }
  } catch (error) {
    console.error('❌ 컬럼 변경 오류:', error);
    process.exitCode = 1;
  } finally {
    await closeConnection();
  }
}

alterColumns();
