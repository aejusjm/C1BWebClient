// 통관번호 입력 관련 API 라우트 (외부 접근용)
const express = require('express');
const router = express.Router();
const { getConnection, sql } = require('../config/database');
const https = require('https');

// 통관번호 검증 API 인증키
const CUSTOMS_API_KEY = process.env.CUSTOMS_API_KEY || 't210m266o074c018k040h050o2';

// 주문 정보 조회 (pccc_guid로)
router.get('/order-info/:pcccGuid', async (req, res) => {
  try {
    const { pcccGuid } = req.params;
    
    console.log('주문 정보 조회 - pccc_guid:', pcccGuid);
    
    if (!pcccGuid) {
      return res.status(400).json({
        success: false,
        message: 'pccc_guid는 필수입니다.'
      });
    }
    
    const pool = await getConnection();
    
    const result = await pool.request()
      .input('pccc_guid', sql.NVarChar, pcccGuid)
      .query(`
        SELECT  
          C.store_name AS store_name,
          A.product_name AS product_name,
          A.opt_info AS opt_info,
          A.order_id AS order_id,
          A.ordrr_name AS ordrr_name,
          A.ordrr_tel AS ordrr_tel
        FROM tb_order_info A
        INNER JOIN tb_kakao_mag B
          ON A.order_id = B.order_id 
        INNER JOIN tb_user_market_ss C
          ON A.user_id = C.user_id 
          AND A.biz_idx = C.biz_idx 
        WHERE B.pccc_guid = @pccc_guid
      `);
    
    if (result.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: '주문 정보를 찾을 수 없습니다.'
      });
    }
    
    console.log('주문 정보 조회 성공:', result.recordset[0]);
    
    res.json({
      success: true,
      data: result.recordset[0]
    });
    
  } catch (error) {
    console.error('주문 정보 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '주문 정보 조회 중 오류가 발생했습니다.'
    });
  }
});

// 통관번호 검증 API
router.post('/validate-pccc', async (req, res) => {
  try {
    const { pccc, ordrr_name, ordrr_tel } = req.body;
    
    console.log('통관번호 검증 - pccc:', pccc, 'ordrr_name:', ordrr_name, 'ordrr_tel:', ordrr_tel);
    
    if (!pccc || !ordrr_name || !ordrr_tel) {
      return res.status(400).json({
        success: false,
        message: '통관번호, 이름, 전화번호는 필수입니다.'
      });
    }
    
    // 관세청 API 호출
    const url = `https://unipass.customs.go.kr:38010/ext/rest/persEcmQry/retrievePersEcm?crkyCn=${CUSTOMS_API_KEY}&persEcm=${encodeURIComponent(pccc)}&pltxNm=${encodeURIComponent(ordrr_name)}&cralTelno=${encodeURIComponent(ordrr_tel)}`;
    
    https.get(url, (apiRes) => {
      let data = '';
      
      apiRes.on('data', (chunk) => {
        data += chunk;
      });
      
      apiRes.on('end', () => {
        console.log('관세청 API 응답:', data);
        
        // tCnt 값 추출
        const tCntMatch = data.match(/<tCnt>(\d+)<\/tCnt>/);
        const tCnt = tCntMatch ? tCntMatch[1] : '0';
        
        if (tCnt === '1') {
          // 검증 성공
          res.json({
            success: true,
            valid: true
          });
        } else {
          // 검증 실패 - 오류 정보 추출
          const ntceInfoMatch = data.match(/<ntceInfo>(.*?)<\/ntceInfo>/);
          const errMsgCnMatch = data.match(/<errMsgCn>(.*?)<\/errMsgCn>/);
          
          const title = ntceInfoMatch ? ntceInfoMatch[1] : '검증 실패';
          const message = errMsgCnMatch ? errMsgCnMatch[1] : '통관번호 검증에 실패했습니다.';
          
          res.json({
            success: true,
            valid: false,
            error: {
              title,
              message
            }
          });
        }
      });
    }).on('error', (error) => {
      console.error('관세청 API 호출 오류:', error);
      res.status(500).json({
        success: false,
        message: '통관번호 검증 중 오류가 발생했습니다.',
        error: error.message
      });
    });
    
  } catch (error) {
    console.error('통관번호 검증 오류:', error);
    res.status(500).json({
      success: false,
      message: '통관번호 검증 중 오류가 발생했습니다.'
    });
  }
});

// 통관번호 저장
router.post('/save-pccc', async (req, res) => {
  try {
    const { order_id, pccc } = req.body;
    
    console.log('통관번호 저장 - order_id:', order_id, 'pccc:', pccc);
    
    if (!order_id || !pccc) {
      return res.status(400).json({
        success: false,
        message: '주문번호와 통관번호는 필수입니다.'
      });
    }
    
    const pool = await getConnection();
    
    // 통관번호만 업데이트
    await pool.request()
      .input('order_id', sql.NVarChar, order_id)
      .input('pccc', sql.NVarChar, pccc)
      .query(`
        UPDATE tb_order_info
        SET PCCC = @pccc,
            pccc_date = GETDATE()
        WHERE order_id = @order_id
      `);
    
    console.log('통관번호 저장 완료 - order_id:', order_id);
    
    res.json({
      success: true,
      message: '통관번호가 저장되었습니다.'
    });
    
  } catch (error) {
    console.error('통관번호 저장 오류:', error);
    res.status(500).json({
      success: false,
      message: '통관번호 저장 중 오류가 발생했습니다.'
    });
  }
});

module.exports = router;
