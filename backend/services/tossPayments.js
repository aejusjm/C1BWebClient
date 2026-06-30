// 토스페이먼츠 API 호출 헬퍼 (빌링/자동결제)
require('dotenv').config();

const TOSS_API_BASE = process.env.TOSS_API_BASE || 'https://api.tosspayments.com';

// 시크릿 키를 "시크릿키:" 형태로 Base64 인코딩하여 Basic 인증 헤더 생성
function getAuthHeader() {
  const secretKey = process.env.TOSS_SECRET_KEY || '';
  return 'Basic ' + Buffer.from(`${secretKey}:`).toString('base64');
}

// authKey + customerKey 로 빌링키 발급
// 성공 시 { billingKey, ... } 반환
async function issueBillingKey(authKey, customerKey) {
  const res = await fetch(`${TOSS_API_BASE}/v1/billing/authorizations/issue`, {
    method: 'POST',
    headers: {
      Authorization: getAuthHeader(),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ authKey, customerKey })
  });

  const data = await res.json();
  if (!res.ok) {
    const message = data.message || '빌링키 발급에 실패했습니다.';
    const err = new Error(message);
    err.tossResponse = data;
    throw err;
  }
  return data;
}

// 빌링키로 결제 실행
// params: { customerKey, amount, orderId, orderName, taxFreeAmount? }
async function requestBilling(billingKey, params) {
  const res = await fetch(`${TOSS_API_BASE}/v1/billing/${billingKey}`, {
    method: 'POST',
    headers: {
      Authorization: getAuthHeader(),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(params)
  });

  const data = await res.json();
  if (!res.ok) {
    const message = data.message || '결제 실행에 실패했습니다.';
    const err = new Error(message);
    err.tossResponse = data;
    throw err;
  }
  return data;
}

// 결제 취소(환불). 부분 취소 시 cancelAmount 지정.
// params: { cancelReason, cancelAmount? }
// idempotencyKey: 중복 환불 방지용 멱등키
async function cancelPayment(paymentKey, params, idempotencyKey) {
  const headers = {
    Authorization: getAuthHeader(),
    'Content-Type': 'application/json'
  };
  if (idempotencyKey) {
    headers['Idempotency-Key'] = idempotencyKey;
  }

  const res = await fetch(`${TOSS_API_BASE}/v1/payments/${paymentKey}/cancel`, {
    method: 'POST',
    headers,
    body: JSON.stringify(params)
  });

  const data = await res.json();
  if (!res.ok) {
    const message = data.message || '환불 처리에 실패했습니다.';
    const err = new Error(message);
    err.tossResponse = data;
    throw err;
  }
  return data;
}

// 일반 결제 승인 (결제창 방식)
// params: { paymentKey, orderId, amount }
async function confirmPayment({ paymentKey, orderId, amount }) {
  const res = await fetch(`${TOSS_API_BASE}/v1/payments/confirm`, {
    method: 'POST',
    headers: {
      Authorization: getAuthHeader(),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ paymentKey, orderId, amount })
  });

  const data = await res.json();
  if (!res.ok) {
    const message = data.message || '결제 승인에 실패했습니다.';
    const err = new Error(message);
    err.tossResponse = data;
    throw err;
  }
  return data;
}

module.exports = {
  TOSS_API_BASE,
  getAuthHeader,
  issueBillingKey,
  requestBilling,
  cancelPayment,
  confirmPayment
};
