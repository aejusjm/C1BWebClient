# 관리자 대시보드

관리자용 대시보드 웹 애플리케이션입니다. 주문 현황, 통계, 차트를 한눈에 확인할 수 있습니다.

## 기술 스택

- **React 19** - UI 라이브러리
- **TypeScript** - 타입 안정성
- **Vite** - 빌드 도구
- **Chart.js** - 차트 라이브러리

## 프로젝트 구조

```
web-client/
├── src/
│   ├── components/          # 컴포넌트 폴더
│   │   ├── Sidebar.tsx      # 좌측 사이드바
│   │   ├── Dashboard.tsx    # 대시보드 메인
│   │   ├── OrderStatusCards.tsx  # 주문현황 카드
│   │   ├── ChartSection.tsx      # 차트 섹션
│   │   ├── DonutChart.tsx        # 도넛 차트
│   │   ├── BarChart.tsx          # 막대 차트
│   │   ├── NoticeList.tsx        # 공지사항 목록
│   │   └── ProductStats.tsx      # 상품통계
│   ├── App.tsx              # 메인 앱 컴포넌트
│   ├── App.css              # 앱 스타일
│   ├── index.css            # 전역 스타일
│   └── main.tsx             # 진입점
├── index.html               # HTML 템플릿
├── package.json             # 의존성 관리
├── tsconfig.json            # TypeScript 설정
└── vite.config.ts           # Vite 설정
```

## 주요 기능

### 1. 사이드바
- 로고 영역
- 사용자 정보 (이름, 만료일)
- 메뉴 네비게이션 (상품관리, 주문관리, 설정)

### 2. 대시보드
- **날짜 필터**: 오늘, 최근3일, 최근7일, 최근30일
- **주문현황 카드**: 결제완료, 배송준비중, 배송중, 배송완료
- **도넛 차트**: 마켓별 주문, 스토어별 주문
- **막대 차트**: 주문추이, 매출추이 (월별)
- **공지사항**: 최근 공지사항 목록
- **등록상품 수**: 스마트스토어, 쿠팡 통계

## 설치 및 실행

### 1. 의존성 설치
```bash
npm install
```

### 2. 개발 서버 실행
```bash
npm run dev
```

브라우저에서 `http://localhost:5173` 접속

### 3. 빌드
```bash
npm run build
```

빌드된 파일은 `dist` 폴더에 생성됩니다.

### 4. 빌드 미리보기
```bash
npm run preview
```

## IIS 배포

1. 프로젝트 빌드
```bash
npm run build
```

2. `dist` 폴더의 내용을 IIS 웹사이트 폴더로 복사

3. IIS에서 새 웹사이트 생성 또는 기존 사이트에 애플리케이션 추가

4. web.config 파일 추가 (SPA 라우팅 지원)
```xml
<?xml version="1.0" encoding="UTF-8"?>
<configuration>
  <system.webServer>
    <rewrite>
      <rules>
        <rule name="React Routes" stopProcessing="true">
          <match url=".*" />
          <conditions logicalGrouping="MatchAll">
            <add input="{REQUEST_FILENAME}" matchType="IsFile" negate="true" />
            <add input="{REQUEST_FILENAME}" matchType="IsDirectory" negate="true" />
          </conditions>
          <action type="Rewrite" url="/" />
        </rule>
      </rules>
    </rewrite>
  </system.webServer>
</configuration>
```

## 환경 설정

환경 변수는 `.env` 파일로 관리할 수 있습니다.

```env
# API 엔드포인트
VITE_API_URL=http://localhost:5000/api

# 기타 설정
VITE_APP_TITLE=관리자 대시보드
```

## 커스터마이징

### 색상 변경
`src/index.css` 파일에서 전역 색상을 변경할 수 있습니다.

### 차트 데이터
`src/components/ChartSection.tsx` 파일에서 차트 데이터를 수정할 수 있습니다.

### 메뉴 추가
`src/components/Sidebar.tsx` 파일에서 메뉴를 추가/수정할 수 있습니다.

## 라이선스

MIT License
