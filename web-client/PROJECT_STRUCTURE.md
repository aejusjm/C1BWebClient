# 프로젝트 구조 상세 설명

## 디렉토리 구조

```
web-client/
│
├── public/                  # 정적 파일 (이미지, 폰트 등)
│
├── src/                     # 소스 코드
│   │
│   ├── components/          # React 컴포넌트
│   │   ├── Sidebar.tsx              # 좌측 사이드바 컴포넌트
│   │   ├── Sidebar.css              # 사이드바 스타일
│   │   ├── Dashboard.tsx            # 대시보드 메인 컴포넌트
│   │   ├── Dashboard.css            # 대시보드 스타일
│   │   ├── OrderStatusCards.tsx     # 주문현황 카드 컴포넌트
│   │   ├── OrderStatusCards.css     # 주문현황 카드 스타일
│   │   ├── ChartSection.tsx         # 차트 섹션 컴포넌트
│   │   ├── ChartSection.css         # 차트 섹션 스타일
│   │   ├── DonutChart.tsx           # 도넛 차트 컴포넌트
│   │   ├── DonutChart.css           # 도넛 차트 스타일
│   │   ├── BarChart.tsx             # 막대 차트 컴포넌트
│   │   ├── BarChart.css             # 막대 차트 스타일
│   │   ├── NoticeList.tsx           # 공지사항 목록 컴포넌트
│   │   ├── NoticeList.css           # 공지사항 목록 스타일
│   │   ├── ProductStats.tsx         # 상품통계 컴포넌트
│   │   └── ProductStats.css         # 상품통계 스타일
│   │
│   ├── App.tsx              # 메인 앱 컴포넌트
│   ├── App.css              # 앱 스타일
│   ├── main.tsx             # 애플리케이션 진입점
│   └── index.css            # 전역 스타일
│
├── index.html               # HTML 템플릿
├── package.json             # 프로젝트 의존성 및 스크립트
├── tsconfig.json            # TypeScript 설정
├── vite.config.ts           # Vite 빌드 도구 설정
├── README.md                # 프로젝트 설명서
└── PROJECT_STRUCTURE.md     # 이 파일
```

## 컴포넌트 설명

### 1. App.tsx
- **역할**: 애플리케이션의 최상위 컴포넌트
- **기능**: 
  - 사이드바와 메인 콘텐츠 레이아웃 관리
  - 활성 메뉴 상태 관리
  - 페이지 라우팅 (대시보드, 상품관리, 주문관리, 설정)

### 2. Sidebar.tsx
- **역할**: 좌측 네비게이션 사이드바
- **기능**:
  - 로고 표시
  - 사용자 정보 표시 (이름, 만료일)
  - 메뉴 네비게이션 (상품관리, 주문관리, 설정)
  - 서브메뉴 표시
  - 하단 공지 영역

### 3. Dashboard.tsx
- **역할**: 대시보드 메인 페이지
- **기능**:
  - 날짜 필터 (오늘, 최근3일, 최근7일, 최근30일)
  - 상단 액션 버튼 (스마트스토어, 쿠팡, 주문내역 가져오기 등)
  - 하위 컴포넌트 조합
  - 푸터 정보 표시

### 4. OrderStatusCards.tsx
- **역할**: 주문 상태별 통계 카드
- **기능**:
  - 결제완료, 배송준비중, 배송중, 배송완료 숫자 표시
  - 각 상태별 색상 구분
  - 호버 효과

### 5. ChartSection.tsx
- **역할**: 차트 영역 컨테이너
- **기능**:
  - 도넛 차트 2개 (마켓별 주문, 스토어별 주문)
  - 막대 차트 2개 (주문추이, 매출추이)
  - 차트 데이터 관리

### 6. DonutChart.tsx
- **역할**: 도넛 차트 렌더링
- **기능**:
  - Chart.js를 사용한 도넛 차트 생성
  - 퍼센트 표시
  - 범례 표시
  - 반응형 크기 조정

### 7. BarChart.tsx
- **역할**: 누적 막대 차트 렌더링
- **기능**:
  - Chart.js를 사용한 막대 차트 생성
  - 월별 데이터 표시
  - 누적 형태로 여러 데이터셋 표시
  - 범례 표시

### 8. NoticeList.tsx
- **역할**: 공지사항 목록 표시
- **기능**:
  - 최근 공지사항 5개 표시
  - 제목과 날짜 표시
  - 전체보기 버튼
  - 호버 효과

### 9. ProductStats.tsx
- **역할**: 등록 상품 통계 표시
- **기능**:
  - 스마트스토어 상품 수
  - 쿠팡 상품 수
  - 세부 통계 (3개 숫자)
  - 하단 정보 링크

## 데이터 흐름

```
App.tsx (상태 관리)
  ↓
Dashboard.tsx (날짜 필터 상태)
  ↓
├─ OrderStatusCards.tsx (정적 데이터)
├─ ChartSection.tsx
│   ├─ DonutChart.tsx (차트 데이터)
│   └─ BarChart.tsx (차트 데이터)
├─ NoticeList.tsx (정적 데이터)
└─ ProductStats.tsx (정적 데이터)
```

## 스타일링 전략

- **CSS Modules 방식**: 각 컴포넌트마다 별도의 CSS 파일
- **전역 스타일**: `index.css`에서 관리
- **색상 팔레트**:
  - Primary: #1976d2 (파란색)
  - Secondary: #FF9800 (주황색)
  - Success: #4CAF50 (녹색)
  - Warning: #FFC107 (노란색)
  - Background: #f5f5f5 (밝은 회색)

## 반응형 디자인

- **Desktop**: 1024px 이상 - 전체 레이아웃 표시
- **Tablet**: 768px ~ 1023px - 그리드 조정
- **Mobile**: 767px 이하 - 단일 컬럼 레이아웃

## 향후 확장 가능성

### API 연동
현재는 정적 데이터를 사용하지만, 다음과 같이 API 연동 가능:

```typescript
// src/services/api.ts
export const fetchOrderStats = async () => {
  const response = await fetch('/api/admin/orders/stats')
  return response.json()
}
```

### 상태 관리 라이브러리
프로젝트가 커지면 Redux, Zustand 등 도입 고려

### 라우팅
React Router를 추가하여 페이지 간 이동 구현

### 인증
로그인/로그아웃 기능 추가

### 실시간 업데이트
WebSocket을 사용한 실시간 주문 현황 업데이트
