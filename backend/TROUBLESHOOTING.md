# 문제 해결 가이드

## 1. "백엔드 서버에 연결할 수 없습니다" 오류

### 원인
- 백엔드 서버가 실행되지 않음
- 포트 충돌 (3001 포트가 이미 사용 중)
- 방화벽 차단

### 해결 방법

#### 1단계: 백엔드 서버 실행 확인
```bash
# 새 터미널 열기
cd C:\Cursor_Projects\C1BWebClient\backend

# 패키지 설치 (처음 한 번만)
npm install

# 서버 실행
npm run dev
```

#### 2단계: 서버 실행 확인
브라우저에서 `http://localhost:3001` 접속
- 정상: `{"message":"C1B Web Client Backend API","version":"1.0.0","status":"running"}` 표시
- 오류: 연결 거부 또는 페이지를 찾을 수 없음

#### 3단계: 포트 확인
```bash
# 포트 3001이 사용 중인지 확인
netstat -ano | findstr :3001
```

포트가 이미 사용 중이면:
1. `.env` 파일에서 `PORT=3002`로 변경
2. `StandardInfoPage.tsx`에서 `API_URL`을 `http://localhost:3002/api/standard-info`로 변경

## 2. "MSSQL 데이터베이스 연결 실패" 오류

### 원인
- 데이터베이스 서버 접근 불가
- 잘못된 연결 정보
- 방화벽 차단

### 해결 방법

#### 1단계: 연결 정보 확인
`.env` 파일 확인:
```
DB_SERVER=c1b.co.kr
DB_PORT=4567
DB_DATABASE=c1b
DB_USER=c1bdb
DB_PASSWORD=Jesus!0258
```

#### 2단계: 네트워크 연결 테스트
```bash
# 서버 핑 테스트
ping c1b.co.kr

# 포트 연결 테스트 (PowerShell)
Test-NetConnection -ComputerName c1b.co.kr -Port 4567
```

#### 3단계: 방화벽 확인
- Windows 방화벽에서 포트 4567 허용 확인
- 회사 네트워크의 경우 IT 부서에 문의

## 3. CORS 오류

### 증상
브라우저 콘솔에 다음과 같은 오류:
```
Access to fetch at 'http://localhost:3001/api/standard-info' from origin 'http://localhost:5173' has been blocked by CORS policy
```

### 해결 방법
`backend/server.js`에 CORS가 이미 설정되어 있는지 확인:
```javascript
const cors = require('cors');
app.use(cors());
```

특정 도메인만 허용하려면:
```javascript
app.use(cors({
  origin: 'http://localhost:5173'
}));
```

## 4. 데이터가 표시되지 않음

### 원인
- 테이블에 데이터가 없음
- 컬럼명 불일치

### 해결 방법

#### SQL로 데이터 확인
```sql
SELECT * FROM tb_setting_info
```

#### 테이블이 비어있으면 샘플 데이터 삽입
```sql
INSERT INTO tb_setting_info (exchange_rate, market_fee_ss, market_fee_cp, discount_ss, discount_cp)
VALUES (1300.50, 3.5, 5.0, 10.0, 15.0)
```

## 5. 저장 후 데이터가 반영되지 않음

### 확인 사항
1. 브라우저 콘솔에서 네트워크 탭 확인
2. POST 요청이 성공했는지 확인 (200 OK)
3. 데이터베이스에서 직접 확인

```sql
SELECT * FROM tb_setting_info
```

## 빠른 체크리스트

- [ ] 백엔드 서버 실행 중 (`npm run dev`)
- [ ] 프론트엔드 서버 실행 중 (`npm run dev`)
- [ ] 브라우저에서 `http://localhost:3001` 접속 가능
- [ ] 브라우저에서 `http://localhost:5173` 접속 가능
- [ ] 데이터베이스 연결 성공 메시지 확인
- [ ] 브라우저 콘솔에 오류 없음
- [ ] 네트워크 탭에서 API 요청 성공 (200 OK)

## 로그 확인

### 백엔드 로그
터미널에서 백엔드 서버 실행 시 출력되는 로그 확인:
```
✅ MSSQL 데이터베이스 연결 성공
🚀 서버가 포트 3001에서 실행 중입니다.
```

### 브라우저 콘솔 로그
1. F12 키 또는 우클릭 > 검사
2. Console 탭에서 오류 메시지 확인
3. Network 탭에서 API 요청/응답 확인

## 추가 도움

문제가 계속되면:
1. 백엔드 터미널의 전체 오류 로그 복사
2. 브라우저 콘솔의 오류 메시지 복사
3. 개발자에게 전달
