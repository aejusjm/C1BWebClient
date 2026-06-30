// C1B 가입 결제 테이블 생성 스크립트
// 실행: node scripts/createSignupPaymentTable.js
const { getConnection, closeConnection } = require('../config/database');

async function createTable() {
  try {
    const pool = await getConnection();

    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name = 'tb_signup_payment' AND xtype = 'U')
      BEGIN
        CREATE TABLE tb_signup_payment (
          seq          INT IDENTITY(1,1) PRIMARY KEY,
          joiner_name  NVARCHAR(100) NOT NULL,
          joiner_phone NVARCHAR(50)  NOT NULL,
          order_id     NVARCHAR(100) NOT NULL,
          order_name   NVARCHAR(200) NULL,
          payment_key  NVARCHAR(200) NULL,
          amount       INT           NOT NULL,
          status       NVARCHAR(20)  NOT NULL DEFAULT 'READY',
          paid_at      DATETIME      NULL,
          raw_response NVARCHAR(MAX) NULL,
          created_at   DATETIME      DEFAULT GETDATE()
        );
        CREATE UNIQUE INDEX UX_tb_signup_payment_order_id ON tb_signup_payment (order_id);
      END
    `);
    console.log('✅ tb_signup_payment 확인/생성 완료');
    console.log('🎉 가입 결제 테이블 생성 작업 완료');
  } catch (error) {
    console.error('❌ 테이블 생성 오류:', error);
    process.exitCode = 1;
  } finally {
    await closeConnection();
  }
}

createTable();
