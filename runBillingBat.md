# 구독 자동결제 배치 — 윈도우 작업 스케줄러 등록 가이드 (초보자용)

이 문서는 구독 정기결제 배치(`run-billing.bat`)를 **윈도우 작업 스케줄러**에 등록하여
**매일 새벽 4시에 자동 실행**되도록 설정하는 방법을 초보자도 따라 할 수 있게 정리한 것입니다.

- 배치 실행 파일: `D:\IISWebMain\backend\scripts\run-billing.bat`
- 실행 로직: `next_pay_date`(다음 결제일)가 오늘 이하이고 `status='ACTIVE'`(구독중)인 건만 결제
- 실행 기록(로그): `D:\IISWebMain\backend\logs\billing_YYYYMMDD.log`

> ⚠️ 백엔드 서버 내장 스케줄러는 **꺼진 상태**입니다. 자동결제는 이제 작업 스케줄러로만 실행됩니다.
> 그러므로 아래 등록을 꼭 완료해야 결제가 정상적으로 이루어집니다.

---

## 0. 준비물 확인

1. **Node.js 설치 여부 확인**
   - PowerShell(파워셸)을 열고 아래 입력 후 Enter:
     ```powershell
     node -v
     ```
   - `v18.x.x` 처럼 버전이 나오면 정상입니다. (없으면 https://nodejs.org 에서 LTS 설치)

2. **환경설정 파일 확인**
   - `D:\IISWebMain\backend\.env` 에 토스 시크릿 키(`TOSS_SECRET_KEY`)와 DB 정보가 들어 있어야 합니다.

---

## 1. 배치가 잘 실행되는지 먼저 테스트 (중요)

작업 스케줄러에 등록하기 전에, 손으로 한 번 실행해서 정상 동작하는지 확인합니다.

1. **PowerShell 실행** (시작 메뉴 → "PowerShell" 검색 → 클릭)
2. 아래 명령을 복사해서 붙여넣고 Enter:
   ```powershell
   D:\IISWebMain\backend\scripts\run-billing.bat
   ```
3. 잠시 후 로그 확인:
   ```powershell
   Get-Content D:\IISWebMain\backend\logs\billing_*.log -Tail 20
   ```
   - `runBilling 실행 시작` ~ `runBilling 실행 종료 (exit=0)` 가 보이면 성공입니다.

### ❗ "node을(를) 찾을 수 없습니다" 오류가 나는 경우
작업 스케줄러는 PATH를 인식하지 못할 때가 있어, node의 전체 경로를 직접 넣어줘야 합니다.

1. node 경로 확인:
   ```powershell
   where.exe node
   ```
   예: `C:\Program Files\nodejs\node.exe`
2. `run-billing.bat` 파일을 메모장으로 열어 아래 줄을
   ```
   node scripts\runBilling.js >> "%LOGFILE%" 2>&1
   ```
   다음처럼 전체 경로로 수정:
   ```
   "C:\Program Files\nodejs\node.exe" scripts\runBilling.js >> "%LOGFILE%" 2>&1
   ```
3. 저장 후 1번부터 다시 테스트.

---

## 2. 작업 스케줄러 등록 — 방법 ① 명령어 한 줄 (가장 쉬움)

1. **PowerShell을 "관리자 권한"으로 실행**
   - 시작 메뉴 → "PowerShell" 검색 → **마우스 오른쪽 클릭** → **관리자 권한으로 실행**
2. 아래 명령을 복사해서 붙여넣고 Enter:
   ```powershell
   schtasks /Create /TN "C1B 구독 자동결제" /TR "D:\IISWebMain\backend\scripts\run-billing.bat" /SC DAILY /ST 04:00 /RL HIGHEST /F
   ```
3. `성공: ... 예약 작업이 만들어졌습니다` 메시지가 나오면 완료입니다.

명령어 의미(참고):
| 옵션 | 뜻 |
|------|-----|
| `/TN` | 작업 이름 (C1B 구독 자동결제) |
| `/TR` | 실행할 파일 (배치 경로) |
| `/SC DAILY` | 매일 실행 |
| `/ST 04:00` | 실행 시각 (새벽 4시) |
| `/RL HIGHEST` | 가장 높은 권한으로 실행 |
| `/F` | 같은 이름 있으면 덮어쓰기 |

---

## 3. 작업 스케줄러 등록 — 방법 ② 화면(GUI)으로 등록

명령어가 부담되면 화면으로 등록할 수 있습니다.

1. 시작 메뉴 → **작업 스케줄러**(Task Scheduler) 검색 후 실행
2. 오른쪽 **작업 만들기...**(Create Task) 클릭 *(주의: "기본 작업 만들기"가 아니라 "작업 만들기")*
3. **[일반]** 탭
   - 이름: `C1B 구독 자동결제`
   - **사용자의 로그온 여부와 관계없이 실행** 선택
   - **가장 높은 수준의 권한으로 실행** 체크
4. **[트리거]** 탭 → **새로 만들기**
   - 설정: **매일**
   - 시작 시간: **오전 4:00:00**
   - 확인
5. **[동작]** 탭 → **새로 만들기**
   - 작업: **프로그램 시작**
   - 프로그램/스크립트: 
     ```
     D:\IISWebMain\backend\scripts\run-billing.bat
     ```
   - **⭐ 시작 위치(중요!):**
     ```
     D:\IISWebMain\backend
     ```
   - 확인
6. 전체 **확인** → 윈도우 로그인 비밀번호 입력 → 완료

---

## 4. 정상 등록 확인 & 즉시 실행 테스트

### 즉시 한 번 실행해보기 (관리자 PowerShell)
```powershell
schtasks /Run /TN "C1B 구독 자동결제"
```

### 실행 결과(로그) 확인
```powershell
Get-Content D:\IISWebMain\backend\logs\billing_*.log -Tail 20
```

### 작업 스케줄러 화면에서 확인
- **작업 스케줄러** 실행 → 왼쪽 **작업 스케줄러 라이브러리** 클릭
- 목록에서 `C1B 구독 자동결제` 선택
- 아래쪽에서 **마지막 실행 시간 / 마지막 실행 결과 / 다음 실행 시간** 확인 가능
  - "마지막 실행 결과"가 **(0x0)** 이면 정상 실행된 것입니다.

---

## 5. 자주 쓰는 관리 명령어

| 하고 싶은 것 | 명령어 (관리자 PowerShell) |
|--------------|----------------------------|
| 지금 즉시 실행 | `schtasks /Run /TN "C1B 구독 자동결제"` |
| 잠시 중지(비활성화) | `schtasks /Change /TN "C1B 구독 자동결제" /DISABLE` |
| 다시 켜기 | `schtasks /Change /TN "C1B 구독 자동결제" /ENABLE` |
| 등록 내용 보기 | `schtasks /Query /TN "C1B 구독 자동결제" /V /FO LIST` |
| 작업 삭제 | `schtasks /Delete /TN "C1B 구독 자동결제" /F` |
| 실행 시간 변경(예: 05:00) | `schtasks /Change /TN "C1B 구독 자동결제" /ST 05:00` |

---

## 6. 문제 해결 (FAQ)

**Q. 마지막 실행 결과가 0x1 로 나와요.**
- 배치 실행 중 오류입니다. `backend\logs\billing_*.log` 의 마지막 부분을 확인하세요.
- 대부분 ① node 경로 문제(1번의 "node 못 찾음" 해결 참고) ② `.env` 설정 누락 ③ DB 연결 실패 입니다.

**Q. 새벽에 PC가 꺼져 있으면요?**
- PC가 꺼져 있으면 실행되지 않습니다. 서버 PC는 항상 켜두거나, 작업 스케줄러 **[조건]** 탭에서
  "이 작업을 실행하기 위해 절전 모드 해제" 옵션을 켜세요.

**Q. 결제가 두 번 되지 않나요?**
- 백엔드 내장 스케줄러는 꺼두었으므로, 작업 스케줄러 한 곳에서만 실행됩니다.
- 배치는 `next_pay_date`가 도래한 건만 결제하므로, 같은 날 두 번 실행돼도 이미 결제된 건은 다음 결제일이 미래로 바뀌어 중복 결제되지 않습니다.

**Q. 테스트로 특정 사용자만 즉시 결제해보고 싶어요.**
- 백엔드 서버가 켜진 상태에서:
  ```powershell
  Invoke-RestMethod -Method Post -Uri http://localhost:3001/api/subscription/charge-now -ContentType "application/json" -Body '{"userId":"사용자ID"}'
  ```

---

## 요약 (3줄)
1. PowerShell에서 `run-billing.bat`을 한 번 실행해 정상 동작 확인
2. **관리자 PowerShell**에서 `schtasks /Create ...` 한 줄로 등록 (매일 04:00)
3. `schtasks /Run`으로 즉시 실행해보고, 로그 또는 작업 스케줄러 화면에서 결과 확인
