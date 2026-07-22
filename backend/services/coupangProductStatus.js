const crypto = require('crypto');

const COUPANG_API_BASE = 'https://api-gateway.coupang.com';
const SELLER_PRODUCT_PATH = '/v2/providers/seller_api/apis/api/v1/marketplace/seller-products';
const STOP_SALE_PATH_TEMPLATE =
  '/v2/providers/seller_api/apis/api/v1/marketplace/vendor-items/{vendorItemId}/sales/stop';

/**
 * 쿠팡 HMAC-SHA256 Authorization 헤더 생성 (C# 샘플과 동일)
 * datetime: UTC 기준 yyMMdd'T'HHmmss'Z'
 * message : datetime + method + path + query
 */
function generateHmacAuthorization(method, path, query, accessKey, secretKey) {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, '0');
  const datetime =
    String(now.getUTCFullYear()).slice(2) +
    pad(now.getUTCMonth() + 1) +
    pad(now.getUTCDate()) +
    'T' +
    pad(now.getUTCHours()) +
    pad(now.getUTCMinutes()) +
    pad(now.getUTCSeconds()) +
    'Z';

  const message = datetime + method + path + query;
  const signature = crypto
    .createHmac('sha256', secretKey)
    .update(message, 'ascii')
    .digest('hex');

  return `CEA algorithm=HmacSHA256, access-key=${accessKey}, signed-date=${datetime}, signature=${signature}`;
}

async function coupangRequest({ method, path, query = '', accessKey, secretKey }) {
  const authorization = generateHmacAuthorization(method, path, query, accessKey, secretKey);
  const url = query ? `${COUPANG_API_BASE}${path}?${query}` : `${COUPANG_API_BASE}${path}`;

  const response = await fetch(url, {
    method,
    headers: {
      Authorization: authorization,
      'Content-Type': 'application/json;charset=UTF-8'
    },
    signal: AbortSignal.timeout(15000)
  });

  const raw = await response.text();
  let parsed = null;
  try {
    parsed = raw ? JSON.parse(raw) : null;
  } catch {
    parsed = null;
  }

  return { response, raw, parsed };
}

function getApiErrorMessage(response, raw, parsed) {
  return parsed?.message || raw || `HTTP ${response.status}`;
}

/**
 * sellerProductId(상품번호)로 상품 상세를 조회해 vendorItemId 목록을 반환.
 */
async function getVendorItemIds({ accessKey, secretKey, sellerProductId }) {
  const path = `${SELLER_PRODUCT_PATH}/${encodeURIComponent(String(sellerProductId))}`;
  const { response, raw, parsed } = await coupangRequest({
    method: 'GET',
    path,
    accessKey,
    secretKey
  });

  if (!response.ok) {
    const error = new Error(
      `쿠팡 상품 조회 실패: ${getApiErrorMessage(response, raw, parsed)}`
    );
    error.status = response.status;
    error.code = 'COUPANG_GET_PRODUCT_FAILED';
    throw error;
  }

  const items = Array.isArray(parsed?.data?.items) ? parsed.data.items : [];
  return items
    .map((item) => String(item?.vendorItemId ?? '').trim())
    .filter(Boolean);
}

/**
 * vendorItemId 단건 판매중지. 응답 code가 SUCCESS면 성공.
 */
async function stopSaleVendorItem({ accessKey, secretKey, vendorItemId }) {
  const path = STOP_SALE_PATH_TEMPLATE.replace(
    '{vendorItemId}',
    encodeURIComponent(String(vendorItemId))
  );
  const { response, raw, parsed } = await coupangRequest({
    method: 'PUT',
    path,
    accessKey,
    secretKey
  });

  const code = String(parsed?.code || '').toUpperCase();
  if (!response.ok || code !== 'SUCCESS') {
    return {
      success: false,
      message: `[HTTP ${response.status}] ${getApiErrorMessage(response, raw, parsed)}`
    };
  }

  return { success: true, message: parsed?.message || 'SUCCESS' };
}

/**
 * 쿠팡 상품 판매중지 (C# 샘플의 STEP 2~4와 동일한 흐름)
 * 1) sellerProductId → vendorItemId 목록 조회
 * 2) 각 vendorItemId를 순차적으로 판매중지 (Rate Limit 방지 300ms 간격)
 */
async function stopCoupangProductSale({ accessKey, secretKey, sellerProductId }) {
  if (!accessKey || !secretKey) {
    const error = new Error('쿠팡 API 인증정보(accessKey/secretKey)가 없습니다.');
    error.code = 'MISSING_COUPANG_CREDENTIALS';
    throw error;
  }

  const vendorItemIds = await getVendorItemIds({ accessKey, secretKey, sellerProductId });
  if (vendorItemIds.length === 0) {
    const error = new Error('쿠팡 상품에서 조회된 vendorItemId가 없습니다.');
    error.code = 'COUPANG_NO_VENDOR_ITEMS';
    throw error;
  }

  const failed = [];
  for (const vendorItemId of vendorItemIds) {
    const result = await stopSaleVendorItem({ accessKey, secretKey, vendorItemId });
    if (!result.success) {
      failed.push({ vendorItemId, message: result.message });
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  if (failed.length > 0) {
    const detail = failed
      .map((item) => `${item.vendorItemId}: ${item.message}`)
      .join(' / ');
    const error = new Error(
      `쿠팡 판매중지 실패 (${failed.length}/${vendorItemIds.length}건): ${detail}`
    );
    error.code = 'COUPANG_STOP_SALE_FAILED';
    throw error;
  }

  return {
    totalCount: vendorItemIds.length,
    vendorItemIds
  };
}

module.exports = {
  stopCoupangProductSale
};
