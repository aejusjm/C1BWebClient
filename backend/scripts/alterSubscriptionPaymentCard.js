// 구독 결제 카드정보 컬럼 추가
// 실행: node scripts/alterSubscriptionPaymentCard.js
const { getConnection, closeConnection } = require('../config/database');

async function alter() {
  try {
    const pool = await getConnection();

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

    console.log('✅ card_name / card_number 컬럼 확인/추가 완료');
  } catch (error) {
    console.error('❌ 컬럼 추가 오류:', error);
    process.exitCode = 1;
  } finally {
    await closeConnection();
  }
}

alter();
