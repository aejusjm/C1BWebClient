// Node.js Express 서버 - C1B Web Client Backend
const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// 미들웨어 설정
app.use(cors()); // CORS 허용
app.use(express.json()); // JSON 파싱
app.use(express.urlencoded({ extended: true })); // URL 인코딩 파싱

// 라우트 설정
const authRoutes = require('./routes/auth');
const imageProxyRoutes = require('./routes/imageProxy');
const standardInfoRoutes = require('./routes/standardInfo');
const userManagementRoutes = require('./routes/userManagement');
const noticeManagementRoutes = require('./routes/noticeManagement');
const marketConnectionRoutes = require('./routes/marketConnection');
const detailPageManagementRoutes = require('./routes/detailPageManagement');
const basicInfoRoutes = require('./routes/basicInfo');
const productManagementRoutes = require('./routes/productManagement');
const orderManagementRoutes = require('./routes/orderManagement');
const noWordManagementRoutes = require('./routes/noWordManagement');
const statisticsRoutes = require('./routes/statistics');
const pcccInputRoutes = require('./routes/pcccInput');
const exchangeRateRoutes = require('./routes/exchangeRate');
const smartStoreApiRoutes = require('./routes/smartStoreApi');
const coupangApiRoutes = require('./routes/coupangApi');
const userDetailImageRoutes = require('./routes/userDetailImage');
const serverManagementRoutes = require('./routes/serverManagement');
const deleteProductManagementRoutes = require('./routes/deleteProductManagement');
const batchLogManagementRoutes = require('./routes/batchLogManagement');
const fakePurchaseUserRoutes = require('./routes/fakePurchaseUser');
const fakePurchaseScheduleRoutes = require('./routes/fakePurchaseSchedule');
const fakePurchaseInfoRoutes = require('./routes/fakePurchaseInfo');
const subscriptionRoutes = require('./routes/subscription');
const subscriptionManagementRoutes = require('./routes/subscriptionManagement');
const signupPaymentRoutes = require('./routes/signupPayment');
const signupPaymentManagementRoutes = require('./routes/signupPaymentManagement');
const adminDirectPaymentRoutes = require('./routes/adminDirectPayment');
app.use('/api/auth', authRoutes);
app.use('/api/image', imageProxyRoutes);
app.use('/api/standard-info', standardInfoRoutes);
app.use('/api/users', userManagementRoutes);
app.use('/api/notices', noticeManagementRoutes);
app.use('/api/market', marketConnectionRoutes);
app.use('/api/detail-page', detailPageManagementRoutes);
app.use('/api/basic-info', basicInfoRoutes);
app.use('/api/products', productManagementRoutes);
app.use('/api/orders', orderManagementRoutes);
app.use('/api/no-words', noWordManagementRoutes);
app.use('/api/stats', statisticsRoutes);
app.use('/api/pccc-input', pcccInputRoutes);
app.use('/api', exchangeRateRoutes);
app.use('/api/smartstore-api', smartStoreApiRoutes);
app.use('/api/coupang-api', coupangApiRoutes);
app.use('/api/user-detail-images', userDetailImageRoutes);
app.use('/api/servers', serverManagementRoutes);
app.use('/api/delete-products', deleteProductManagementRoutes);
app.use('/api/batch-logs', batchLogManagementRoutes);
app.use('/api/fake-purchase-users', fakePurchaseUserRoutes);
app.use('/api/fake-purchase-schedule', fakePurchaseScheduleRoutes);
app.use('/api/fake-purchase-info', fakePurchaseInfoRoutes);
app.use('/api/subscription', subscriptionRoutes);
app.use('/api/subscription-management', subscriptionManagementRoutes);
app.use('/api/signup-payment', signupPaymentRoutes);
app.use('/api/signup-payment-management', signupPaymentManagementRoutes);
app.use('/api/admin-direct-payment', adminDirectPaymentRoutes);

// 업로드된 파일 정적 서빙
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 기본 라우트
app.get('/', (req, res) => {
  res.json({
    message: 'C1B Web Client Backend API',
    version: '1.0.0',
    status: 'running'
  });
});

// 서버 시작
app.listen(PORT, () => {
  console.log(`🚀 서버가 포트 ${PORT}에서 실행 중입니다.`);
  console.log(`📍 http://localhost:${PORT}`);

  // 구독 정기결제 스케줄러 (내장) - 비활성화됨
  // 윈도우 작업 스케줄러(scripts/run-billing.bat)로 배치를 실행하므로
  // 중복 결제 방지를 위해 내장 스케줄러는 끕니다.
  // 다시 켜려면 아래 주석을 해제하세요.
  // try {
  //   const { startSubscriptionScheduler } = require('./scheduler/subscriptionScheduler');
  //   startSubscriptionScheduler();
  // } catch (error) {
  //   console.error('구독 스케줄러 시작 실패:', error);
  // }
});

// 프로세스 종료 시 데이터베이스 연결 종료
process.on('SIGINT', async () => {
  const { closeConnection } = require('./config/database');
  await closeConnection();
  process.exit(0);
});
 
