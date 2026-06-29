// 구독 정기결제 스케줄러
// 매일 새벽 4시에 결제예정일이 도래한 구독을 자동 결제한다.
const cron = require('node-cron');
const subscriptionRoutes = require('../routes/subscription');

function startSubscriptionScheduler() {
  // 매일 04:00 (서버 시간 기준)
  cron.schedule('0 4 * * *', async () => {
    console.log('⏰ 구독 정기결제 스케줄러 실행:', new Date().toISOString());
    try {
      await subscriptionRoutes.runMonthlyBilling();
    } catch (error) {
      console.error('구독 정기결제 스케줄러 오류:', error);
    }
  });

  console.log('🗓️  구독 정기결제 스케줄러 등록 완료 (매일 04:00)');
}

module.exports = { startSubscriptionScheduler };
