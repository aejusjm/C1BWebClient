# C1B 스토어보드 - Windows Server 2022 배포 가이드

> 이 문서는 C1B 스토어보드 프로젝트를 Windows Server 2022에 배포하는 전체 과정을 초보자도 따라할 수 있도록 상세하게 설명합니다.

## 📋 목차

### 준비 단계
1. [배포 전 확인사항](#1-배포-전-확인사항)
2. [필수 소프트웨어 설치](#2-필수-소프트웨어-설치)

### 배포 단계
3. [백엔드 배포 (Node.js API 서버)](#3-백엔드-배포-nodejs-api-서버)
4. [프론트엔드 배포 (React 웹 애플리케이션)](#4-프론트엔드-배포-react-웹-애플리케이션)
5. [IIS 리버스 프록시 설정](#5-iis-리버스-프록시-설정)

### 운영 단계
6. [보안 설정 (HTTPS)](#6-보안-설정-https)
7. [자동 배포 스크립트](#7-자동-배포-스크립트)
8. [모니터링 및 관리](#8-모니터링-및-관리)
9. [문제 해결](#9-문제-해결)

---

## 1. 배포 전 확인사항

### 1.1 현재 프로젝트 구조

```
C:\Cursor_Projects\C1BWebClient\
├── backend\                      # 백엔드 소스
│   ├── config\
│   │   └── database.js          # DB 연결 설정
│   └── routes\                   # API 라우트
│       ├── orderManagement.js   # 주문 관리 API
│       ├── productManagement.js # 상품 관리 API
│       ├── userManagement.js    # 사용자 관리 API
│       ├── noticeManagement.js  # 공지 관리 API
│       ├── basicInfo.js         # 기준정보 API
│       ├── marketConnection.js  # 마켓연동 API
│       └── detailPageManagement.js # 상세페이지 API
├── web-client\                   # 프론트엔드 소스
│   ├── src\
│   │   ├── components\          # React 컴포넌트
│   │   ├── contexts\            # Context API
│   │   └── main.tsx             # 진입점
│   ├── public\
│   └── package.json
├── server.js                     # 백엔드 진입점
├── package.json                  # 백엔드 의존성
└── .env                          # 환경 변수 (로컬)
```

### 1.2 필요한 정보 준비

배포 전에 다음 정보를 준비하세요:

**데이터베이스 정보**:
- [ ] DB 서버 IP 주소: `_________________`
- [ ] DB 포트: `1433` (기본값)
- [ ] DB 이름: `_________________`
- [ ] DB 사용자: `_________________`
- [ ] DB 비밀번호: `_________________`

**서버 정보**:
- [ ] 서버 IP 주소: `_________________`
- [ ] 도메인 (있는 경우): `_________________`

---

## 2. 필수 소프트웨어 설치

### 2.1 Node.js 설치 (필수)

#### 단계 1: 다운로드
1. 브라우저에서 https://nodejs.org/ 접속
2. **LTS (Long Term Support)** 버전의 "Windows Installer (.msi) 64-bit" 다운로드
3. 예: `node-v20.11.0-x64.msi`

#### 단계 2: 설치
1. 다운로드한 `.msi` 파일 실행
2. "Next" 클릭
3. 라이선스 동의 → "Next"
4. 설치 경로: 기본값 사용 (`C:\Program Files\nodejs\`) → "Next"
5. **중요**: "Automatically install the necessary tools" 체크 → "Next"
6. "Install" 클릭
7. 설치 완료 후 "Finish"

#### 단계 3: 설치 확인
```powershell
# PowerShell 새로 열기 (관리자 권한)
node --version
# 출력 예: v20.11.0

npm --version
# 출력 예: 10.2.4
```

**✅ 성공**: 버전 번호가 표시되면 정상 설치  
**❌ 실패**: 'node'은(는) 내부 또는 외부 명령... 오류 → 재설치 필요

---

### 2.2 IIS 설치 (필수)

#### 단계 1: PowerShell 관리자 권한 실행
1. `Win + X` 키 누르기
2. "Windows PowerShell (관리자)" 또는 "터미널 (관리자)" 선택

#### 단계 2: IIS 설치
```powershell
# 다음 명령어 입력 후 Enter
Install-WindowsFeature -name Web-Server -IncludeManagementTools

# 설치 진행 (약 2-3분 소요)
# Success: True 확인
```

#### 단계 3: 설치 확인
```powershell
# IIS 관리자 실행
inetmgr
```

**✅ 성공**: IIS 관리자 창이 열리면 정상 설치  
**❌ 실패**: 명령어를 찾을 수 없음 → 재설치 필요

#### 단계 4: 기본 웹사이트 테스트
1. 브라우저에서 `http://localhost` 접속
2. IIS 기본 페이지가 표시되면 정상

---

### 2.3 URL Rewrite Module 설치 (필수)

#### 단계 1: 다운로드
1. 브라우저에서 https://www.iis.net/downloads/microsoft/url-rewrite 접속
2. "Install this extension" 클릭
3. `rewrite_amd64_en-US.msi` 다운로드

#### 단계 2: 설치
1. 다운로드한 `.msi` 파일 실행
2. "I accept..." 체크 → "Install"
3. 설치 완료 후 "Finish"

#### 단계 3: 설치 확인
1. IIS 관리자 실행 (`inetmgr`)
2. 서버 노드 또는 사이트 선택
3. 중앙 패널에서 **"URL Rewrite"** 아이콘 확인

**✅ 성공**: URL Rewrite 아이콘이 보이면 정상 설치  
**❌ 실패**: 아이콘이 없으면 IIS 관리자 재시작 후 재확인

---

### 2.4 Application Request Routing (ARR) 설치 (필수)

#### 단계 1: 다운로드
1. 브라우저에서 https://www.iis.net/downloads/microsoft/application-request-routing 접속
2. "Install this extension" 클릭
3. `requestRouter_amd64.msi` 다운로드

#### 단계 2: 설치
1. 다운로드한 `.msi` 파일 실행
2. "I accept..." 체크 → "Install"
3. 설치 완료 후 "Finish"

#### 단계 3: 설치 확인
1. IIS 관리자 실행
2. 서버 노드 (최상위) 선택
3. **"Application Request Routing Cache"** 아이콘 확인

**✅ 성공**: ARR Cache 아이콘이 보이면 정상 설치

---

### 2.5 PM2 설치 (필수)

#### 단계 1: PM2 설치
```powershell
# PowerShell 관리자 권한으로 실행
npm install -g pm2

# 설치 확인
pm2 --version
# 출력 예: 5.3.0
```

#### 단계 2: Windows 서비스 등록
```powershell
# PM2 Windows 서비스 패키지 설치
npm install -g pm2-windows-startup

# Windows 서비스로 등록
pm2-startup install

# 출력: PM2 서비스가 설치되었습니다.
```

**✅ 성공**: "PM2 서비스가 설치되었습니다" 메시지 확인

---

## 3. 백엔드 배포 (Node.js API 서버)

### 3.1 배포 폴더 생성

```powershell
# PowerShell에서 실행
mkdir C:\inetpub\api
mkdir C:\inetpub\api\uploads

# 폴더 생성 확인
ls C:\inetpub\
```

**결과**:
```
Mode                 LastWriteTime         Length Name
----                 -------------         ------ ----
d----          2026-03-18  오후 5:00                api
```

---

### 3.2 백엔드 파일 복사

#### 방법 A: 수동 복사 (초보자 권장)

1. **파일 탐색기 열기**:
   - `Win + E` 키 누르기

2. **소스 폴더 열기**:
   - 주소창에 `C:\Cursor_Projects\C1BWebClient` 입력

3. **다음 파일/폴더 복사**:
   - `backend` 폴더 전체
   - `server.js` 파일
   - `package.json` 파일
   - `package-lock.json` 파일

4. **대상 폴더에 붙여넣기**:
   - `C:\inetpub\api`로 이동
   - 복사한 파일들 붙여넣기 (`Ctrl + V`)

#### 방법 B: PowerShell 명령어

```powershell
# 소스 경로
$source = "C:\Cursor_Projects\C1BWebClient"

# backend 폴더 복사
Copy-Item -Path "$source\backend" -Destination "C:\inetpub\api\backend" -Recurse -Force

# 파일 복사
Copy-Item -Path "$source\server.js" -Destination "C:\inetpub\api\" -Force
Copy-Item -Path "$source\package.json" -Destination "C:\inetpub\api\" -Force
Copy-Item -Path "$source\package-lock.json" -Destination "C:\inetpub\api\" -Force

# 복사 확인
ls C:\inetpub\api
```

**확인 결과**:
```
Mode                 LastWriteTime         Length Name
----                 -------------         ------ ----
d----          2026-03-18  오후 5:05                backend
d----          2026-03-18  오후 5:00                uploads
-a---          2026-03-18  오후 5:05           1234 server.js
-a---          2026-03-18  오후 5:05            567 package.json
-a---          2026-03-18  오후 5:05          12345 package-lock.json
```

---

### 3.3 환경 변수 파일 생성 (.env)

#### 단계 1: .env 파일 생성

1. **메모장 실행**:
   - `Win + R` → `notepad` 입력 → Enter

2. **다음 내용 입력** (실제 값으로 변경):

```env
# 데이터베이스 설정
DB_SERVER=192.168.1.100
DB_PORT=1433
DB_DATABASE=C1B_DB
DB_USER=sa
DB_PASSWORD=YourPassword123!
DB_TRUST_SERVER_CERTIFICATE=true

# 서버 설정
PORT=3001
NODE_ENV=production

# 업로드 경로 (절대 경로)
UPLOAD_PATH=C:\inetpub\api\uploads
```

3. **저장**:
   - 파일 → 다른 이름으로 저장
   - 저장 위치: `C:\inetpub\api`
   - 파일 이름: `.env` (점 포함)
   - 파일 형식: **모든 파일 (*.*)**
   - 저장 클릭

**⚠️ 중요**:
- `DB_SERVER`: 실제 SQL Server IP 주소로 변경
- `DB_DATABASE`: 실제 데이터베이스 이름으로 변경
- `DB_USER`, `DB_PASSWORD`: 실제 DB 계정 정보로 변경

#### 단계 2: .env 파일 확인

```powershell
# PowerShell에서 확인
Get-Content C:\inetpub\api\.env

# 출력 예:
# DB_SERVER=192.168.1.100
# DB_PORT=1433
# ...
```

---

### 3.4 백엔드 의존성 설치

```powershell
# C:\inetpub\api 폴더로 이동
cd C:\inetpub\api

# 의존성 설치 (약 2-3분 소요)
npm install --production

# 설치 진행 중 메시지:
# npm WARN deprecated ...
# added 123 packages in 2m
```

**설치되는 주요 패키지**:
- `express`: 웹 서버 프레임워크
- `mssql`: SQL Server 연결
- `cors`: CORS 설정
- `dotenv`: 환경 변수 관리
- `multer`: 파일 업로드
- 기타 의존성...

**✅ 성공**: "added XXX packages" 메시지 확인  
**❌ 실패**: 에러 메시지 확인 후 재시도

---

### 3.5 PM2로 백엔드 실행

#### 단계 1: PM2로 백엔드 시작

```powershell
# C:\inetpub\api 폴더에서 실행
cd C:\inetpub\api

# PM2로 백엔드 시작
pm2 start server.js --name "c1b-api"

# 출력:
# [PM2] Starting server.js in fork_mode (1 instance)
# [PM2] Done.
```

#### 단계 2: 상태 확인

```powershell
pm2 status
```

**정상 출력**:
```
┌─────┬──────────┬─────────────┬─────────┬─────────┬──────────┬────────┬──────┬───────────┬──────────┬──────────┬──────────┬──────────┐
│ id  │ name     │ namespace   │ version │ mode    │ pid      │ uptime │ ↺    │ status    │ cpu      │ mem      │ user     │ watching │
├─────┼──────────┼─────────────┼─────────┼─────────┼──────────┼────────┼──────┼───────────┼──────────┼──────────┼──────────┼──────────┤
│ 0   │ c1b-api  │ default     │ 1.0.0   │ fork    │ 12345    │ 2s     │ 0    │ online    │ 0%       │ 45.2mb   │ Admin    │ disabled │
└─────┴──────────┴─────────────┴─────────┴─────────┴──────────┴────────┴──────┴───────────┴──────────┴──────────┴──────────┴──────────┘
```

**✅ 성공**: status가 **"online"**이면 정상  
**❌ 실패**: status가 "errored" 또는 "stopped"이면 로그 확인 필요

#### 단계 3: 로그 확인

```powershell
pm2 logs c1b-api --lines 20
```

**정상 로그 예시**:
```
0|c1b-api  | ✅ MSSQL 데이터베이스 연결 성공
0|c1b-api  | 📍 http://localhost:3001
0|c1b-api  | ✅ 서버가 포트 3001에서 실행 중입니다.
```

**에러 발생 시**:
- `❌ 데이터베이스 연결 실패` → `.env` 파일의 DB 정보 확인
- `Error: listen EADDRINUSE` → 포트 3001이 이미 사용 중

#### 단계 4: 자동 시작 설정

```powershell
# 현재 PM2 상태를 저장 (서버 재부팅 시 자동 시작)
pm2 save

# 출력:
# [PM2] Saving current process list...
# [PM2] Successfully saved in ...
```

---

### 3.6 방화벽 포트 열기

```powershell
# PowerShell 관리자 권한으로 실행
New-NetFirewallRule -DisplayName "C1B Backend API" -Direction Inbound -LocalPort 3001 -Protocol TCP -Action Allow

# 출력:
# Name                  : {GUID}
# DisplayName           : C1B Backend API
# ...
```

#### 방화벽 규칙 확인

```powershell
Get-NetFirewallRule -DisplayName "C1B Backend API"
```

---

### 3.7 백엔드 테스트

#### 테스트 1: 로컬 접속
```powershell
# 브라우저에서 접속
http://localhost:3001
```

**예상 결과**: 
- 빈 화면 또는 "Cannot GET /" 메시지 (정상)
- API 서버가 실행 중이라는 의미

#### 테스트 2: 외부 접속 (다른 PC에서)
```
http://서버IP:3001
```

**✅ 성공**: 접속되면 정상  
**❌ 실패**: 방화벽 규칙 재확인 필요

---

## 4. 프론트엔드 배포 (React 웹 애플리케이션)

### 4.1 환경 변수 설정 (.env.production)

#### 단계 1: .env.production 파일 생성

1. **메모장 실행**
2. **다음 내용 입력**:

```env
# API 서버 주소 (리버스 프록시 사용)
VITE_API_URL=/api
```

**설명**:
- `/api`: IIS가 이 경로를 백엔드(3001 포트)로 프록시
- 예: `http://localhost/api/orders` → `http://localhost:3001/api/orders`

3. **저장**:
   - 저장 위치: `C:\Cursor_Projects\C1BWebClient\web-client`
   - 파일 이름: `.env.production`
   - 파일 형식: **모든 파일 (*.*)**

---

### 4.2 API URL 코드 수정

현재 프로젝트의 모든 컴포넌트에서 API URL을 하드코딩하고 있습니다. 환경 변수를 사용하도록 수정해야 합니다.

#### 수정이 필요한 파일 목록 (총 14개)

1. `web-client/src/components/Dashboard.tsx`
2. `web-client/src/components/OrderPage.tsx`
3. `web-client/src/components/ChartSection.tsx`
4. `web-client/src/components/OrderStatusCards.tsx`
5. `web-client/src/components/ProductPage.tsx`
6. `web-client/src/components/UserManagementPage.tsx`
7. `web-client/src/components/NoticeManagementPage.tsx`
8. `web-client/src/components/NoticeList.tsx`
9. `web-client/src/components/NoticePage.tsx`
10. `web-client/src/components/AccountPage.tsx`
11. `web-client/src/components/BasicInfoPage.tsx`
12. `web-client/src/components/MarketPage.tsx`
13. `web-client/src/components/DetailPageManagement.tsx`
14. `web-client/src/components/LoginPage.tsx`

#### 수정 방법 (각 파일마다 동일)

**기존 코드**:
```typescript
const API_URL = 'http://localhost:3001/api/orders'
```

**수정 후**:
```typescript
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'
const API_URL = `${API_BASE}/api/orders`
```

#### 예시: Dashboard.tsx 수정

**수정 전** (10번째 줄):
```typescript
const API_URL = 'http://localhost:3001/api/orders'
```

**수정 후**:
```typescript
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'
const API_URL = `${API_BASE}/api/orders`
```

#### 각 파일별 수정 내용

| 파일 | 기존 API_URL | 수정 후 |
|------|-------------|---------|
| Dashboard.tsx | `'http://localhost:3001/api/orders'` | `${API_BASE}/api/orders` |
| OrderPage.tsx | `'http://localhost:3001/api/orders'` | `${API_BASE}/api/orders` |
| ChartSection.tsx | `'http://localhost:3001/api/orders'` | `${API_BASE}/api/orders` |
| OrderStatusCards.tsx | `'http://localhost:3001/api/orders'` | `${API_BASE}/api/orders` |
| ProductPage.tsx | `'http://localhost:3001/api/products'` | `${API_BASE}/api/products` |
| UserManagementPage.tsx | `'http://localhost:3001/api/users'` | `${API_BASE}/api/users` |
| NoticeManagementPage.tsx | `'http://localhost:3001/api/notices'` | `${API_BASE}/api/notices` |
| NoticeList.tsx | `'http://localhost:3001/api/notices'` | `${API_BASE}/api/notices` |
| NoticePage.tsx | `'http://localhost:3001/api/notices'` | `${API_BASE}/api/notices` |
| AccountPage.tsx | `'http://localhost:3001/api/users'` | `${API_BASE}/api/users` |
| BasicInfoPage.tsx | `'http://localhost:3001/api/basic-info'` | `${API_BASE}/api/basic-info` |
| MarketPage.tsx | `'http://localhost:3001/api/market'` | `${API_BASE}/api/market` |
| DetailPageManagement.tsx | `'http://localhost:3001/api/detail-page'` | `${API_BASE}/api/detail-page` |
| LoginPage.tsx | `'http://localhost:3001/api/users'` | `${API_BASE}/api/users` |

**⚠️ 중요**: 14개 파일 모두 수정해야 합니다!

---

### 4.3 프론트엔드 빌드

#### 단계 1: 프론트엔드 폴더로 이동

```powershell
cd C:\Cursor_Projects\C1BWebClient\web-client
```

#### 단계 2: 의존성 설치 (처음 한 번만)

```powershell
npm install

# 설치 진행 (약 3-5분 소요)
# added 456 packages in 3m
```

#### 단계 3: 프로덕션 빌드

```powershell
npm run build

# 빌드 진행 메시지:
# vite v5.x.x building for production...
# ✓ 1234 modules transformed.
# dist/index.html                  1.23 kB
# dist/assets/index-abc123.js      234.56 kB
# dist/assets/index-def456.css     12.34 kB
# ✓ built in 15.23s
```

**✅ 성공**: "built in XXs" 메시지 확인  
**❌ 실패**: 에러 메시지 확인

#### 단계 4: 빌드 결과 확인

```powershell
ls dist

# 출력:
# Mode                 LastWriteTime         Length Name
# ----                 -------------         ------ ----
# d----          2026-03-18  오후 5:15                assets
# -a---          2026-03-18  오후 5:15           1234 index.html
# -a---          2026-03-18  오후 5:15            123 vite.svg
```

---

### 4.4 빌드 파일 IIS로 복사

#### 방법 A: 수동 복사

1. **파일 탐색기**에서 `C:\Cursor_Projects\C1BWebClient\web-client\dist` 폴더 열기
2. 모든 파일 선택 (`Ctrl + A`)
3. 복사 (`Ctrl + C`)
4. `C:\inetpub\wwwroot\storeboard` 폴더로 이동
5. 붙여넣기 (`Ctrl + V`)

#### 방법 B: PowerShell 명령어

```powershell
# 대상 폴더 생성
mkdir C:\inetpub\wwwroot\storeboard

# 파일 복사
Copy-Item -Path "C:\Cursor_Projects\C1BWebClient\web-client\dist\*" -Destination "C:\inetpub\wwwroot\storeboard" -Recurse -Force

# 복사 확인
ls C:\inetpub\wwwroot\storeboard
```

**확인 결과**:
```
Mode                 LastWriteTime         Length Name
----                 -------------         ------ ----
d----          2026-03-18  오후 5:20                assets
-a---          2026-03-18  오후 5:20           1234 index.html
-a---          2026-03-18  오후 5:20            123 vite.svg
```

---

### 4.5 web.config 파일 생성

#### 단계 1: web.config 파일 생성

1. **메모장 실행**
2. **다음 내용 복사하여 붙여넣기**:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<configuration>
  <system.webServer>
    <!-- URL 재작성 규칙 -->
    <rewrite>
      <rules>
        <!-- API 프록시: /api/* 요청을 백엔드(3001)로 전달 -->
        <rule name="API Proxy" stopProcessing="true">
          <match url="^api/(.*)" />
          <action type="Rewrite" url="http://localhost:3001/api/{R:1}" />
        </rule>
        
        <!-- React Router: 모든 요청을 index.html로 -->
        <rule name="React Routes" stopProcessing="true">
          <match url=".*" />
          <conditions logicalGrouping="MatchAll">
            <add input="{REQUEST_FILENAME}" matchType="IsFile" negate="true" />
            <add input="{REQUEST_FILENAME}" matchType="IsDirectory" negate="true" />
            <add input="{REQUEST_URI}" pattern="^/api" negate="true" />
          </conditions>
          <action type="Rewrite" url="/" />
        </rule>
      </rules>
    </rewrite>
    
    <!-- MIME 타입 설정 -->
    <staticContent>
      <mimeMap fileExtension=".json" mimeType="application/json" />
      <mimeMap fileExtension=".woff" mimeType="application/font-woff" />
      <mimeMap fileExtension=".woff2" mimeType="application/font-woff2" />
      <mimeMap fileExtension=".js" mimeType="application/javascript" />
      <mimeMap fileExtension=".css" mimeType="text/css" />
    </staticContent>
    
    <!-- 압축 설정 (성능 향상) -->
    <urlCompression doStaticCompression="true" doDynamicCompression="true" />
    
    <!-- 캐시 설정 (1일) -->
    <staticContent>
      <clientCache cacheControlMode="UseMaxAge" cacheControlMaxAge="1.00:00:00" />
    </staticContent>
  </system.webServer>
</configuration>
```

3. **저장**:
   - 저장 위치: `C:\inetpub\wwwroot\storeboard`
   - 파일 이름: `web.config`
   - 파일 형식: **모든 파일 (*.*)**

#### 단계 2: web.config 확인

```powershell
# 파일 존재 확인
Test-Path C:\inetpub\wwwroot\storeboard\web.config

# 출력: True
```

---

### 4.6 IIS 사이트 생성

#### 방법 A: IIS 관리자 GUI (초보자 권장)

**단계 1: IIS 관리자 실행**
```powershell
inetmgr
```

**단계 2: 기본 웹사이트 중지**
1. 좌측 트리에서 "Sites" 확장
2. "Default Web Site" 우클릭
3. "Stop" 클릭

**단계 3: 새 웹사이트 추가**
1. "Sites" 우클릭
2. "Add Website..." 클릭
3. 다음 정보 입력:

| 항목 | 값 |
|------|-----|
| Site name | `C1B-Storeboard` |
| Physical path | `C:\inetpub\wwwroot\storeboard` |
| Type | `http` |
| IP address | `All Unassigned` |
| Port | `80` |
| Host name | (비워둠) |

4. "OK" 클릭

**단계 4: 앱 풀 설정**
1. 좌측 트리에서 "Application Pools" 클릭
2. "C1B-Storeboard" 우클릭 → "Advanced Settings..."
3. 다음 설정 변경:

| 항목 | 값 |
|------|-----|
| .NET CLR Version | `No Managed Code` |
| Start Mode | `AlwaysRunning` |
| Idle Time-out (minutes) | `0` |

4. "OK" 클릭

#### 방법 B: PowerShell 명령어

```powershell
# 모듈 로드
Import-Module WebAdministration

# 기본 웹사이트 중지
Stop-WebSite -Name "Default Web Site"

# 새 웹사이트 생성
New-WebSite -Name "C1B-Storeboard" `
  -PhysicalPath "C:\inetpub\wwwroot\storeboard" `
  -Port 80 `
  -Force

# 앱 풀 설정
Set-ItemProperty "IIS:\AppPools\C1B-Storeboard" -Name "managedRuntimeVersion" -Value ""
Set-ItemProperty "IIS:\AppPools\C1B-Storeboard" -Name "startMode" -Value "AlwaysRunning"
Set-ItemProperty "IIS:\AppPools\C1B-Storeboard" -Name "processModel.idleTimeout" -Value "00:00:00"

# 사이트 시작
Start-WebSite -Name "C1B-Storeboard"

# 상태 확인
Get-WebSite -Name "C1B-Storeboard"
```

**정상 출력**:
```
Name            ID   State      Physical Path                          Bindings
----            --   -----      -------------                          --------
C1B-Storeboard  2    Started    C:\inetpub\wwwroot\storeboard         http *:80:
```

---

### 4.7 방화벽 포트 열기

```powershell
# HTTP (포트 80)
New-NetFirewallRule -DisplayName "C1B Frontend HTTP" -Direction Inbound -LocalPort 80 -Protocol TCP -Action Allow

# HTTPS (포트 443) - 나중에 사용
New-NetFirewallRule -DisplayName "C1B Frontend HTTPS" -Direction Inbound -LocalPort 443 -Protocol TCP -Action Allow
```

---

### 4.8 프론트엔드 테스트

#### 테스트 1: 로컬 접속
```
브라우저에서 http://localhost 접속
```

**예상 결과**:
- C1B 스토어보드 로그인 페이지가 표시됨
- 로고와 로그인 폼이 보임

**✅ 성공**: 로그인 페이지가 정상 표시  
**❌ 실패**: 
- 404 오류 → IIS 사이트 상태 확인
- 빈 화면 → 브라우저 개발자 도구(F12) 콘솔 확인

#### 테스트 2: 로그인 테스트
1. 데이터베이스의 `tb_user` 테이블에서 계정 확인
2. 로그인 시도
3. 대시보드로 이동되는지 확인

**✅ 성공**: 대시보드가 표시되고 데이터가 로드됨  
**❌ 실패**: 
- 로그인 실패 → 백엔드 로그 확인 (`pm2 logs c1b-api`)
- 데이터 없음 → API 프록시 설정 확인 (다음 단계)

---

## 5. IIS 리버스 프록시 설정

### 5.1 ARR 프록시 활성화

#### 방법 A: IIS 관리자 GUI

**단계 1: ARR 설정 열기**
1. IIS 관리자 실행 (`inetmgr`)
2. 좌측 트리에서 **서버 노드 (최상위)** 선택
3. 중앙 패널에서 **"Application Request Routing Cache"** 더블클릭

**단계 2: 프록시 활성화**
1. 우측 "Actions" 패널에서 **"Server Proxy Settings..."** 클릭
2. **"Enable proxy"** 체크박스 체크
3. "Apply" 클릭
4. 확인 메시지: "The changes have been saved"

#### 방법 B: PowerShell 명령어

```powershell
# ARR 프록시 활성화
Set-WebConfigurationProperty -pspath 'MACHINE/WEBROOT/APPHOST' -filter "system.webServer/proxy" -name "enabled" -value "True"

# 확인
Get-WebConfigurationProperty -pspath 'MACHINE/WEBROOT/APPHOST' -filter "system.webServer/proxy" -name "enabled"

# 출력: Value : True
```

**✅ 성공**: Value가 True이면 정상

---

### 5.2 IIS 재시작

```powershell
# IIS 재시작
iisreset /restart

# 출력:
# Attempting stop...
# Internet services successfully stopped
# Attempting start...
# Internet services successfully restarted
```

---

### 5.3 프록시 테스트

#### 테스트 1: 브라우저에서 직접 API 호출

```
# 브라우저 주소창에 입력
http://localhost/api/orders/stores/user1
```

**예상 결과**:
```json
{
  "success": true,
  "data": [
    {"user_id": "user1", "biz_idx": 1, "store_name": "엠오지"},
    {"user_id": "user1", "biz_idx": 2, "store_name": "엠오지2"}
  ]
}
```

**✅ 성공**: JSON 데이터가 표시되면 프록시 정상 작동  
**❌ 실패**: 
- 404 오류 → web.config 프록시 규칙 확인
- 500 오류 → 백엔드 로그 확인 (`pm2 logs c1b-api`)

#### 테스트 2: 프론트엔드에서 API 호출

1. 브라우저에서 `http://localhost` 접속
2. 로그인
3. 대시보드 데이터가 로드되는지 확인
4. F12 (개발자 도구) → Network 탭에서 API 호출 확인

**정상 동작**:
- `/api/orders/...` 요청이 성공 (200 OK)
- 대시보드에 주문현황, 차트 데이터 표시

---

## 6. 보안 설정 (HTTPS)

### 6.1 SSL 인증서 준비

#### 옵션 A: Let's Encrypt (무료, 권장)

**Win-ACME 설치**

**단계 1: 다운로드**
1. https://www.win-acme.com/ 접속
2. "Download" 클릭
3. `win-acme.v2.x.x.x64.trimmed.zip` 다운로드

**단계 2: 압축 해제**
```powershell
# 폴더 생성
mkdir C:\Tools\win-acme

# zip 파일을 C:\Tools\win-acme에 압축 해제
```

**단계 3: SSL 인증서 발급**
```powershell
# PowerShell 관리자 권한으로 실행
cd C:\Tools\win-acme
.\wacs.exe
```

**메뉴 선택**:
```
1. N: Create certificate (default settings)
2. 1: Single binding of an IIS site
3. 사이트 선택: C1B-Storeboard (번호 입력)
4. 도메인 확인 (예: storeboard.yourdomain.com)
5. 이메일 입력: your-email@example.com
6. 동의: yes
7. 자동 갱신 설정: yes
```

**✅ 성공**: "Certificate installed successfully" 메시지 확인

#### 옵션 B: 자체 서명 인증서 (테스트용)

```powershell
# 자체 서명 인증서 생성
$cert = New-SelfSignedCertificate -DnsName "localhost", "server-ip" -CertStoreLocation "cert:\LocalMachine\My"

# 인증서 Thumbprint 확인
$cert.Thumbprint

# 출력: ABC123DEF456... (인증서 ID)
```

**⚠️ 주의**: 자체 서명 인증서는 브라우저에서 경고 표시됨 (테스트용으로만 사용)

---

### 6.2 IIS에 HTTPS 바인딩 추가

#### 방법 A: IIS 관리자 GUI

**단계 1: 바인딩 추가**
1. IIS 관리자에서 "C1B-Storeboard" 사이트 선택
2. 우측 "Actions" 패널에서 "Bindings..." 클릭
3. "Add..." 클릭
4. 설정:
   - Type: `https`
   - IP address: `All Unassigned`
   - Port: `443`
   - SSL certificate: 설치한 인증서 선택
5. "OK" 클릭
6. "Close" 클릭

#### 방법 B: PowerShell 명령어

```powershell
# HTTPS 바인딩 추가
New-WebBinding -Name "C1B-Storeboard" -Protocol "https" -Port 443 -IPAddress "*"

# 인증서 바인딩
$cert = Get-ChildItem -Path Cert:\LocalMachine\My | Where-Object {$_.Subject -like "*your-domain*"}
$binding = Get-WebBinding -Name "C1B-Storeboard" -Protocol "https"
$binding.AddSslCertificate($cert.Thumbprint, "My")

# 확인
Get-WebBinding -Name "C1B-Storeboard"
```

---

### 6.3 HTTP to HTTPS 리다이렉션

`C:\inetpub\wwwroot\storeboard\web.config` 파일 수정:

**기존 `<rewrite>` 섹션 안에 추가**:

```xml
<rewrite>
  <rules>
    <!-- HTTP to HTTPS 리다이렉션 (맨 위에 추가) -->
    <rule name="HTTP to HTTPS" stopProcessing="true">
      <match url="(.*)" />
      <conditions>
        <add input="{HTTPS}" pattern="^OFF$" />
      </conditions>
      <action type="Redirect" url="https://{HTTP_HOST}/{R:1}" redirectType="Permanent" />
    </rule>
    
    <!-- 기존 규칙들... -->
    <rule name="API Proxy" stopProcessing="true">
      ...
    </rule>
  </rules>
</rewrite>
```

**저장 후 IIS 재시작**:
```powershell
iisreset /restart
```

**테스트**:
- `http://localhost` 접속 → 자동으로 `https://localhost`로 리다이렉션

---

## 7. 자동 배포 스크립트

### 7.1 배포 스크립트 폴더 생성

```powershell
mkdir C:\Apps\C1B
```

---

### 7.2 deploy.ps1 (배포 스크립트) 생성

**단계 1: 메모장 실행 → 다음 내용 입력**

```powershell
# ============================================
# C1B 스토어보드 자동 배포 스크립트
# ============================================

param(
    [switch]$BackendOnly,
    [switch]$FrontendOnly
)

# 색상 정의
$Green = "Green"
$Yellow = "Yellow"
$Cyan = "Cyan"
$Red = "Red"

Write-Host "╔════════════════════════════════════════════════╗" -ForegroundColor $Cyan
Write-Host "║   C1B 스토어보드 자동 배포 스크립트           ║" -ForegroundColor $Cyan
Write-Host "╚════════════════════════════════════════════════╝" -ForegroundColor $Cyan
Write-Host ""
Write-Host "배포 시작 시간: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor $Cyan
Write-Host ""

# 경로 설정
$sourcePath = "C:\Cursor_Projects\C1BWebClient"
$backendPath = "C:\inetpub\api"
$frontendPath = "C:\inetpub\wwwroot\storeboard"
$siteName = "C1B-Storeboard"

# 백엔드 배포
if (-not $FrontendOnly) {
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor $Yellow
    Write-Host "  백엔드 배포 시작" -ForegroundColor $Yellow
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor $Yellow
    
    try {
        Write-Host "`n  [1/5] 백엔드 파일 복사 중..." -ForegroundColor White
        Copy-Item -Path "$sourcePath\backend" -Destination "$backendPath\backend" -Recurse -Force -ErrorAction Stop
        Copy-Item -Path "$sourcePath\server.js" -Destination "$backendPath\" -Force -ErrorAction Stop
        Copy-Item -Path "$sourcePath\package.json" -Destination "$backendPath\" -Force -ErrorAction Stop
        Copy-Item -Path "$sourcePath\package-lock.json" -Destination "$backendPath\" -Force -ErrorAction Stop
        Write-Host "  ✅ 파일 복사 완료" -ForegroundColor $Green
        
        Write-Host "`n  [2/5] 백엔드 의존성 설치 중..." -ForegroundColor White
        cd $backendPath
        npm install --production 2>&1 | Out-Null
        Write-Host "  ✅ 의존성 설치 완료" -ForegroundColor $Green
        
        Write-Host "`n  [3/5] 백엔드 재시작 중..." -ForegroundColor White
        pm2 restart c1b-api 2>&1 | Out-Null
        Write-Host "  ✅ 백엔드 재시작 완료" -ForegroundColor $Green
        
        Write-Host "`n  [4/5] 백엔드 상태 확인 중..." -ForegroundColor White
        Start-Sleep -Seconds 3
        $status = pm2 jlist | ConvertFrom-Json | Where-Object { $_.name -eq "c1b-api" }
        if ($status.pm2_env.status -eq "online") {
            Write-Host "  ✅ 백엔드 정상 실행 중 (PID: $($status.pid))" -ForegroundColor $Green
        } else {
            Write-Host "  ⚠️  백엔드 상태: $($status.pm2_env.status)" -ForegroundColor $Red
        }
        
        Write-Host "`n  [5/5] 백엔드 로그 확인..." -ForegroundColor White
        pm2 logs c1b-api --lines 5 --nostream
        
    } catch {
        Write-Host "  ❌ 백엔드 배포 중 오류 발생: $($_.Exception.Message)" -ForegroundColor $Red
        exit 1
    }
}

# 프론트엔드 배포
if (-not $BackendOnly) {
    Write-Host "`n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor $Yellow
    Write-Host "  프론트엔드 배포 시작" -ForegroundColor $Yellow
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor $Yellow
    
    try {
        Write-Host "`n  [1/6] 프론트엔드 빌드 중..." -ForegroundColor White
        cd "$sourcePath\web-client"
        npm install 2>&1 | Out-Null
        npm run build
        Write-Host "  ✅ 빌드 완료" -ForegroundColor $Green
        
        Write-Host "`n  [2/6] IIS 사이트 중지 중..." -ForegroundColor White
        Import-Module WebAdministration
        Stop-WebSite -Name $siteName -ErrorAction SilentlyContinue
        Write-Host "  ✅ IIS 사이트 중지 완료" -ForegroundColor $Green
        
        Write-Host "`n  [3/6] 기존 파일 백업 중..." -ForegroundColor White
        $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
        $backupPath = "C:\Backups\C1B\frontend_$timestamp"
        New-Item -ItemType Directory -Force -Path $backupPath | Out-Null
        
        if (Test-Path "$frontendPath\*") {
            Copy-Item -Path "$frontendPath\*" -Destination $backupPath -Recurse -Force -ErrorAction Stop
            Write-Host "  ✅ 백업 완료: $backupPath" -ForegroundColor $Green
        } else {
            Write-Host "  ℹ️  백업할 파일이 없습니다 (최초 배포)" -ForegroundColor $Cyan
        }
        
        Write-Host "`n  [4/6] 기존 파일 삭제 중..." -ForegroundColor White
        if (Test-Path "$frontendPath\*") {
            Remove-Item -Path "$frontendPath\*" -Recurse -Force -ErrorAction Stop
        }
        Write-Host "  ✅ 기존 파일 삭제 완료" -ForegroundColor $Green
        
        Write-Host "`n  [5/6] 새 파일 배포 중..." -ForegroundColor White
        Copy-Item -Path "$sourcePath\web-client\dist\*" -Destination $frontendPath -Recurse -Force -ErrorAction Stop
        Write-Host "  ✅ 파일 배포 완료" -ForegroundColor $Green
        
        Write-Host "`n  [6/6] IIS 사이트 시작 중..." -ForegroundColor White
        Start-WebSite -Name $siteName
        Write-Host "  ✅ IIS 사이트 시작 완료" -ForegroundColor $Green
        
    } catch {
        Write-Host "  ❌ 프론트엔드 배포 중 오류 발생: $($_.Exception.Message)" -ForegroundColor $Red
        
        # 롤백 시도
        if (Test-Path $backupPath) {
            Write-Host "`n  🔄 롤백 시도 중..." -ForegroundColor $Yellow
            Copy-Item -Path "$backupPath\*" -Destination $frontendPath -Recurse -Force
            Start-WebSite -Name $siteName
            Write-Host "  ✅ 롤백 완료" -ForegroundColor $Green
        }
        exit 1
    }
}

# 배포 완료 메시지
Write-Host "`n╔════════════════════════════════════════════════╗" -ForegroundColor $Green
Write-Host "║          배포 완료!                            ║" -ForegroundColor $Green
Write-Host "╚════════════════════════════════════════════════╝" -ForegroundColor $Green
Write-Host ""
Write-Host "📱 프론트엔드: http://localhost" -ForegroundColor $Cyan
Write-Host "🔌 백엔드 API: http://localhost:3001" -ForegroundColor $Cyan
Write-Host ""
Write-Host "현재 실행 중인 서비스:" -ForegroundColor $Yellow
pm2 status
Write-Host ""
Get-WebSite -Name $siteName | Format-Table Name, State, @{Name="Bindings";Expression={$_.bindings.Collection.bindingInformation}} -AutoSize

Write-Host "`n배포 로그 확인:" -ForegroundColor $Yellow
Write-Host "  pm2 logs c1b-api" -ForegroundColor White
Write-Host "  Get-Content C:\inetpub\logs\LogFiles\W3SVC*\*.log -Tail 50" -ForegroundColor White
Write-Host ""
```

**단계 2: 저장**
- 저장 위치: `C:\Apps\C1B\deploy.ps1`
- 파일 형식: **모든 파일 (*.*)**

---

### 7.3 rollback.ps1 (롤백 스크립트) 생성

```powershell
# ============================================
# C1B 스토어보드 롤백 스크립트
# ============================================

param(
    [Parameter(Mandatory=$true)]
    [string]$BackupTimestamp
)

$Green = "Green"
$Yellow = "Yellow"
$Red = "Red"
$Cyan = "Cyan"

Write-Host "╔════════════════════════════════════════════════╗" -ForegroundColor $Yellow
Write-Host "║   C1B 스토어보드 롤백 스크립트                 ║" -ForegroundColor $Yellow
Write-Host "╚════════════════════════════════════════════════╝" -ForegroundColor $Yellow
Write-Host ""

$backupPath = "C:\Backups\C1B\frontend_$BackupTimestamp"
$frontendPath = "C:\inetpub\wwwroot\storeboard"
$siteName = "C1B-Storeboard"

# 백업 존재 확인
if (-not (Test-Path $backupPath)) {
    Write-Host "❌ 백업을 찾을 수 없습니다: $backupPath" -ForegroundColor $Red
    Write-Host ""
    Write-Host "사용 가능한 백업 목록:" -ForegroundColor $Yellow
    Get-ChildItem -Path "C:\Backups\C1B" -Directory | Sort-Object Name -Descending | Select-Object -First 10 | Format-Table Name, CreationTime
    exit 1
}

Write-Host "백업 위치: $backupPath" -ForegroundColor $Cyan
Write-Host ""

try {
    Write-Host "[1/4] IIS 사이트 중지 중..." -ForegroundColor White
    Import-Module WebAdministration
    Stop-WebSite -Name $siteName
    Write-Host "✅ 사이트 중지 완료" -ForegroundColor $Green
    
    Write-Host "`n[2/4] 현재 파일 삭제 중..." -ForegroundColor White
    Remove-Item -Path "$frontendPath\*" -Recurse -Force
    Write-Host "✅ 파일 삭제 완료" -ForegroundColor $Green
    
    Write-Host "`n[3/4] 백업 파일 복원 중..." -ForegroundColor White
    Copy-Item -Path "$backupPath\*" -Destination $frontendPath -Recurse -Force
    Write-Host "✅ 파일 복원 완료" -ForegroundColor $Green
    
    Write-Host "`n[4/4] IIS 사이트 시작 중..." -ForegroundColor White
    Start-WebSite -Name $siteName
    Write-Host "✅ 사이트 시작 완료" -ForegroundColor $Green
    
    Write-Host "`n╔════════════════════════════════════════════════╗" -ForegroundColor $Green
    Write-Host "║          롤백 완료!                            ║" -ForegroundColor $Green
    Write-Host "╚════════════════════════════════════════════════╝" -ForegroundColor $Green
    
} catch {
    Write-Host "`n❌ 롤백 중 오류 발생: $($_.Exception.Message)" -ForegroundColor $Red
    exit 1
}
```

**저장**:
- 저장 위치: `C:\Apps\C1B\rollback.ps1`

---

### 7.4 backup.ps1 (백업 스크립트) 생성

```powershell
# ============================================
# C1B 스토어보드 백업 스크립트
# ============================================

$Green = "Green"
$Yellow = "Yellow"
$Cyan = "Cyan"

Write-Host "╔════════════════════════════════════════════════╗" -ForegroundColor $Cyan
Write-Host "║   C1B 스토어보드 백업 스크립트                 ║" -ForegroundColor $Cyan
Write-Host "╚════════════════════════════════════════════════╝" -ForegroundColor $Cyan
Write-Host ""
Write-Host "백업 시작 시간: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor $Cyan
Write-Host ""

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupRoot = "C:\Backups\C1B"

# 백업 폴더 생성
New-Item -ItemType Directory -Force -Path "$backupRoot\$timestamp" | Out-Null

try {
    # 백엔드 백업
    Write-Host "[1/4] 백엔드 백업 중..." -ForegroundColor $Yellow
    Copy-Item -Path "C:\inetpub\api" -Destination "$backupRoot\$timestamp\api" -Recurse -Force -Exclude "node_modules","logs","uploads"
    Write-Host "✅ 백엔드 백업 완료" -ForegroundColor $Green
    
    # 프론트엔드 백업
    Write-Host "`n[2/4] 프론트엔드 백업 중..." -ForegroundColor $Yellow
    Copy-Item -Path "C:\inetpub\wwwroot\storeboard" -Destination "$backupRoot\$timestamp\storeboard" -Recurse -Force
    Write-Host "✅ 프론트엔드 백업 완료" -ForegroundColor $Green
    
    # 압축
    Write-Host "`n[3/4] 백업 압축 중..." -ForegroundColor $Yellow
    Compress-Archive -Path "$backupRoot\$timestamp" -DestinationPath "$backupRoot\backup_$timestamp.zip" -Force
    Remove-Item -Path "$backupRoot\$timestamp" -Recurse -Force
    Write-Host "✅ 압축 완료" -ForegroundColor $Green
    
    # 오래된 백업 삭제 (30일 이상)
    Write-Host "`n[4/4] 오래된 백업 삭제 중..." -ForegroundColor $Yellow
    $oldBackups = Get-ChildItem -Path $backupRoot -Filter "*.zip" | Where-Object { $_.CreationTime -lt (Get-Date).AddDays(-30) }
    if ($oldBackups) {
        $oldBackups | Remove-Item -Force
        Write-Host "✅ $($oldBackups.Count)개의 오래된 백업 삭제 완료" -ForegroundColor $Green
    } else {
        Write-Host "✅ 삭제할 오래된 백업 없음" -ForegroundColor $Green
    }
    
    Write-Host "`n╔════════════════════════════════════════════════╗" -ForegroundColor $Green
    Write-Host "║          백업 완료!                            ║" -ForegroundColor $Green
    Write-Host "╚════════════════════════════════════════════════╝" -ForegroundColor $Green
    Write-Host ""
    Write-Host "백업 파일: $backupRoot\backup_$timestamp.zip" -ForegroundColor $Cyan
    
    # 백업 목록 표시
    Write-Host "`n현재 백업 목록:" -ForegroundColor $Yellow
    Get-ChildItem -Path $backupRoot -Filter "*.zip" | Sort-Object CreationTime -Descending | Select-Object Name, @{Name="크기(MB)";Expression={[math]::Round($_.Length/1MB,2)}}, CreationTime | Format-Table -AutoSize
    
} catch {
    Write-Host "`n❌ 백업 중 오류 발생: $($_.Exception.Message)" -ForegroundColor $Red
    exit 1
}
```

**저장**:
- 저장 위치: `C:\Apps\C1B\backup.ps1`

---

### 7.5 배포 스크립트 사용 방법

#### 전체 배포 (백엔드 + 프론트엔드)
```powershell
# PowerShell 관리자 권한으로 실행
cd C:\Apps\C1B
.\deploy.ps1
```

#### 백엔드만 배포
```powershell
.\deploy.ps1 -FrontendOnly
```

#### 프론트엔드만 배포
```powershell
.\deploy.ps1 -BackendOnly
```

#### 백업 실행
```powershell
.\backup.ps1
```

#### 롤백 실행
```powershell
# 백업 목록 확인
ls C:\Backups\C1B\

# 롤백 (타임스탬프 지정)
.\rollback.ps1 -BackupTimestamp "20260318_143000"
```

---

## 8. 모니터링 및 관리

### 8.1 PM2 모니터링

#### 기본 명령어

```powershell
# 전체 상태 확인
pm2 status
```

**출력 예시**:
```
┌─────┬──────────┬─────────────┬─────────┬─────────┬──────────┬────────┬──────┬───────────┬──────────┬──────────┐
│ id  │ name     │ namespace   │ version │ mode    │ pid      │ uptime │ ↺    │ status    │ cpu      │ mem      │
├─────┼──────────┼─────────────┼─────────┼─────────┼──────────┼────────┼──────┼───────────┼──────────┼──────────┤
│ 0   │ c1b-api  │ default     │ 1.0.0   │ fork    │ 12345    │ 2h     │ 0    │ online    │ 0.5%     │ 85.2mb   │
└─────┴──────────┴─────────────┴─────────┴─────────┴──────────┴────────┴──────┴───────────┴──────────┴──────────┘
```

**상태 설명**:
- **online**: 정상 실행 중 ✅
- **stopping**: 중지 중
- **stopped**: 중지됨
- **errored**: 오류 발생 ❌

#### 실시간 로그 확인

```powershell
# 실시간 로그 (Ctrl+C로 종료)
pm2 logs c1b-api

# 최근 50줄
pm2 logs c1b-api --lines 50

# 에러 로그만
pm2 logs c1b-api --err
```

#### 실시간 모니터링 대시보드

```powershell
pm2 monit
```

**화면 설명**:
- 좌측: 프로세스 목록
- 우측 상단: CPU/메모리 사용량 그래프
- 우측 하단: 실시간 로그

**종료**: `Ctrl + C`

---

### 8.2 IIS 모니터링

#### IIS 관리자에서 확인

1. **IIS 관리자 실행** (`inetmgr`)
2. "C1B-Storeboard" 사이트 선택
3. 우측 "Actions" 패널에서:
   - **Browse *:80 (http)**: 사이트 접속
   - **Restart**: 사이트 재시작
   - **Stop**: 사이트 중지

#### PowerShell로 상태 확인

```powershell
# 사이트 상태
Get-WebSite -Name "C1B-Storeboard"

# 출력:
# Name            ID   State      Physical Path                          Bindings
# ----            --   -----      -------------                          --------
# C1B-Storeboard  2    Started    C:\inetpub\wwwroot\storeboard         http *:80:
```

#### IIS 로그 확인

```powershell
# 최근 로그 50줄
Get-Content "C:\inetpub\logs\LogFiles\W3SVC*\*.log" -Tail 50

# 에러만 필터링 (500, 404, 403)
Get-Content "C:\inetpub\logs\LogFiles\W3SVC*\*.log" | Select-String "500|404|403" | Select-Object -Last 20
```

---

### 8.3 데이터베이스 연결 확인

```powershell
# SQL Server 연결 테스트
Test-NetConnection -ComputerName your_db_server_ip -Port 1433

# 출력:
# ComputerName     : 192.168.1.100
# RemoteAddress    : 192.168.1.100
# RemotePort       : 1433
# TcpTestSucceeded : True
```

**✅ TcpTestSucceeded: True** → 연결 가능  
**❌ TcpTestSucceeded: False** → 방화벽 또는 SQL Server 설정 확인

---

## 9. 문제 해결

### 9.1 백엔드가 시작되지 않음

#### 증상
```powershell
pm2 status
# status: errored 또는 stopped
```

#### 해결 방법

**1단계: 로그 확인**
```powershell
pm2 logs c1b-api --lines 50
```

**2단계: 일반적인 오류와 해결**

| 오류 메시지 | 원인 | 해결 방법 |
|------------|------|----------|
| `❌ 데이터베이스 연결 실패` | DB 정보 오류 | `.env` 파일의 DB 정보 확인 |
| `Error: listen EADDRINUSE` | 포트 3001 사용 중 | 포트 사용 프로세스 종료 |
| `Cannot find module` | 의존성 미설치 | `npm install --production` 재실행 |
| `ENOENT: no such file` | 파일 경로 오류 | 파일 복사 재확인 |

**3단계: 백엔드 재시작**
```powershell
pm2 delete c1b-api
cd C:\inetpub\api
pm2 start server.js --name "c1b-api"
pm2 save
```

---

### 9.2 프론트엔드가 표시되지 않음

#### 증상
- 브라우저에서 `http://localhost` 접속 시 오류

#### 해결 방법

**1단계: IIS 사이트 상태 확인**
```powershell
Get-WebSite -Name "C1B-Storeboard"

# State가 "Stopped"이면
Start-WebSite -Name "C1B-Storeboard"
```

**2단계: 앱 풀 상태 확인**
```powershell
Get-WebAppPoolState -Name "C1B-Storeboard"

# Stopped이면
Start-WebAppPool -Name "C1B-Storeboard"
```

**3단계: 파일 존재 확인**
```powershell
ls C:\inetpub\wwwroot\storeboard

# index.html이 있는지 확인
Test-Path C:\inetpub\wwwroot\storeboard\index.html
# 출력: True
```

**4단계: 포트 충돌 확인**
```powershell
# 포트 80 사용 확인
netstat -ano | findstr :80

# 다른 프로세스가 사용 중이면
# 기본 웹사이트 중지
Stop-WebSite -Name "Default Web Site"
```

---

### 9.3 API 호출이 실패함 (프록시 오류)

#### 증상
- 로그인 후 데이터가 로드되지 않음
- 브라우저 F12 → Network 탭에서 API 호출 실패 (404 또는 500)

#### 해결 방법

**1단계: ARR 프록시 활성화 확인**
```powershell
Get-WebConfigurationProperty -pspath 'MACHINE/WEBROOT/APPHOST' -filter "system.webServer/proxy" -name "enabled"

# Value가 False이면
Set-WebConfigurationProperty -pspath 'MACHINE/WEBROOT/APPHOST' -filter "system.webServer/proxy" -name "enabled" -value "True"
```

**2단계: web.config 확인**
```powershell
Get-Content C:\inetpub\wwwroot\storeboard\web.config
```

- `<rule name="API Proxy">` 규칙이 있는지 확인
- `url="http://localhost:3001/api/{R:1}"` 경로가 맞는지 확인

**3단계: 백엔드 실행 확인**
```powershell
pm2 status
# c1b-api가 online인지 확인

# 브라우저에서 직접 백엔드 접속
http://localhost:3001
```

**4단계: IIS 재시작**
```powershell
iisreset /restart
```

---

### 9.4 업로드한 이미지가 표시되지 않음

#### 증상
- 상세페이지관리에서 이미지 업로드는 성공
- 이미지가 화면에 표시되지 않음

#### 해결 방법

**1단계: 업로드 폴더 확인**
```powershell
ls C:\inetpub\api\uploads

# 업로드된 이미지 파일이 있는지 확인
```

**2단계: 백엔드에서 정적 파일 서빙 확인**

`C:\inetpub\api\server.js` 파일 확인:
```javascript
// 정적 파일 서빙 설정이 있는지 확인
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
```

**3단계: 이미지 URL 확인**

브라우저 F12 → Network 탭:
- 이미지 URL: `http://localhost:3001/uploads/xxx.jpg`
- Status: 200 OK인지 확인

**4단계: 폴더 권한 확인**
```powershell
icacls "C:\inetpub\api\uploads"

# Everyone 또는 IIS AppPool 계정에 읽기 권한 부여
icacls "C:\inetpub\api\uploads" /grant "Everyone:(OI)(CI)R"
```

---

### 9.5 서버 재부팅 후 서비스가 시작되지 않음

#### 증상
- 서버 재부팅 후 웹사이트 접속 불가

#### 해결 방법

**1단계: PM2 상태 확인**
```powershell
pm2 status

# 프로세스가 없으면
pm2 resurrect
```

**2단계: PM2 서비스 확인**
```powershell
Get-Service | Where-Object {$_.Name -like "*pm2*"}

# 서비스가 없거나 중지되어 있으면
pm2-startup install
pm2 save
```

**3단계: IIS 상태 확인**
```powershell
Get-WebSite -Name "C1B-Storeboard"

# State가 Stopped이면
Start-WebSite -Name "C1B-Storeboard"
```

**4단계: 자동 시작 설정**
```powershell
# IIS 사이트 자동 시작 설정
Set-ItemProperty "IIS:\Sites\C1B-Storeboard" -Name serverAutoStart -Value $true
```

---

### 9.6 포트 충돌 오류

#### 증상
```
Error: listen EADDRINUSE: address already in use :::3001
```

#### 해결 방법

**1단계: 포트 사용 프로세스 확인**
```powershell
netstat -ano | findstr :3001

# 출력 예:
# TCP    0.0.0.0:3001           0.0.0.0:0              LISTENING       12345
```

**2단계: 프로세스 종료**
```powershell
# PID 12345 종료
taskkill /PID 12345 /F

# 출력:
# 성공: PID 12345 프로세스를 종료했습니다.
```

**3단계: PM2 재시작**
```powershell
pm2 restart c1b-api
```

---

## 10. 단계별 전체 배포 가이드 (처음부터 끝까지)

### 📝 체크리스트 형식 가이드

#### ✅ Phase 1: 소프트웨어 설치 (30분)

```
[ ] 1. Node.js 설치
    - https://nodejs.org/ 에서 LTS 버전 다운로드
    - 설치 후 확인: node --version

[ ] 2. IIS 설치
    - PowerShell 관리자: Install-WindowsFeature -name Web-Server -IncludeManagementTools
    - 확인: inetmgr 실행

[ ] 3. URL Rewrite Module 설치
    - https://www.iis.net/downloads/microsoft/url-rewrite
    - rewrite_amd64_en-US.msi 설치
    - 확인: IIS 관리자에서 URL Rewrite 아이콘 확인

[ ] 4. Application Request Routing 설치
    - https://www.iis.net/downloads/microsoft/application-request-routing
    - requestRouter_amd64.msi 설치
    - 확인: IIS 관리자에서 ARR Cache 아이콘 확인

[ ] 5. PM2 설치
    - npm install -g pm2
    - npm install -g pm2-windows-startup
    - pm2-startup install
    - 확인: pm2 --version
```

#### ✅ Phase 2: 백엔드 배포 (15분)

```
[ ] 1. 폴더 생성
    - mkdir C:\inetpub\api
    - mkdir C:\inetpub\api\uploads

[ ] 2. 파일 복사
    - backend 폴더 → C:\inetpub\api\backend
    - server.js → C:\inetpub\api\
    - package.json → C:\inetpub\api\
    - package-lock.json → C:\inetpub\api\

[ ] 3. .env 파일 생성
    - C:\inetpub\api\.env 생성
    - DB 정보 입력 (DB_SERVER, DB_USER, DB_PASSWORD 등)

[ ] 4. 의존성 설치
    - cd C:\inetpub\api
    - npm install --production

[ ] 5. PM2로 실행
    - pm2 start server.js --name "c1b-api"
    - pm2 save

[ ] 6. 방화벽 설정
    - New-NetFirewallRule -DisplayName "C1B Backend API" -Direction Inbound -LocalPort 3001 -Protocol TCP -Action Allow

[ ] 7. 테스트
    - 브라우저: http://localhost:3001
    - pm2 logs c1b-api 확인
```

#### ✅ Phase 3: 프론트엔드 배포 (20분)

```
[ ] 1. .env.production 생성
    - C:\Cursor_Projects\C1BWebClient\web-client\.env.production
    - 내용: VITE_API_URL=/api

[ ] 2. API URL 코드 수정 (14개 파일)
    - Dashboard.tsx
    - OrderPage.tsx
    - ChartSection.tsx
    - OrderStatusCards.tsx
    - ProductPage.tsx
    - UserManagementPage.tsx
    - NoticeManagementPage.tsx
    - NoticeList.tsx
    - NoticePage.tsx
    - AccountPage.tsx
    - BasicInfoPage.tsx
    - MarketPage.tsx
    - DetailPageManagement.tsx
    - LoginPage.tsx
    
    수정 내용:
    const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'
    const API_URL = `${API_BASE}/api/...`

[ ] 3. 빌드
    - cd C:\Cursor_Projects\C1BWebClient\web-client
    - npm install
    - npm run build

[ ] 4. 파일 복사
    - mkdir C:\inetpub\wwwroot\storeboard
    - dist\* → C:\inetpub\wwwroot\storeboard

[ ] 5. web.config 생성
    - C:\inetpub\wwwroot\storeboard\web.config
    - API 프록시 규칙 + React Router 규칙 포함

[ ] 6. IIS 사이트 생성
    - inetmgr 실행
    - Default Web Site 중지
    - Add Website: C1B-Storeboard
    - Physical path: C:\inetpub\wwwroot\storeboard
    - Port: 80

[ ] 7. 앱 풀 설정
    - Application Pools → C1B-Storeboard
    - .NET CLR Version: No Managed Code
    - Start Mode: AlwaysRunning

[ ] 8. 방화벽 설정
    - New-NetFirewallRule -DisplayName "C1B Frontend HTTP" -Direction Inbound -LocalPort 80 -Protocol TCP -Action Allow

[ ] 9. 테스트
    - 브라우저: http://localhost
    - 로그인 페이지 확인
```

#### ✅ Phase 4: 프록시 설정 (5분)

```
[ ] 1. ARR 프록시 활성화
    - IIS 관리자 → 서버 노드
    - Application Request Routing Cache
    - Server Proxy Settings
    - Enable proxy 체크

[ ] 2. IIS 재시작
    - iisreset /restart

[ ] 3. 프록시 테스트
    - 브라우저: http://localhost/api/orders/stores/user1
    - JSON 데이터 표시 확인
```

#### ✅ Phase 5: 최종 테스트 (10분)

```
[ ] 1. 로그인 테스트
    - http://localhost 접속
    - 계정으로 로그인
    - 대시보드 이동 확인

[ ] 2. 대시보드 데이터 확인
    - 주문현황 카드 데이터 표시
    - 마켓별 주문 차트 표시
    - 스토어별 주문 차트 표시
    - 주문추이 차트 표시
    - 매출추이 차트 표시
    - 공지사항 목록 표시

[ ] 3. 주문관리 페이지 테스트
    - 좌측 메뉴 → 주문관리
    - 주문 목록 표시 확인
    - 필터 기능 테스트

[ ] 4. 상품관리 페이지 테스트
    - 좌측 메뉴 → 상품관리
    - 상품 목록 표시 확인
    - 검색 기능 테스트

[ ] 5. 파일 업로드 테스트
    - 관리자메뉴 → 상세페이지관리
    - 이미지 업로드 테스트
    - 업로드된 이미지 표시 확인

[ ] 6. 외부 접속 테스트 (다른 PC에서)
    - http://서버IP 접속
    - 로그인 및 기능 테스트
```

---

## 11. 일상 운영 가이드

### 11.1 매일 확인할 사항

#### 아침 체크리스트
```powershell
# 1. PM2 상태 확인
pm2 status

# 2. IIS 상태 확인
Get-WebSite -Name "C1B-Storeboard"

# 3. 디스크 공간 확인
Get-PSDrive C | Select-Object Used, Free

# 4. 최근 에러 로그 확인
pm2 logs c1b-api --err --lines 10
```

---

### 11.2 주간 작업

#### 매주 월요일
```powershell
# 1. 백업 실행
cd C:\Apps\C1B
.\backup.ps1

# 2. 로그 정리 (30일 이상 삭제)
Get-ChildItem "C:\inetpub\logs\LogFiles\W3SVC*" -Recurse | Where-Object { $_.CreationTime -lt (Get-Date).AddDays(-30) } | Remove-Item -Force

# 3. PM2 로그 정리
pm2 flush
```

---

### 11.3 코드 업데이트 시

```powershell
# 1. 백업
cd C:\Apps\C1B
.\backup.ps1

# 2. 배포
.\deploy.ps1

# 3. 테스트
# 브라우저에서 기능 테스트

# 4. 문제 발생 시 롤백
# .\rollback.ps1 -BackupTimestamp "20260318_143000"
```

---

## 12. 자주 사용하는 명령어

### PM2 명령어 (백엔드 관리)

```powershell
# 상태 확인
pm2 status

# 로그 확인 (실시간)
pm2 logs c1b-api

# 로그 확인 (최근 50줄)
pm2 logs c1b-api --lines 50

# 재시작
pm2 restart c1b-api

# 중지
pm2 stop c1b-api

# 시작
pm2 start c1b-api

# 삭제
pm2 delete c1b-api

# 모니터링
pm2 monit

# 현재 상태 저장
pm2 save
```

### IIS 명령어 (프론트엔드 관리)

```powershell
# IIS 재시작
iisreset /restart

# IIS 중지
iisreset /stop

# IIS 시작
iisreset /start

# 사이트 시작
Start-WebSite -Name "C1B-Storeboard"

# 사이트 중지
Stop-WebSite -Name "C1B-Storeboard"

# 사이트 재시작
Stop-WebSite -Name "C1B-Storeboard"
Start-WebSite -Name "C1B-Storeboard"

# 사이트 상태 확인
Get-WebSite -Name "C1B-Storeboard"

# 앱 풀 재시작
Restart-WebAppPool -Name "C1B-Storeboard"
```

### 시스템 명령어

```powershell
# 포트 사용 확인
netstat -ano | findstr :3001
netstat -ano | findstr :80

# 프로세스 종료
taskkill /PID <PID> /F

# 방화벽 규칙 확인
Get-NetFirewallRule | Where-Object {$_.DisplayName -like "*C1B*"}

# 디스크 공간 확인
Get-PSDrive C

# 서비스 확인
Get-Service | Where-Object {$_.Name -like "*pm2*"}
```

---

## 13. 성능 최적화

### 13.1 백엔드 클러스터 모드

**ecosystem.config.js 생성**

`C:\inetpub\api\ecosystem.config.js` 파일 생성:

```javascript
module.exports = {
  apps: [{
    name: 'c1b-api',
    script: './server.js',
    instances: 4, // CPU 코어 수 (또는 'max')
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    },
    max_memory_restart: '1G',
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    merge_logs: true,
    autorestart: true,
    watch: false,
    max_restarts: 10,
    min_uptime: '10s'
  }]
};
```

**클러스터 모드로 실행**:
```powershell
cd C:\inetpub\api

# 기존 프로세스 삭제
pm2 delete c1b-api

# 클러스터 모드로 시작
pm2 start ecosystem.config.js

# 저장
pm2 save

# 확인
pm2 status
```

**결과**:
```
┌─────┬──────────┬─────────┬─────────┬─────────┬──────────┐
│ id  │ name     │ mode    │ ↺      │ status  │ cpu      │
├─────┼──────────┼─────────┼─────────┼─────────┼──────────┤
│ 0   │ c1b-api  │ cluster │ 0       │ online  │ 0%       │
│ 1   │ c1b-api  │ cluster │ 0       │ online  │ 0%       │
│ 2   │ c1b-api  │ cluster │ 0       │ online  │ 0%       │
│ 3   │ c1b-api  │ cluster │ 0       │ online  │ 0%       │
└─────┴──────────┴─────────┴─────────┴─────────┴──────────┘
```

---

### 13.2 IIS 압축 설정

```powershell
# 정적 압축 활성화
Set-WebConfigurationProperty -pspath 'MACHINE/WEBROOT/APPHOST' -filter "system.webServer/httpCompression" -name "staticCompressionEnableCpuUsage" -value 90

# 동적 압축 활성화
Set-WebConfigurationProperty -pspath 'MACHINE/WEBROOT/APPHOST' -filter "system.webServer/httpCompression" -name "dynamicCompressionEnableCpuUsage" -value 90
```

---

### 13.3 IIS 캐시 최적화

`web.config`에 캐시 설정 추가:

```xml
<staticContent>
  <!-- 정적 파일 캐시: 7일 -->
  <clientCache cacheControlMode="UseMaxAge" cacheControlMaxAge="7.00:00:00" />
</staticContent>
```

---

## 14. 자동 백업 설정

### 14.1 작업 스케줄러 등록

```powershell
# PowerShell 관리자 권한으로 실행

# 작업 정의
$action = New-ScheduledTaskAction -Execute "PowerShell.exe" -Argument "-ExecutionPolicy Bypass -File C:\Apps\C1B\backup.ps1"

# 트리거: 매일 새벽 2시
$trigger = New-ScheduledTaskTrigger -Daily -At 2:00AM

# 실행 계정: SYSTEM
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest

# 설정
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -RunOnlyIfNetworkAvailable

# 작업 등록
Register-ScheduledTask -TaskName "C1B-Daily-Backup" -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description "C1B 스토어보드 일일 자동 백업"

# 확인
Get-ScheduledTask -TaskName "C1B-Daily-Backup"
```

### 14.2 백업 수동 실행 테스트

```powershell
# 작업 스케줄러에서 수동 실행
Start-ScheduledTask -TaskName "C1B-Daily-Backup"

# 백업 결과 확인
ls C:\Backups\C1B\
```

---

## 15. 보안 강화

### 15.1 IIS 보안 헤더 추가

`web.config`에 보안 헤더 추가:

```xml
<system.webServer>
  <httpProtocol>
    <customHeaders>
      <!-- XSS 공격 방지 -->
      <add name="X-Content-Type-Options" value="nosniff" />
      <add name="X-Frame-Options" value="SAMEORIGIN" />
      <add name="X-XSS-Protection" value="1; mode=block" />
      
      <!-- Referrer 정책 -->
      <add name="Referrer-Policy" value="strict-origin-when-cross-origin" />
      
      <!-- 서버 정보 숨김 -->
      <remove name="X-Powered-By" />
    </customHeaders>
  </httpProtocol>
</system.webServer>
```

---

### 15.2 요청 크기 제한

`web.config`에 추가:

```xml
<system.webServer>
  <security>
    <requestFiltering>
      <!-- 최대 요청 크기: 50MB (이미지 업로드용) -->
      <requestLimits maxAllowedContentLength="52428800" />
    </requestFiltering>
  </security>
</system.webServer>
```

---

## 16. 접속 정보 및 계정

### 16.1 개발 환경

- **프론트엔드**: http://localhost:5173
- **백엔드**: http://localhost:3001

### 16.2 프로덕션 환경

- **프론트엔드**: 
  - 로컬: http://localhost
  - 외부: http://서버IP
  - 도메인: http://your-domain.com

- **백엔드 (직접 접속)**:
  - http://서버IP:3001

- **백엔드 (프록시 경유)**:
  - http://서버IP/api/...

### 16.3 기본 계정

데이터베이스 `tb_user` 테이블에서 확인:
- `user_id`: 사용자 ID
- `user_pwd`: 비밀번호
- `user_type`: '관리자' 또는 일반 사용자

---

## 17. 디렉토리 구조 (배포 후)

```
C:\inetpub\
├── api\                                    # 백엔드
│   ├── backend\
│   │   ├── config\
│   │   │   └── database.js                # DB 연결
│   │   └── routes\
│   │       ├── orderManagement.js         # 주문 API
│   │       ├── productManagement.js       # 상품 API
│   │       ├── userManagement.js          # 사용자 API
│   │       ├── noticeManagement.js        # 공지 API
│   │       ├── basicInfo.js               # 기준정보 API
│   │       ├── marketConnection.js        # 마켓연동 API
│   │       └── detailPageManagement.js    # 상세페이지 API
│   ├── uploads\                            # 업로드 파일
│   ├── node_modules\                       # 의존성
│   ├── server.js                           # 진입점
│   ├── package.json
│   └── .env                                # 환경 변수 ⚠️
│
└── wwwroot\
    └── storeboard\                         # 프론트엔드
        ├── assets\
        │   ├── index-abc123.js            # 번들된 JS
        │   └── index-def456.css           # 번들된 CSS
        ├── index.html                      # 메인 HTML
        └── web.config                      # IIS 설정 ⚠️

C:\Apps\C1B\                                # 관리 스크립트
├── deploy.ps1                              # 배포 스크립트
├── backup.ps1                              # 백업 스크립트
└── rollback.ps1                            # 롤백 스크립트

C:\Backups\C1B\                             # 백업 파일
├── backup_20260318_020000.zip
├── backup_20260319_020000.zip
└── frontend_20260318_143000\              # 임시 백업
```

**⚠️ 중요 파일**:
- `.env`: 데이터베이스 비밀번호 등 민감 정보 포함
- `web.config`: IIS 설정 (프록시, 라우팅)

---

## 18. 데이터베이스 테이블 구조

### 주요 테이블

| 테이블명 | 설명 | 주요 컬럼 |
|---------|------|----------|
| `tb_user` | 사용자 정보 | user_id, user_pwd, user_name, user_type, end_date |
| `tb_order_info` | 주문 정보 | order_id, market_type, order_status, pay_amt, pay_date |
| `tb_good_user` | 사용자 상품 | seller_cd, good_name_ss, display_id_ss, display_id_cp |
| `tb_good_master` | 상품 마스터 | seq, t_url, t_img_url, mp_delv_Price |
| `tb_user_market_ss` | 스마트스토어 연동 | user_id, biz_idx, store_name, account_id, client_id |
| `tb_user_market_cp` | 쿠팡 연동 | user_id, biz_idx, store_name, accountId, vendorId |
| `tb_notice` | 공지사항 | seq, title, contents, fix_yn, use_yn |
| `tb_setting_info` | 기준정보 | seq, hal_rate, ss_fee, cp_fee |
| `tb_detail_page` | 상세페이지 이미지 | seq, img_type, img_url |

---

## 19. FAQ (자주 묻는 질문)

### Q1. 배포 후 로그인이 안 됩니다.
**A**: 
1. 백엔드 로그 확인: `pm2 logs c1b-api`
2. 데이터베이스 연결 확인: `.env` 파일의 DB 정보
3. 브라우저 F12 → Network 탭에서 API 호출 확인

### Q2. 대시보드에 데이터가 안 나옵니다.
**A**: 
1. 브라우저 F12 → Console 탭에서 에러 확인
2. API 프록시 확인: `http://localhost/api/orders/stores/user1` 직접 접속
3. ARR 프록시 활성화 확인

### Q3. 이미지 업로드가 안 됩니다.
**A**: 
1. 업로드 폴더 존재 확인: `C:\inetpub\api\uploads`
2. 폴더 권한 확인: `icacls C:\inetpub\api\uploads`
3. 백엔드 로그 확인: `pm2 logs c1b-api`

### Q4. 서버 재부팅 후 사이트가 안 열립니다.
**A**: 
1. PM2 상태 확인: `pm2 status` (없으면 `pm2 resurrect`)
2. IIS 상태 확인: `Get-WebSite -Name "C1B-Storeboard"`
3. PM2 서비스 확인: `Get-Service | Where-Object {$_.Name -like "*pm2*"}`

### Q5. 배포 스크립트 실행 시 권한 오류가 납니다.
**A**: 
```powershell
# PowerShell 실행 정책 변경
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# 또는 한 번만 우회
PowerShell -ExecutionPolicy Bypass -File C:\Apps\C1B\deploy.ps1
```

### Q6. 포트 80을 다른 포트로 변경하고 싶습니다.
**A**: 
```powershell
# IIS 바인딩 변경 (예: 8080)
Set-WebBinding -Name "C1B-Storeboard" -BindingInformation "*:80:" -PropertyName Port -Value 8080

# 방화벽 규칙 추가
New-NetFirewallRule -DisplayName "C1B Frontend 8080" -Direction Inbound -LocalPort 8080 -Protocol TCP -Action Allow
```

### Q7. 외부에서 접속이 안 됩니다.
**A**: 
1. 방화벽 규칙 확인: `Get-NetFirewallRule | Where-Object {$_.DisplayName -like "*C1B*"}`
2. Windows 방화벽 상태 확인
3. 라우터/방화벽 포트 포워딩 설정 (외부망 접속 시)

### Q8. 데이터베이스 연결이 안 됩니다.
**A**: 
1. SQL Server 실행 확인
2. SQL Server 인증 모드: "SQL Server 및 Windows 인증 모드"
3. SQL Server 방화벽: 포트 1433 허용
4. `.env` 파일의 DB 정보 재확인

---

## 20. 긴급 상황 대응

### 🚨 서비스 다운 시

```powershell
# 1단계: 백엔드 확인
pm2 status
pm2 logs c1b-api --err --lines 20

# 2단계: 백엔드 재시작
pm2 restart c1b-api

# 3단계: IIS 확인
Get-WebSite -Name "C1B-Storeboard"

# 4단계: IIS 재시작
iisreset /restart

# 5단계: 데이터베이스 확인
Test-NetConnection -ComputerName your_db_server -Port 1433

# 6단계: 전체 재시작
pm2 restart all
iisreset /restart
```

### 🔄 긴급 롤백

```powershell
# 1. 최근 백업 확인
ls C:\Backups\C1B\ | Sort-Object CreationTime -Descending | Select-Object -First 5

# 2. 롤백 실행
cd C:\Apps\C1B
.\rollback.ps1 -BackupTimestamp "최근_타임스탬프"

# 3. 서비스 확인
pm2 status
Get-WebSite -Name "C1B-Storeboard"
```

---

## 21. 연락처 및 지원

### 로그 위치

| 로그 종류 | 위치 | 확인 방법 |
|----------|------|----------|
| PM2 로그 | `C:\Users\<username>\.pm2\logs\` | `pm2 logs c1b-api` |
| IIS 로그 | `C:\inetpub\logs\LogFiles\` | `Get-Content ... -Tail 50` |
| Windows 이벤트 | 이벤트 뷰어 | `eventvwr.msc` |

### 문제 발생 시 체크리스트

```
[ ] PM2 상태 확인: pm2 status
[ ] PM2 로그 확인: pm2 logs c1b-api
[ ] IIS 상태 확인: Get-WebSite -Name "C1B-Storeboard"
[ ] IIS 로그 확인: Get-Content C:\inetpub\logs\LogFiles\W3SVC*\*.log -Tail 50
[ ] 방화벽 확인: Get-NetFirewallRule | Where-Object {$_.DisplayName -like "*C1B*"}
[ ] 포트 확인: netstat -ano | findstr :3001
[ ] DB 연결 확인: Test-NetConnection -ComputerName DB서버 -Port 1433
```

---

## 22. 참고 자료

### 공식 문서
- **Node.js**: https://nodejs.org/
- **PM2**: https://pm2.keymetrics.io/
- **IIS**: https://www.iis.net/
- **React (Vite)**: https://vitejs.dev/
- **Express**: https://expressjs.com/

### 다운로드 링크
- **Node.js**: https://nodejs.org/en/download/
- **URL Rewrite**: https://www.iis.net/downloads/microsoft/url-rewrite
- **ARR**: https://www.iis.net/downloads/microsoft/application-request-routing
- **Win-ACME**: https://www.win-acme.com/

### 유용한 도구
- **PM2 Plus**: https://app.pm2.io/ (무료 모니터링)
- **Postman**: https://www.postman.com/ (API 테스트)
- **SQL Server Management Studio**: https://aka.ms/ssmsfullsetup

---

## 23. 버전 정보

- **프로젝트 버전**: 1.0.0
- **Node.js 권장 버전**: 20.x LTS
- **문서 버전**: 1.0
- **마지막 업데이트**: 2026-03-18

---

## 24. 라이선스 및 저작권

© 2026 C1B (Click One Button). All rights reserved.

---

**📞 기술 지원**:
- 배포 중 문제 발생 시 위 "문제 해결" 섹션 참고
- 로그 파일 확인 후 오류 메시지 검색
- PM2 및 IIS 공식 문서 참고
