// 구독료 정산 테이블 생성 스크립트
// 실행: node scripts/createSubscriptionSettlementTable.js
const { getConnection, closeConnection } = require('../config/database');

async function createTable() {
  try {
    const pool = await getConnection();

    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name = 'tb_subscription_settlement' AND xtype = 'U')
      BEGIN
        CREATE TABLE tb_subscription_settlement (
          seq               INT IDENTITY(1,1) PRIMARY KEY,
          settle_year       INT           NOT NULL,
          settle_month      INT           NOT NULL,
          period_start      DATE          NOT NULL,
          period_end        DATE          NOT NULL,
          user_id           NVARCHAR(50)  NOT NULL,
          user_name         NVARCHAR(100) NULL,
          total_sales       BIGINT        NOT NULL DEFAULT 0,
          subscription_fee  INT           NOT NULL DEFAULT 0,
          base_sub_fee      INT           NOT NULL DEFAULT 0,
          refund_amount     INT           NOT NULL DEFAULT 0,
          created_at        DATETIME      DEFAULT GETDATE()
        );

        CREATE INDEX IX_tb_subscription_settlement_ym
          ON tb_subscription_settlement (settle_year, settle_month);

        CREATE INDEX IX_tb_subscription_settlement_period
          ON tb_subscription_settlement (settle_year, settle_month, period_start, period_end);

        CREATE UNIQUE INDEX UX_tb_subscription_settlement_user_period
          ON tb_subscription_settlement (settle_year, settle_month, period_start, period_end, user_id);
      END
    `);

    console.log('✅ tb_subscription_settlement 확인/생성 완료');
  } catch (error) {
    console.error('❌ 테이블 생성 오류:', error);
    process.exitCode = 1;
  } finally {
    await closeConnection();
  }
}

createTable();
