# tosspay.md — 토스페이먼츠 구독 결제 연동 가이드 (초보자용)

이 문서는 `구독 플랜 확인` 페이지에 **토스페이먼츠 빌링(자동결제)** 을 연동하여
매월 구독료가 자동으로 결제되도록 만드는 전체 과정을 정리한 것입니다.

- 프론트엔드: React + TypeScript + Vite (`web-client`)
- 백엔드: Node.js + Express (`backend`), MSSQL(`mssql`)
- 만료일 컬럼: `tb_user.end_date`

> 토스 API/SDK는 버전이 바뀔 수 있습니다. 구현 시 최신 공식 문서(https://docs.tosspayments.com)도 함께 확인하세요.

---

## 1. 개요

### 1.1 무엇을 만드나
- `구독 플랜 확인` 페이지의 **구독하기** 버튼으로 카드를 등록하고, 매월 자동으로 구독료가 결제되게 한다.
- 결제 성공 시 `tb_user.end_date`(사용 만료일)를 1개월 연장한다.

### 1.2 일회성 결제 vs 빌링(자동결제)
| 구분 | 일회성 결제 | 빌링(자동결제) ← **우리가 쓸 방식** |
|------|------------|-----------------------------------|
| 용도 | 단건 구매 | 정기 구독 |
| 핵심 | 결제창에서 즉시 승인 | **빌링키**를 발급받아 저장 후, 서버가 매월 결제 |
| 카드 재입력 | 매번 필요 | 최초 1회만 |

### 1.3 전체 흐름
```
[프론트] 구독하기 클릭
   → 백엔드 prepare 호출로 customerKey 발급
   → 토스 SDK 카드 등록창(requestBillingAuth)
   → 성공 시 successUrl로 authKey, customerKey 전달
[백엔드] authKey로 "빌링키 발급" API 호출
   → billingKey를 DB에 저장 (customerKey와 매핑)
   → 즉시 첫 결제 실행 (billingKey로 결제 승인)
   → tb_user.end_date +1개월 연장
[스케줄러] 매월 billingKey로 자동 결제 실행 → end_date 연장
[웹훅] 토스가 결제 상태 변경을 통지 → DB 상태 동기화
```

---

## 2. 사전 준비 (계정 / 키 발급)

1. **토스페이먼츠 가입 & 상점 등록** (https://www.tosspayments.com)
2. **API 키 확인** (개발자센터 → API 키)
   - `클라이언트 키`(test_ck_..., live_ck_...): 프론트엔드용
   - `시크릿 키`(test_sk_..., live_sk_...): 백엔드용 (절대 노출 금지)
3. **빌링(자동결제) 사용 신청**: 자동결제는 별도 계약/활성화가 필요할 수 있으니 토스에 문의
4. **결제 금액 확정**: 기본 990,000원 + VAT 10% = 1,089,000원 / 추가 50,000원 + VAT = 55,000원

---

## 3. 데이터베이스 설계 (MSSQL)

테이블 생성 스크립트는 `backend/sql/subscription_tables.sql` 에 있습니다.
또는 아래 노드 스크립트로 한 번에 생성할 수 있습니다.

```bash
cd backend
node scripts/createSubscriptionTables.js
```

생성되는 테이블:
- `tb_subscription` : 구독/빌링키 정보 (user_id, customer_key, billing_key, plan_type, amount, status, next_pay_date ...)
- `tb_subscription_payment` : 결제 이력 (order_id, payment_key, amount, status, paid_at, raw_response ...)

> `billing_key`는 매우 민감합니다. DB 접근 통제 및 가능하면 암호화 저장을 고려하세요.

---

## 4. 환경변수 설정

### 4.1 백엔드 `backend/.env` (예시는 `backend/.env.example`)
```
TOSS_SECRET_KEY=test_sk_여기에_시크릿키
TOSS_API_BASE=https://api.tosspayments.com
```

### 4.2 프론트엔드 `web-client/.env` (예시는 `web-client/.env.example`)
```
VITE_API_URL=http://localhost:3001
VITE_TOSS_CLIENT_KEY=test_ck_여기에_클라이언트키
```

> `.env`는 반드시 `.gitignore`에 포함하세요(커밋 금지). `.env.example`만 커밋합니다.

---

## 5. 백엔드 구현

생성/수정 파일:
- `backend/services/tossPayments.js` : 토스 API 호출 헬퍼(빌링키 발급, 결제 실행)
- `backend/routes/subscription.js` : 구독 API 라우트
- `backend/scheduler/subscriptionScheduler.js` : 매월 자동결제 스케줄러
- `backend/server.js` : 라우트 등록 + 스케줄러 시작

### API 목록 (`/api/subscription`)
| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/prepare` | 결제 전 customerKey 발급 + 구독 레코드 생성(pending) |
| POST | `/issue-billing-key` | authKey로 빌링키 발급 + 첫 결제 + end_date 연장 |
| GET | `/:userId` | 구독 상태 조회 |
| POST | `/cancel` | 구독 해지(자동결제 중지) |
| POST | `/charge-now` | (테스트용) 특정 유저 즉시 결제 |
| POST | `/run-billing` | (테스트용) 정기결제 배치 수동 실행 |
| POST | `/webhook` | 토스 결제 상태 웹훅 수신 |

### 인증 헤더
토스 시크릿 키를 `시크릿키:` 형태로 Base64 인코딩해 `Basic` 인증에 사용합니다.

---

## 6. 프론트엔드 구현

### 6.1 SDK 설치
```bash
cd web-client
npm install @tosspayments/payment-sdk
```

### 6.2 동작
- `SubscriptionPlanPage.tsx`의 **구독하기** 클릭 →
  1) 백엔드 `/prepare` 호출로 `customerKey` 수신
  2) `requestBillingAuth('카드', { customerKey, successUrl, failUrl })` 로 카드 등록창 호출
- 카드 등록 성공 시 토스가 `successUrl` 로 리다이렉트(`authKey`, `customerKey` 포함)
- 페이지가 다시 로드되면 쿼리스트링을 읽어 백엔드 `/issue-billing-key` 호출 → 첫 결제 + 만료일 연장
- 실패 시 `failUrl` 로 리다이렉트되어 안내 메시지 표시

> 본 프로젝트는 메뉴 전환(activeMenu) 방식이므로, successUrl/failUrl을 루트(`/`)에 쿼리스트링으로 두고
> `App.tsx`가 이를 감지해 구독 페이지를 표시하도록 구현했습니다.

---

## 7. 보안 체크리스트
- 시크릿 키는 **백엔드에서만** 사용, 절대 프론트/깃에 노출 금지
- 결제 금액(`amount`)은 **서버에서 plan으로 강제 결정** (프론트에서 받은 금액 신뢰 금지)
- `orderId`는 매번 고유 생성, 중복 결제 방지
- 빌링키는 민감정보 → 접근 통제/암호화
- 결제 검증은 항상 서버에서 토스 응답으로 확인

---

## 8. 테스트 절차

1. 패키지 설치
   ```bash
   cd backend && npm install
   cd ../web-client && npm install
   ```
2. 테이블 생성
   ```bash
   cd backend
   node scripts/createSubscriptionTables.js
   ```
3. 환경변수 설정 (`backend/.env`, `web-client/.env`) — 테스트 키 입력
4. 서버 실행
   ```bash
   cd backend && npm run dev
   cd ../web-client && npm run dev
   ```
5. 브라우저에서 `구독 플랜 확인` → **구독하기** → 토스 테스트 카드로 등록
6. 결제 성공 후 확인:
   - `tb_subscription`, `tb_subscription_payment` 레코드 생성
   - `tb_user.end_date` 1개월 연장
7. (선택) 자동결제 배치 테스트
   ```bash
   curl -X POST http://localhost:3001/api/subscription/run-billing
   ```
8. (선택) 특정 유저 즉시 결제 테스트
   ```bash
   curl -X POST http://localhost:3001/api/subscription/charge-now \
     -H "Content-Type: application/json" \
     -d "{\"userId\":\"테스트유저ID\"}"
   ```

### 토스 테스트 카드
- 토스 개발자센터의 테스트 카드 정보를 사용합니다(아무 카드번호/유효기간/생년월일 입력 가능한 테스트 모드).
- 테스트 키(`test_*`)에서는 실제 청구가 발생하지 않습니다.

---

## 9. 배포 (개발 → 운영)
1. **라이브 키로 교체**: `.env`의 `test_*` → `live_*` (프론트/백엔드 모두)
2. **HTTPS 필수**: successUrl/failUrl/웹훅 모두 https 도메인
3. `VITE_API_URL`을 실제 API 도메인으로 변경 후 프론트 재빌드(`npm run build`)
4. 웹훅 URL을 운영 도메인으로 등록 (`https://도메인/api/subscription/webhook`)
5. 토스 **라이브 심사/계약 완료**(자동결제 활성화) 확인
6. 실제 카드로 최종 점검 후 오픈
7. 운영 모니터링: 결제 실패 알림, 로그(`raw_response`) 확인 체계 마련

---

## 10. 자주 막히는 포인트
- 자동결제(빌링) 미활성화 상태에서 빌링 API 호출 → 권한 오류: 토스에 신청 필요
- `customerKey`를 유저마다 고유하게 만들지 않으면 카드가 섞임
- successUrl 도메인이 등록 도메인과 다르면 리다이렉트 실패
- 금액을 프론트 값으로 결제 → 위변조 위험 (서버에서 결정)
- 웹훅에서 200을 늦게 주면 토스가 재전송 → 빠른 200 응답 + 비동기 처리
- Node 18 미만에서는 전역 `fetch`가 없음 → Node 18+ 사용 권장
