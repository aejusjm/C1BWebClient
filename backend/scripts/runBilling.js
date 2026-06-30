// 구독 정기결제 배치 1회 실행 스크립트 (윈도우 작업 스케줄러 등에서 호출)
// 실행: node scripts/runBilling.js
const { closeConnection } = require('../config/database');
const subscriptionRoutes = require('../routes/subscription');

(async () => {
  const startedAt = new Date().toISOString();
  console.log(`[runBilling] 시작: ${startedAt}`);
  try {
    const results = await subscriptionRoutes.runMonthlyBilling();
    const total = Array.isArray(results) ? results.length : 0;
    const success = Array.isArray(results) ? results.filter(r => r.success).length : 0;
    const failed = total - success;
    console.log(`[runBilling] 완료: 대상 ${total}건 / 성공 ${success}건 / 실패 ${failed}건`);
    process.exitCode = 0;
  } catch (error) {
    console.error('[runBilling] 오류:', error);
    process.exitCode = 1;
  } finally {
    await closeConnection();
  }
})();
