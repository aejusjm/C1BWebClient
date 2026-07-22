// tb_del_request 테이블에 market_type 컬럼 추가
// 실행: node scripts/alterDelRequestMarketType.js
const { getConnection, closeConnection } = require('../config/database');

async function alter() {
  try {
    const pool = await getConnection();

    await pool.request().query(`
      IF COL_LENGTH('tb_del_request', 'market_type') IS NULL
        ALTER TABLE tb_del_request ADD market_type NVARCHAR(10) NULL;
    `);

    console.log('✅ tb_del_request.market_type 컬럼 확인/추가 완료');
  } catch (error) {
    console.error('❌ 컬럼 추가 오류:', error);
    process.exitCode = 1;
  } finally {
    await closeConnection();
  }
}

alter();
