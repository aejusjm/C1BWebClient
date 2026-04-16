// 이미지 프록시 라우트 - 외부 이미지 CORS 및 SSL 문제 해결
const express = require('express');
const router = express.Router();
const https = require('https');
const http = require('http');

// 이미지 프록시 엔드포인트
router.get('/proxy', async (req, res) => {
  let imageUrl = req.query.url;

  if (!imageUrl) {
    return res.status(400).json({
      success: false,
      message: '이미지 URL이 필요합니다.'
    });
  }

  try {
    // URL 정규화 (https// → https://)
    imageUrl = imageUrl.replace(/^(https?)\/{1,2}/, '$1://');
    
    // URL 유효성 검증
    try {
      new URL(imageUrl);
    } catch (e) {
      console.error('잘못된 URL 형식:', imageUrl);
      return res.status(400).json({
        success: false,
        message: '잘못된 URL 형식입니다.',
        url: imageUrl
      });
    }
    
    const isHttps = imageUrl.startsWith('https');
    const protocol = isHttps ? https : http;
    
    // 요청 옵션 설정
    const options = {};
    
    // HTTPS인 경우에만 SSL 인증서 검증 무시
    if (isHttps) {
      options.agent = new https.Agent({
        rejectUnauthorized: false
      });
    }

    protocol.get(imageUrl, options, (imageResponse) => {
      // 이미지 응답 헤더 설정
      res.setHeader('Content-Type', imageResponse.headers['content-type'] || 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=86400'); // 1일 캐시
      res.setHeader('Access-Control-Allow-Origin', '*');
      
      // 이미지 데이터 스트리밍
      imageResponse.pipe(res);
    }).on('error', (error) => {
      console.error('이미지 프록시 오류:', error);
      res.status(500).json({
        success: false,
        message: '이미지를 불러올 수 없습니다.'
      });
    });
  } catch (error) {
    console.error('이미지 프록시 오류:', error);
    res.status(500).json({
      success: false,
      message: '이미지를 불러올 수 없습니다.',
      error: error.message
    });
  }
});

module.exports = router;
