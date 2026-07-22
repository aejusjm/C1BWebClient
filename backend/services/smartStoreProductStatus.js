const bcrypt = require('bcryptjs');

const NAVER_COMMERCE_API_BASE = 'https://api.commerce.naver.com/external';
const TOKEN_URL = `${NAVER_COMMERCE_API_BASE}/v1/oauth2/token`;

function createTokenForm(clientId, clientSecret) {
  if (!clientId || !clientSecret) {
    const error = new Error('스마트스토어 API 인증정보가 없습니다.');
    error.code = 'MISSING_SMARTSTORE_CREDENTIALS';
    throw error;
  }

  if (!/^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{22,}/.test(clientSecret)) {
    const error = new Error('스마트스토어 APP 시크릿 형식이 올바르지 않습니다.');
    error.code = 'INVALID_CLIENT_SECRET_FORMAT';
    throw error;
  }

  // 기존 스마트스토어 토큰 발급 로직과 동일하게 서버 간 시계 오차를 보정한다.
  const timestamp = Date.now() - 30000;
  const hashed = bcrypt.hashSync(`${clientId}_${timestamp}`, clientSecret);
  const clientSecretSign = Buffer.from(hashed, 'utf8').toString('base64');

  return new URLSearchParams({
    client_id: clientId,
    timestamp: String(timestamp),
    client_secret_sign: clientSecretSign,
    grant_type: 'client_credentials',
    type: 'SELF'
  });
}

async function readResponse(response) {
  const raw = await response.text();
  if (!raw) return { raw: '', parsed: null };

  try {
    return { raw, parsed: JSON.parse(raw) };
  } catch {
    return { raw, parsed: null };
  }
}

function getApiErrorMessage(response, raw, parsed) {
  const invalidInputs = Array.isArray(parsed?.invalidInputs)
    ? parsed.invalidInputs
        .map((item) => item?.message || item?.reason || item?.name)
        .filter(Boolean)
        .join(', ')
    : '';

  return (
    invalidInputs ||
    parsed?.message ||
    parsed?.error_description ||
    parsed?.error ||
    raw ||
    `HTTP ${response.status}`
  );
}

async function issueAccessToken(clientId, clientSecret) {
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: createTokenForm(clientId, clientSecret).toString(),
    signal: AbortSignal.timeout(30000)
  });
  const { raw, parsed } = await readResponse(response);

  if (!response.ok || !parsed?.access_token) {
    const error = new Error(
      `스마트스토어 토큰 발급 실패: ${getApiErrorMessage(response, raw, parsed)}`
    );
    error.status = response.status;
    error.code = 'SMARTSTORE_TOKEN_FAILED';
    throw error;
  }

  return parsed.access_token;
}

async function sendChangeStatus(accessToken, originProductNo, statusType) {
  const encodedProductNo = encodeURIComponent(String(originProductNo));
  const response = await fetch(
    `${NAVER_COMMERCE_API_BASE}/v1/products/origin-products/${encodedProductNo}/change-status`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json;charset=UTF-8',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ statusType }),
      signal: AbortSignal.timeout(30000)
    }
  );
  const responseBody = await readResponse(response);
  return { response, ...responseBody };
}

/**
 * 네이버 원상품 판매 상태 변경.
 * C# 샘플과 동일하게 401이면 토큰을 새로 발급해 한 번 재시도한다.
 */
async function changeSmartStoreProductStatus({
  clientId,
  clientSecret,
  originProductNo,
  statusType
}) {
  let accessToken = await issueAccessToken(clientId, clientSecret);
  let result = await sendChangeStatus(accessToken, originProductNo, statusType);

  if (result.response.status === 401) {
    accessToken = await issueAccessToken(clientId, clientSecret);
    result = await sendChangeStatus(accessToken, originProductNo, statusType);
  }

  if (!result.response.ok) {
    const error = new Error(
      `스마트스토어 상품상태 변경 실패: ${getApiErrorMessage(
        result.response,
        result.raw,
        result.parsed
      )}`
    );
    error.status = result.response.status;
    error.code = 'SMARTSTORE_CHANGE_STATUS_FAILED';
    throw error;
  }

  return {
    statusCode: result.response.status,
    response: result.parsed || result.raw || null
  };
}

module.exports = {
  changeSmartStoreProductStatus
};
