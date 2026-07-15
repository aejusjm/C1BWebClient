// 기수관리 테이블 생성 스크립트
// 실행: node scripts/createCohortTable.js
const { getConnection, closeConnection } = require('../config/database');

async function createTable() {
  try {
    const pool = await getConnection();

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
          sub_base_start    INT           NULL,
          sub_base_end      INT           NULL,
          sub_fee           INT           NOT NULL DEFAULT 0,
          sub_notice_start  INT           NULL,
          sub_notice_end    INT           NULL,
          created_at        DATETIME      DEFAULT GETDATE(),
          updated_at        DATETIME      NULL
        );

        CREATE INDEX IX_tb_cohort_name ON tb_cohort (cohort_name);
        CREATE INDEX IX_tb_cohort_period ON tb_cohort (start_date, end_date);
      END
    `);

    console.log('✅ tb_cohort 확인/생성 완료');
  } catch (error) {
    console.error('❌ 테이블 생성 오류:', error);
    process.exitCode = 1;
  } finally {
    await closeConnection();
  }
}

createTable();
