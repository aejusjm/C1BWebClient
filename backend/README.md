# C1B Web Client Backend API

Node.js + Express + MSSQL 기반 백엔드 API 서버

## 기술 스택

- **Node.js**: JavaScript 런타임
- **Express**: 웹 프레임워크
- **MSSQL**: Microsoft SQL Server 데이터베이스
- **CORS**: Cross-Origin Resource Sharing
- **dotenv**: 환경 변수 관리

## 설치 방법

```bash
# 백엔드 디렉토리로 이동
cd backend

# 패키지 설치
npm install
```

## 환경 설정

`.env` 파일에 다음 내용이 설정되어 있습니다:

```
PORT=3001
DB_SERVER=c1b.co.kr
DB_PORT=4567
DB_DATABASE=c1b
DB_USER=c1bdb
DB_PASSWORD=Jesus!0258
DB_TRUST_SERVER_CERTIFICATE=true
```

## 실행 방법

### 개발 모드 (nodemon 사용)
```bash
npm run dev
```

### 프로덕션 모드
```bash
npm start
```

서버는 기본적으로 `http://localhost:3001`에서 실행됩니다.

## API 엔드포인트

### 기준정보 관리

#### 1. 기준정보 조회
- **URL**: `GET /api/standard-info`
- **설명**: 기준정보(환율, 수수료, 할인율) 조회
- **응답 예시**:
```json
{
  "success": true,
  "data": {
    "rate": "1300.50",
    "smartStoreFee": "3.5",
    "coupangFee": "5.0",
    "smartStoreDiscount": "10.0",
    "coupangDiscount": "15.0"
  }
}
```

#### 2. 기준정보 저장
- **URL**: `POST /api/standard-info`
- **설명**: 기준정보 저장 (INSERT 또는 UPDATE)
- **요청 본문**:
```json
{
  "rate": "1300.50",
  "smartStoreFee": "3.5",
  "coupangFee": "5.0",
  "smartStoreDiscount": "10.0",
  "coupangDiscount": "15.0"
}
```
- **응답 예시**:
```json
{
  "success": true,
  "message": "기준정보가 저장되었습니다."
}
```

## 데이터베이스 스키마

### tb_setting_info 테이블

| 컬럼명 | 타입 | 설명 |
|--------|------|------|
| exchange_rate | DECIMAL(18,2) | 환율 |
| market_fee_ss | DECIMAL(18,2) | 스마트스토어 수수료 |
| market_fee_cp | DECIMAL(18,2) | 쿠팡 수수료 |
| discount_ss | DECIMAL(18,2) | 스마트스토어 할인율 |
| discount_cp | DECIMAL(18,2) | 쿠팡 할인율 |

## 프로젝트 구조

```
backend/
├── config/
│   └── database.js       # 데이터베이스 연결 설정
├── routes/
│   └── standardInfo.js   # 기준정보 API 라우트
├── .env                  # 환경 변수 (보안 주의)
├── server.js             # 메인 서버 파일
├── package.json          # 프로젝트 의존성
└── README.md             # 프로젝트 문서
```

## 주의사항

1. `.env` 파일은 보안상 중요한 정보를 포함하고 있으므로 Git에 커밋하지 마세요.
2. 프로덕션 환경에서는 환경 변수를 서버 설정에서 직접 관리하세요.
3. CORS 설정은 프로덕션 환경에서 특정 도메인만 허용하도록 수정하세요.

## 문제 해결

### 데이터베이스 연결 오류
- 서버 주소, 포트, 데이터베이스명, 사용자 정보를 확인하세요.
- 방화벽에서 포트 4567이 열려있는지 확인하세요.

### CORS 오류
- 프론트엔드 주소가 CORS 설정에 포함되어 있는지 확인하세요.
