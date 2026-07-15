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

/** 토스 카드사 issuerCode → 표시용 카드명 */
const CARD_ISSUER_NAMES = {
  '3K': '기업비씨카드',
  '46': '광주카드',
  '71': '롯데카드',
  '30': '산업은행카드',
  '31': 'BC카드',
  '51': '삼성카드',
  '38': '새마을금고카드',
  '41': '신한카드',
  '62': '신협카드',
  '36': '씨티카드',
  '33': '우리카드',
  W1: '우리카드',
  '37': '우체국카드',
  '39': '저축은행카드',
  '35': '전북카드',
  '42': '제주카드',
  '15': '카카오뱅크카드',
  '3A': '케이뱅크카드',
  '24': '토스뱅크카드',
  '21': '하나카드',
  '61': '현대카드',
  '11': 'KB국민카드',
  '91': 'NH농협카드',
  '34': 'Sh수협카드',
  '6D': '다이너스',
  '4M': '마스터카드',
  '3C': '유니온페이',
  '7A': '아멕스',
  '4J': 'JCB',
  '4V': 'VISA'
};

const EASY_PAY_NAMES = {
  TOSSPAY: '토스페이',
  NAVERPAY: '네이버페이',
  SAMSUNGPAY: '삼성페이',
  APPLEPAY: '애플페이',
  LPAY: '엘페이',
  KAKAOPAY: '카카오페이',
  PINPAY: '핀페이',
  PAYCO: '페이코',
  SSG: 'SSG페이'
};

/**
 * 토스 결제/빌링 응답에서 카드명·카드번호(마스킹) 추출
 * - 빌링키 발급: cardCompany, cardNumber / card.issuerCode, card.number
 * - 결제 승인: card.issuerCode, card.number / easyPay.provider
 */
function extractCardInfo(response) {
  if (!response || typeof response !== 'object') {
    return { cardName: null, cardNumber: null };
  }

  const card = response.card && typeof response.card === 'object' ? response.card : {};
  const cardNumber = response.cardNumber || card.number || null;

  let cardName = null;
  if (response.cardCompany) {
    const company = String(response.cardCompany).trim();
    cardName = /카드$/.test(company) ? company : `${company}카드`;
  } else if (card.issuerCode) {
    const code = String(card.issuerCode).trim();
    cardName = CARD_ISSUER_NAMES[code] || `카드(${code})`;
  } else if (response.easyPay && response.easyPay.provider) {
    const provider = String(response.easyPay.provider).trim();
    cardName = EASY_PAY_NAMES[provider] || provider;
  }

  return {
    cardName: cardName || null,
    cardNumber: cardNumber ? String(cardNumber) : null
  };
}

/**
 * 결제시간(ISO/Date) → 한국시간 벽시계 문자열 (yyyy-MM-dd HH:mm:ss)
 * SQL DATETIME은 타임존이 없으므로 KST 시각을 그대로 저장해 9시간 시차를 방지한다.
 */
function toKoreaDateTimeString(value) {
  const d = value ? new Date(value) : new Date();
  if (Number.isNaN(d.getTime())) {
    return toKoreaDateTimeString(new Date());
  }

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).formatToParts(d);

  const get = (type) => parts.find((p) => p.type === type)?.value || '00';
  let hour = get('hour');
  if (hour === '24') hour = '00';

  return `${get('year')}-${get('month')}-${get('day')} ${hour}:${get('minute')}:${get('second')}`;
}

module.exports = {
  TOSS_API_BASE,
  getAuthHeader,
  issueBillingKey,
  requestBilling,
  cancelPayment,
  confirmPayment,
  toKoreaDateTimeString,
  extractCardInfo
};
