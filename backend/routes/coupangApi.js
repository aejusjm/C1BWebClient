// 쿠팡 API 유틸/연동 테스트 라우터
const express = require('express');
const crypto = require('crypto');

const router = express.Router();

const COUPANG_API_BASE = 'https://api-gateway.coupang.com';

/**
 * HMAC-SHA256 기반 쿠팡 Authorization 헤더 생성
 * C# CreateAuth/GetHmac 로직과 동일
 */
function createCoupangAuth(method, path, query, secretKey, accessKey) {
  const algorithm = 'HmacSHA256';
  const datetime = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '').slice(2); // yyMMddTHHmmssZ
  
  // message = datetime + method + path + query
  const message = `${datetime}${method}${path}${query}`;
  
  // HMAC-SHA256 서명
  const hmac = crypto.createHmac('sha256', secretKey);
  hmac.update(message, 'ascii');
  const signature = hmac.digest('hex');
  
  // Authorization 헤더 포맷
  return `CEA algorithm=${algorithm}, access-key=${accessKey}, signed-date=${datetime}, signature=${signature}`;
}

/**
 * 쿠팡 연동 테스트 (반품철회요청 목록 조회로 인증 확인)
 */
router.post('/auth-test', async (req, res) => {
  try {
    const { vendorId, accessKey, secretKey } = req.body;

    if (!vendorId || !accessKey || !secretKey) {
      return res.status(400).json({
        success: false,
        message: 'vendorId, accessKey, secretKey는 필수입니다.'
      });
    }

    // C# AuthCheck와 동일: 최근 3일 반품철회요청 조회
    const today = new Date();
    const dateFrom = new Date(today);
    dateFrom.setDate(today.getDate() - 3);
    
    const dateFromStr = dateFrom.toISOString().split('T')[0];
    const dateToStr = today.toISOString().split('T')[0];
    
    const method = 'GET';
    const path = `/v2/providers/openapi/apis/api/v4/vendors/${vendorId}/returnWithdrawRequests`;
    const query = `dateFrom=${dateFromStr}&dateTo=${dateToStr}&pageIndex=1&sizePerPage=10`;
    
    const authHeader = createCoupangAuth(method, path, query, secretKey, accessKey);
    
    const response = await fetch(`${COUPANG_API_BASE}${path}?${query}`, {
      method: method,
      headers: {
        'Authorization': authHeader,
        'Accept': '*/*',
        'Connection': 'keep-alive',
        'Cache-Control': 'max-age=0'
      }
    });

    const raw = await response.text();
    let parsed = null;
    try {
      parsed = raw ? JSON.parse(raw) : null;
    } catch (_) {
      parsed = null;
    }

    // C# 로직과 동일: "message":"OK" 포함 여부로 성공 판단
    if (raw.includes('"message":"OK"')) {
      return res.json({
        success: true,
        message: '쿠팡 연동 테스트 성공'
      });
    }

    // 실패 응답 처리
    const errorMessage = parsed?.message || parsed?.error || '쿠팡 API 정보를 다시 확인해주세요.';
    
    return res.status(400).json({
      success: false,
      message: errorMessage,
      statusCode: response.status,
      details: parsed || raw
    });
  } catch (error) {
    console.error('쿠팡 연동 테스트 오류:', error);
    return res.status(500).json({
      success: false,
      message: '쿠팡 연동 테스트 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

module.exports = router;
