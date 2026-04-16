# 통관번호 입력 페이지 배포 가이드

## 배포 단계

### 1. 프론트엔드 빌드 및 배포

```bash
cd C:\Cursor_Projects\C1BWebClient\web-client
npm run build
```

빌드된 파일은 `web-client/dist` 폴더에 생성됩니다.

### 2. IIS 배포

1. **빌드된 파일 복사**
   - `web-client/dist` 폴더의 모든 내용을 IIS 웹사이트 루트 폴더로 복사
   - 예: `C:\inetpub\wwwroot\c1b` 또는 해당 사이트 경로

2. **web.config 확인**
   - `dist` 폴더에 `web.config` 파일이 포함되어 있는지 확인
   - React Router의 클라이언트 사이드 라우팅을 위한 URL Rewrite 규칙 포함

### 3. 백엔드 API 라우트 확인

통관번호 입력 페이지는 다음 API를 사용합니다:

- `GET /api/pccc-input/order-info/:pcccGuid` - 주문 정보 조회
- `POST /api/pccc-input/save-pccc` - 통관번호 저장

백엔드 서버(`server.js`)에 `pcccInputRoutes`가 등록되어 있는지 확인:

```javascript
const pcccInputRoutes = require('./routes/pcccInput');
app.use('/api/pccc-input', pcccInputRoutes);
```

### 4. 환경 변수 확인

`.env.production` 파일에서 API URL 확인:

```
VITE_API_URL=https://c1b.co.kr
```

### 5. 테스트 URL

- **로컬**: `http://localhost:5173/pccc-input?pccc_guid={GUID}`
- **배포**: `https://c1b.co.kr/pccc-input?pccc_guid={GUID}`

## 문제 해결

### "사이트에 연결할 수 없음" 오류

1. **IIS URL Rewrite 모듈 설치 확인**
   - IIS Manager에서 URL Rewrite 모듈이 설치되어 있는지 확인
   - 없다면: https://www.iis.net/downloads/microsoft/url-rewrite 에서 다운로드

2. **web.config 파일 확인**
   - IIS 사이트 루트에 `web.config` 파일이 있는지 확인
   - URL Rewrite 규칙이 올바르게 설정되어 있는지 확인

3. **Application Request Routing (ARR) 활성화**
   - IIS Manager > 서버 노드 선택
   - Application Request Routing Cache 더블클릭
   - Server Proxy Settings 클릭
   - "Enable proxy" 체크

4. **백엔드 API 연결 확인**
   - 브라우저 개발자 도구(F12) > Network 탭에서 API 호출 확인
   - `https://c1b.co.kr/api/pccc-input/order-info/{GUID}` 호출이 성공하는지 확인

5. **CORS 설정 확인**
   - 백엔드 `server.js`에서 CORS가 올바르게 설정되어 있는지 확인

### 빌드 후 변경사항이 반영되지 않는 경우

1. 브라우저 캐시 삭제 (Ctrl + Shift + Delete)
2. 하드 새로고침 (Ctrl + F5)
3. IIS 애플리케이션 풀 재시작

## 배포 체크리스트

- [ ] `npm run build` 실행 완료
- [ ] `dist` 폴더 내용을 IIS 사이트 루트로 복사
- [ ] `web.config` 파일이 사이트 루트에 존재
- [ ] IIS URL Rewrite 모듈 설치됨
- [ ] 백엔드 API 서버 실행 중
- [ ] `.env.production`에 올바른 API URL 설정
- [ ] 테스트 URL로 접근 가능

## 추가 참고사항

### IIS에서 React Router 작동 원리

1. 사용자가 `https://c1b.co.kr/pccc-input?pccc_guid=xxx`에 접근
2. IIS는 `/pccc-input` 경로에 해당하는 실제 파일이 없음을 확인
3. `web.config`의 URL Rewrite 규칙에 따라 `/index.html`로 리다이렉트
4. React 앱이 로드되고 React Router가 `/pccc-input` 경로를 처리
5. `PcccInputPage` 컴포넌트가 렌더링됨

### 백엔드 API 경로

프론트엔드는 다음과 같이 API를 호출합니다:

```typescript
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'
const API_URL = `${API_BASE}/api/pccc-input`
```

프로덕션에서는 `https://c1b.co.kr/api/pccc-input`으로 호출됩니다.
