# C1B Web Client 배포 가이드

## Windows Server 2022 + IIS 배포

### 1. 사전 준비

#### 필수 소프트웨어
- Node.js (v18 이상)
- IIS (Internet Information Services)
- PM2 또는 Windows Service (백엔드 프로세스 관리용)

### 2. 백엔드 배포

#### 2.1 파일 복사
```
C:\Cursor_Projects\C1BWebClient\backend\*
→ C:\inetpub\c1b-backend\ (또는 원하는 경로)
```

#### 2.2 환경 변수 설정
`C:\inetpub\c1b-backend\.env` 파일 생성:
```env
DB_SERVER=your-db-server
DB_NAME=your-db-name
DB_USER=your-db-user
DB_PASSWORD=your-db-password
PORT=3001
```

#### 2.3 의존성 설치
```powershell
cd C:\inetpub\c1b-backend
npm install --production
```

#### 2.4 PM2로 백엔드 실행
```powershell
# PM2 전역 설치
npm install -g pm2

# 백엔드 시작
pm2 start server.js --name c1b-backend

# 부팅 시 자동 시작 설정
pm2 startup
pm2 save
```

또는 **Windows Service**로 등록:
```powershell
npm install -g node-windows
# node-windows를 사용하여 서비스 등록
```

### 3. 프론트엔드 배포

#### 3.1 빌드 파일 생성
로컬 개발 환경에서:
```powershell
cd C:\Cursor_Projects\C1BWebClient\web-client
npm run build
```

#### 3.2 빌드 파일 복사
```
C:\Cursor_Projects\C1BWebClient\web-client\dist\*
→ C:\inetpub\wwwroot\c1b\ (IIS 웹 루트)
```

#### 3.3 IIS 설정

##### 3.3.1 새 웹사이트 생성
1. IIS 관리자 열기
2. 사이트 → 웹 사이트 추가
   - 사이트 이름: C1B Web Client
   - 물리적 경로: `C:\inetpub\wwwroot\c1b`
   - 바인딩: 
     - HTTP: 포트 80
     - HTTPS: 포트 443 (SSL 인증서 설정)

##### 3.3.2 URL Rewrite 규칙 추가
`C:\inetpub\wwwroot\c1b\web.config` 파일 생성:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<configuration>
  <system.webServer>
    <rewrite>
      <rules>
        <!-- SPA 라우팅 처리 -->
        <rule name="React Routes" stopProcessing="true">
          <match url=".*" />
          <conditions logicalGrouping="MatchAll">
            <add input="{REQUEST_FILENAME}" matchType="IsFile" negate="true" />
            <add input="{REQUEST_FILENAME}" matchType="IsDirectory" negate="true" />
            <add input="{REQUEST_URI}" pattern="^/api" negate="true" />
          </conditions>
          <action type="Rewrite" url="/" />
        </rule>
        
        <!-- API 리버스 프록시 -->
        <rule name="API Proxy" stopProcessing="true">
          <match url="^api/(.*)" />
          <action type="Rewrite" url="http://localhost:3001/api/{R:1}" />
        </rule>
      </rules>
    </rewrite>
    
    <!-- CORS 헤더 -->
    <httpProtocol>
      <customHeaders>
        <add name="Access-Control-Allow-Origin" value="*" />
        <add name="Access-Control-Allow-Methods" value="GET, POST, PUT, DELETE, OPTIONS" />
        <add name="Access-Control-Allow-Headers" value="Content-Type, Authorization" />
      </customHeaders>
    </httpProtocol>
    
    <!-- 정적 파일 캐싱 -->
    <staticContent>
      <clientCache cacheControlMode="UseMaxAge" cacheControlMaxAge="7.00:00:00" />
    </staticContent>
  </system.webServer>
</configuration>
```

##### 3.3.3 IIS URL Rewrite 모듈 설치
- URL Rewrite 모듈이 없다면 설치: https://www.iis.net/downloads/microsoft/url-rewrite

##### 3.3.4 Application Request Routing (ARR) 설치
- API 리버스 프록시를 위해 필요
- 다운로드: https://www.iis.net/downloads/microsoft/application-request-routing

### 4. 환경 변수 확인

#### 4.1 프론트엔드 환경 변수
`.env.production` 파일이 올바른지 확인:
```env
VITE_API_URL=https://c1b.co.kr
```

**중요**: 빌드 전에 이 파일이 올바르게 설정되어 있어야 합니다!

#### 4.2 빌드 시 환경 변수 확인
빌드된 JavaScript 파일에서 확인:
```powershell
# dist 폴더의 JS 파일에서 localhost 검색
Select-String -Path "C:\Cursor_Projects\C1BWebClient\web-client\dist\assets\*.js" -Pattern "localhost:3001"
```

만약 `localhost:3001`이 발견되면, `.env.production` 파일을 수정하고 **다시 빌드**해야 합니다.

### 5. 배포 체크리스트

- [ ] `.env.production` 파일에 올바른 API URL 설정
- [ ] `npm run build` 실행하여 프로덕션 빌드 생성
- [ ] 빌드 파일(`dist/*`)을 IIS 웹 루트로 복사
- [ ] `web.config` 파일 생성 (URL Rewrite 규칙)
- [ ] 백엔드 서버가 실행 중인지 확인 (`http://localhost:3001`)
- [ ] IIS에서 웹사이트 시작
- [ ] 브라우저에서 `https://c1b.co.kr` 접속 테스트

### 6. 트러블슈팅

#### 문제: "백엔드 서버에 연결할 수 없습니다"
**원인**: 빌드 파일이 여전히 `localhost:3001`로 요청
**해결**: 
1. `.env.production` 파일 확인 및 수정
2. `npm run build` 재실행
3. 새로운 빌드 파일 재배포

#### 문제: API 요청 404 오류
**원인**: IIS URL Rewrite 규칙 미설정
**해결**: `web.config` 파일 생성 및 URL Rewrite 모듈 설치

#### 문제: 이미지 로드 실패 (SSL 오류)
**원인**: 외부 이미지 HTTPS 인증서 문제
**해결**: 이미 적용됨 (이미지 프록시 사용)

### 7. 백엔드 API 엔드포인트 확인

운영 서버에서 백엔드가 정상 작동하는지 확인:
```
http://localhost:3001/
→ {"message":"C1B Web Client Backend API","version":"1.0.0","status":"running"}
```

### 8. 보안 설정

#### 8.1 HTTPS 인증서 설정
- IIS에서 SSL 인증서 바인딩
- Let's Encrypt 또는 상용 인증서 사용

#### 8.2 방화벽 설정
- 포트 80 (HTTP) 허용
- 포트 443 (HTTPS) 허용
- 포트 3001 (백엔드) 외부 접근 차단

#### 8.3 데이터베이스 보안
- SQL Server 방화벽 설정
- 강력한 데이터베이스 비밀번호 사용
- 최소 권한 원칙 적용

### 9. 모니터링

#### PM2 모니터링
```powershell
pm2 status
pm2 logs c1b-backend
pm2 monit
```

#### IIS 로그 확인
```
C:\inetpub\logs\LogFiles\
```

---

## 빠른 재배포 스크립트

```powershell
# 1. 로컬에서 빌드
cd C:\Cursor_Projects\C1BWebClient\web-client
npm run build

# 2. 빌드 파일을 운영 서버로 복사 (예시)
# 실제 경로는 환경에 맞게 수정
Copy-Item -Path "dist\*" -Destination "\\운영서버\c$\inetpub\wwwroot\c1b\" -Recurse -Force

# 3. 백엔드 재시작 (운영 서버에서 실행)
pm2 restart c1b-backend
```
