# PRD (Product Requirements Document)

## 1. 프로젝트 개요

### 1.1 프로젝트 목적
본 프로젝트는 Windows Server 2022 + IIS 환경에서 운영되는 내부 관리자 사이트와 외부 서비스 사이트를 구축하는 것을 목표로 한다.

- 내부 관리자는 상품, 주문, 사용자 정보를 효율적으로 관리한다.
- 외부 사용자는 상품 정보를 조회, 주문정보를 조회 할 수 있다.
- 운영과 배포가 단순하고, 유지보수가 쉬운 구조를 우선한다.

---

### 1.2 대상 사용자

| 구분 | 인원 | 설명 |
|---|---|---|
| 내부 관리자 | 약 20명 | 상품/재고/판매 관리 |
| 외부 사용자 | 약 200명 | 상품 정보 조회, 주문정보 조회 |

---

## 2. 운영 환경 (확정)

### 2.1 서버 환경
- OS: Windows Server 2022
- Web Server: IIS
- DB: MSSQL

### 2.2 개발 언어 / 프레임워크
- Backend: ASP.NET Core 8 Web API
- ORM: Entity Framework Core
- 내부 관리자: ASP.NET Core MVC (Razor)
- 외부 서비스: React + Material UI

---

## 3. 시스템 구성

```
[외부 사용자]
    ↓
React Frontend (IIS 정적 사이트)
    ↓ API 호출
ASP.NET Core Web API (IIS)
    ↓
MSSQL
    ↑
ASP.NET Core MVC 관리자 사이트 (IIS)
    ↑
[내부 관리자]
```

---

## 5. API 기본 규칙

### 6.1 API 구분
- 관리자 API: /api/admin/*
- 외부 공개 API: /api/public/*

### 6.2 공통 응답 포맷

```json
{
  "success": true,
  "message": "처리 완료",
  "data": {}
}
```

---

## 6. 프로젝트 구조

```
Solution
 ├─ Api           (ASP.NET Core Web API)
 ├─ Admin         (ASP.NET Core MVC)
 ├─ Frontend      (React)
 └─ Common        (공통 DTO / 유틸)
```

---

## 7. 개발 진행 순서

1. ASP.NET Core Web API 프로젝트 생성
2. MSSQL 연동 및 EF Core 설정
3. 관리자 로그인 / 권한 처리
4. AdminLTE 템플릿 적용
5. 상품 / 재고 CRUD 구현
6. 판매 데이터 조회 기능 구현
7. 외부 서비스 React 화면 구성
8. IIS 배포 및 운영 테스트

---

## 8. 완료 기준 (Acceptance Criteria)

- 관리자 로그인 정상 동작
- 상품/재고 CRUD 기능 정상 동작
- 판매 내역 조회 가능
- 외부 사이트에서 상품 조회 가능
- Windows Server 2022 + IIS 환경에서 안정적 운영

---

## 9. 추가사항
-- 화면은 하나씩 순차적으로 개발 진행한다.
-- 환경 정보는 파일로 별도로 관리를 한다.

