// 구독 결제 관련 테이블 생성 스크립트
// 실행: node scripts/createSubscriptionTables.js
const { getConnection, closeConnection } = require('../config/database');

async function createTables() {
  try {
    const pool = await getConnection();

    // 1) tb_subscription
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name = 'tb_subscription' AND xtype = 'U')
      BEGIN
        CREATE TABLE tb_subscription (
          seq           INT IDENTITY(1,1) PRIMARY KEY,
          user_id       NVARCHAR(50)  NOT NULL,
          customer_key  NVARCHAR(100) NOT NULL,
          billing_key   NVARCHAR(200) NULL,
          plan_type     NVARCHAR(20)  NOT NULL,
          amount        INT           NOT NULL,
          status        NVARCHAR(20)  NOT NULL DEFAULT 'PENDING',
          next_pay_date DATE          NULL,
          card_name     NVARCHAR(100) NULL,
          card_number   NVARCHAR(30)  NULL,
          created_at    DATETIME      DEFAULT GETDATE(),
          updated_at    DATETIME      DEFAULT GETDATE()
        );
        CREATE UNIQUE INDEX UX_tb_subscription_customer_key ON tb_subscription (customer_key);
        CREATE INDEX IX_tb_subscription_user_id ON tb_subscription (user_id);
      END
    `);
    console.log('✅ tb_subscription 확인/생성 완료');

    // 2) tb_subscription_payment
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name = 'tb_subscription_payment' AND xtype = 'U')
      BEGIN
        CREATE TABLE tb_subscription_payment (
          seq          INT IDENTITY(1,1) PRIMARY KEY,
          user_id      NVARCHAR(50)  NOT NULL,
          order_id     NVARCHAR(100) NOT NULL,
          payment_key  NVARCHAR(200) NULL,
          plan_type    NVARCHAR(20)  NULL,
          amount       INT           NOT NULL,
          status       NVARCHAR(20)  NOT NULL,
          paid_at      DATETIME      NULL,
          card_name    NVARCHAR(100) NULL,
          card_number  NVARCHAR(30)  NULL,
          raw_response NVARCHAR(MAX) NULL,
          created_at   DATETIME      DEFAULT GETDATE()
        );
        CREATE INDEX IX_tb_subscription_payment_user_id ON tb_subscription_payment (user_id);
        CREATE UNIQUE INDEX UX_tb_subscription_payment_order_id ON tb_subscription_payment (order_id);
      END
    `);
    console.log('✅ tb_subscription_payment 확인/생성 완료');

    // 2-1) 환불 관련 컬럼 추가 (기존 테이블에도 idempotent 적용)
    await pool.request().query(`
      IF COL_LENGTH('tb_subscription_payment', 'refund_amount') IS NULL
        ALTER TABLE tb_subscription_payment ADD refund_amount INT NOT NULL DEFAULT 0;
    `);
    await pool.request().query(`
      IF COL_LENGTH('tb_subscription_payment', 'refund_reason') IS NULL
        ALTER TABLE tb_subscription_payment ADD refund_reason NVARCHAR(500) NULL;
    `);
    await pool.request().query(`
      IF COL_LENGTH('tb_subscription_payment', 'refunded_at') IS NULL
        ALTER TABLE tb_subscription_payment ADD refunded_at DATETIME NULL;
    `);
    console.log('✅ tb_subscription_payment 환불 컬럼 확인/추가 완료');

    await pool.request().query(`
      IF COL_LENGTH('tb_subscription_payment', 'card_name') IS NULL
        ALTER TABLE tb_subscription_payment ADD card_name NVARCHAR(100) NULL;
    `);
    await pool.request().query(`
      IF COL_LENGTH('tb_subscription_payment', 'card_number') IS NULL
        ALTER TABLE tb_subscription_payment ADD card_number NVARCHAR(30) NULL;
    `);
    await pool.request().query(`
      IF COL_LENGTH('tb_subscription', 'card_name') IS NULL
        ALTER TABLE tb_subscription ADD card_name NVARCHAR(100) NULL;
    `);
    await pool.request().query(`
      IF COL_LENGTH('tb_subscription', 'card_number') IS NULL
        ALTER TABLE tb_subscription ADD card_number NVARCHAR(30) NULL;
    `);
    console.log('✅ 카드정보 컬럼 확인/추가 완료');

    console.log('🎉 구독 테이블 생성 작업 완료');
  } catch (error) {
    console.error('❌ 테이블 생성 오류:', error);
    process.exitCode = 1;
  } finally {
    await closeConnection();
  }
}

createTables();
