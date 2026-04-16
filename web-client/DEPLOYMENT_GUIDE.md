# IIS 배포 가이드

Windows Server 2022 + IIS 환경에서 React 애플리케이션을 배포하는 방법을 설명합니다.

## 사전 요구사항

### 1. IIS 설치 확인
- Windows Server 2022에 IIS가 설치되어 있어야 합니다.
- URL Rewrite 모듈이 설치되어 있어야 합니다.

### 2. URL Rewrite 모듈 설치
1. [URL Rewrite 모듈 다운로드](https://www.iis.net/downloads/microsoft/url-rewrite)
2. 설치 파일 실행
3. IIS 재시작

## 배포 단계

### 1단계: 프로젝트 빌드

```bash
# 프로젝트 디렉토리로 이동
cd web-client

# 의존성 설치 (처음 한 번만)
npm install

# 프로덕션 빌드
npm run build
```

빌드가 완료되면 `dist` 폴더가 생성됩니다.

### 2단계: IIS 웹사이트 생성

#### 방법 1: IIS 관리자 GUI 사용

1. **IIS 관리자 실행**
   - 시작 메뉴 → "IIS 관리자" 검색 → 실행

2. **새 웹사이트 생성**
   - 좌측 트리에서 "사이트" 우클릭
   - "웹 사이트 추가" 선택

3. **웹사이트 설정**
   - 사이트 이름: `AdminDashboard`
   - 실제 경로: `C:\inetpub\wwwroot\web-client`
   - 바인딩:
     - 유형: http
     - IP 주소: 모든 할당되지 않음
     - 포트: 8080 (또는 원하는 포트)
     - 호스트 이름: (선택사항)

4. **확인** 클릭

#### 방법 2: PowerShell 사용

```powershell
# 관리자 권한으로 PowerShell 실행

# 웹사이트 디렉토리 생성
New-Item -ItemType Directory -Path "C:\inetpub\wwwroot\web-client"

# IIS 웹사이트 생성
New-IISSite -Name "AdminDashboard" -PhysicalPath "C:\inetpub\wwwroot\web-client" -BindingInformation "*:8080:"

# 애플리케이션 풀 설정 (선택사항)
Set-ItemProperty "IIS:\Sites\AdminDashboard" -Name applicationPool -Value "DefaultAppPool"
```

### 3단계: 빌드 파일 복사

```powershell
# dist 폴더의 모든 파일을 IIS 웹사이트 폴더로 복사
Copy-Item -Path ".\dist\*" -Destination "C:\inetpub\wwwroot\web-client" -Recurse -Force
```

또는 수동으로:
1. `dist` 폴더 열기
2. 모든 파일 선택 (Ctrl+A)
3. 복사 (Ctrl+C)
4. `C:\inetpub\wwwroot\web-client` 폴더로 이동
5. 붙여넣기 (Ctrl+V)

### 4단계: 웹사이트 시작

```powershell
# PowerShell에서 웹사이트 시작
Start-IISSite -Name "AdminDashboard"
```

또는 IIS 관리자에서:
1. "AdminDashboard" 사이트 선택
2. 우측 패널에서 "시작" 클릭

### 5단계: 방화벽 설정 (필요한 경우)

```powershell
# 포트 8080 방화벽 규칙 추가
New-NetFirewallRule -DisplayName "Admin Dashboard" -Direction Inbound -LocalPort 8080 -Protocol TCP -Action Allow
```

### 6단계: 접속 확인

브라우저에서 다음 주소로 접속:
- `http://localhost:8080`
- `http://서버IP:8080`

## 환경 변수 설정

프로덕션 환경에서는 `.env` 파일을 수정하여 API 엔드포인트를 설정합니다.

```env
# .env.production
VITE_API_URL=http://your-api-server.com/api
VITE_ENV=production
```

빌드 전에 환경 변수 파일을 수정하거나, 빌드 명령에 환경 변수를 전달합니다:

```bash
# Windows
set VITE_API_URL=http://your-api-server.com/api && npm run build

# PowerShell
$env:VITE_API_URL="http://your-api-server.com/api"; npm run build
```

## HTTPS 설정 (선택사항)

### 1. SSL 인증서 준비
- 공인 인증서 구매 또는
- Let's Encrypt 무료 인증서 사용 또는
- 자체 서명 인증서 생성 (개발용)

### 2. IIS에 인증서 바인딩

```powershell
# 인증서 가져오기 (pfx 파일)
$certPath = "C:\path\to\certificate.pfx"
$certPassword = ConvertTo-SecureString -String "password" -Force -AsPlainText
Import-PfxCertificate -FilePath $certPath -CertStoreLocation Cert:\LocalMachine\My -Password $certPassword

# HTTPS 바인딩 추가
New-IISSiteBinding -Name "AdminDashboard" -BindingInformation "*:443:" -Protocol https -CertificateThumbPrint "인증서Thumbprint"
```

## 문제 해결

### 1. 페이지 새로고침 시 404 오류

**원인**: URL Rewrite 모듈이 설치되지 않았거나 web.config가 없음

**해결**:
1. URL Rewrite 모듈 설치 확인
2. `web.config` 파일이 웹사이트 루트에 있는지 확인
3. IIS 재시작

### 2. 정적 파일 로딩 실패

**원인**: MIME 타입 설정 누락

**해결**:
IIS 관리자에서:
1. 사이트 선택
2. "MIME 형식" 더블클릭
3. 필요한 MIME 형식 추가:
   - `.js` → `application/javascript`
   - `.css` → `text/css`
   - `.json` → `application/json`

### 3. 권한 오류

**원인**: IIS 사용자 계정에 폴더 접근 권한 없음

**해결**:
```powershell
# IIS_IUSRS 그룹에 읽기 권한 부여
icacls "C:\inetpub\wwwroot\web-client" /grant "IIS_IUSRS:(OI)(CI)R" /T
```

### 4. API 연결 실패

**원인**: CORS 설정 또는 API URL 오류

**해결**:
1. `.env` 파일의 API URL 확인
2. API 서버의 CORS 설정 확인
3. 네트워크 방화벽 확인

## 업데이트 배포

새 버전을 배포할 때:

```bash
# 1. 새 버전 빌드
npm run build

# 2. IIS 사이트 중지
Stop-IISSite -Name "AdminDashboard"

# 3. 기존 파일 백업 (선택사항)
Copy-Item -Path "C:\inetpub\wwwroot\web-client" -Destination "C:\inetpub\wwwroot\web-client-backup-$(Get-Date -Format 'yyyyMMdd')" -Recurse

# 4. 새 파일 복사
Copy-Item -Path ".\dist\*" -Destination "C:\inetpub\wwwroot\web-client" -Recurse -Force

# 5. IIS 사이트 시작
Start-IISSite -Name "AdminDashboard"
```

## 성능 최적화

### 1. 압축 활성화

IIS 관리자에서:
1. 서버 수준 선택
2. "압축" 더블클릭
3. "정적 콘텐츠 압축 사용" 체크
4. "동적 콘텐츠 압축 사용" 체크

### 2. 캐싱 설정

```xml
<!-- web.config에 추가 -->
<system.webServer>
  <staticContent>
    <clientCache cacheControlMode="UseMaxAge" cacheControlMaxAge="7.00:00:00" />
  </staticContent>
</system.webServer>
```

### 3. 애플리케이션 풀 최적화

```powershell
# 애플리케이션 풀 설정
Set-ItemProperty "IIS:\AppPools\DefaultAppPool" -Name recycling.periodicRestart.time -Value "00:00:00"
Set-ItemProperty "IIS:\AppPools\DefaultAppPool" -Name processModel.idleTimeout -Value "00:20:00"
```

## 모니터링

### IIS 로그 위치
```
C:\inetpub\logs\LogFiles\W3SVC1\
```

### 로그 확인
```powershell
# 최근 로그 확인
Get-Content "C:\inetpub\logs\LogFiles\W3SVC1\*.log" -Tail 50
```

## 보안 권장사항

1. **HTTPS 사용**: 프로덕션 환경에서는 반드시 HTTPS 사용
2. **최소 권한 원칙**: IIS 사용자에게 필요한 최소 권한만 부여
3. **정기 업데이트**: Windows 및 IIS 보안 패치 정기 적용
4. **방화벽 설정**: 필요한 포트만 개방
5. **로그 모니터링**: 정기적으로 로그 확인

## 참고 자료

- [IIS 공식 문서](https://docs.microsoft.com/en-us/iis/)
- [URL Rewrite 모듈](https://www.iis.net/downloads/microsoft/url-rewrite)
- [Vite 배포 가이드](https://vitejs.dev/guide/static-deploy.html)
