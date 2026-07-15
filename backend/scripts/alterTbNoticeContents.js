const fs = require('fs');
const path = require('path');
const { getConnection, closeConnection } = require('../config/database');

async function main() {
  const sqlPath = path.join(__dirname, '..', 'sql', 'alter_tb_notice_contents.sql');
  const sqlText = fs.readFileSync(sqlPath, 'utf8');
  const pool = await getConnection();
  await pool.request().query(sqlText);
  console.log('tb_notice.contents -> NVARCHAR(MAX) 변경 완료');
  await closeConnection();
}

main().catch((error) => {
  console.error('마이그레이션 실패:', error);
  process.exit(1);
});
