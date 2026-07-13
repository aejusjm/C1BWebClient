const { getConnection, closeConnection } = require('../config/database');

(async () => {
  try {
    const pool = await getConnection();
    await pool.request().query(`
      IF COL_LENGTH('tb_subscription_settlement', 'cohort_seq') IS NULL
        ALTER TABLE tb_subscription_settlement ADD cohort_seq INT NULL;
    `);
    const r = await pool.request().query(`
      SELECT COL_LENGTH('tb_subscription_settlement', 'cohort_seq') AS len
    `);
    console.log('✅ settlement cohort_seq length:', r.recordset[0].len);
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  } finally {
    await closeConnection();
  }
})();
