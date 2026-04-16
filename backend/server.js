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
});

// 프로세스 종료 시 데이터베이스 연결 종료
process.on('SIGINT', async () => {
  const { closeConnection } = require('./config/database');
  await closeConnection();
  process.exit(0);
});
 
