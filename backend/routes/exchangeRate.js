// 환율 정보 API 라우트
const express = require('express');
const router = express.Router();
const https = require('https');

// 위안화 환율 조회 API
router.get('/exchange-rate/cny', async (req, res) => {
  try {
    console.log('위안화 환율 조회 API 호출됨');
    
    const url = 'https://open.er-api.com/v6/latest/CNY';
    
    https.get(url, (apiRes) => {
      let data = '';
      
      apiRes.on('data', (chunk) => {
        data += chunk;
      });
      
      apiRes.on('end', () => {
        try {
          const result = JSON.parse(data);
          
          if (result.result === 'success' && result.rates && result.rates.KRW) {
            // KRW 환율 가져오기 (소수점 제거)
            const rate = Math.floor(result.rates.KRW);
            
            console.log('환율 조회 성공:', rate);
            
            res.json({
              success: true,
              rate: rate,
              currency: 'CNY',
              date: result.time_last_update_utc
            });
          } else {
            // API 응답이 없는 경우 기본 환율 사용
            console.log('환율 API 응답 없음, 기본값 사용');
            res.json({
              success: true,
              rate: 219, // 기본 환율 (소수점 제거)
              currency: 'CNY',
              date: new Date().toISOString(),
              message: '기본 환율이 적용되었습니다.'
            });
          }
        } catch (parseError) {
          console.error('환율 파싱 오류:', parseError);
          // 파싱 오류 시 기본 환율 사용
          res.json({
            success: true,
            rate: 219, // 기본 환율 (소수점 제거)
            currency: 'CNY',
            date: new Date().toISOString(),
            message: '기본 환율이 적용되었습니다.'
          });
        }
      });
    }).on('error', (error) => {
      console.error('환율 API 호출 오류:', error);
      // 오류 시 기본 환율 사용
      res.json({
        success: true,
        rate: 219, // 기본 환율 (소수점 제거)
        currency: 'CNY',
        date: new Date().toISOString(),
        message: '기본 환율이 적용되었습니다.'
      });
    });
    
  } catch (error) {
    console.error('환율 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '환율 조회 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

module.exports = router;
