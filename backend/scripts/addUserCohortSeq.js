const { getConnection, closeConnection } = require('../config/database');

(async () => {
  try {
    const pool = await getConnection();
    await pool.request().query(`
      IF COL_LENGTH('tb_user', 'cohort_seq') IS NULL
        ALTER TABLE tb_user ADD cohort_seq INT NULL;
    `);
    const result = await pool.request().query(`
      SELECT COL_LENGTH('tb_user', 'cohort_seq') AS len
    `);
    console.log('✅ cohort_seq column length:', result.recordset[0].len);
  } catch (error) {
    console.error('❌', error);
    process.exitCode = 1;
  } finally {
    await closeConnection();
  }
})();
