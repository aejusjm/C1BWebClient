// 데이터베이스 연결 설정
const sql = require('mssql');
require('dotenv').config();

// MSSQL 연결 설정
const config = {
  server: process.env.DB_SERVER,
  port: parseInt(process.env.DB_PORT),
  database: process.env.DB_DATABASE,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  options: {
    encrypt: true,
    trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE === 'true'
  }
};

// 데이터베이스 연결 풀 생성
let pool = null;

async function getConnection() {
  try {
    if (pool) {
      return pool;
    }
    
    pool = await sql.connect(config);
    console.log('✅ MSSQL 데이터베이스 연결 성공');
    return pool;
  } catch (error) {
    console.error('❌ 데이터베이스 연결 실패:', error);
    throw error;
  }
}

// 연결 종료
async function closeConnection() {
  try {
    if (pool) {
      await pool.close();
      pool = null;
      console.log('✅ 데이터베이스 연결 종료');
    }
  } catch (error) {
    console.error('❌ 데이터베이스 연결 종료 실패:', error);
    throw error;
  }
}

module.exports = {
  getConnection,
  closeConnection,
  sql
};
