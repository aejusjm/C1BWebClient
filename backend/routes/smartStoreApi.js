// 스마트스토어 API 유틸/연동 테스트 라우터
const express = require('express');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const FormData = require('form-data');
require('dotenv').config();

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

const SMARTSTORE_API_BASE = 'https://api.commerce.naver.com';

function buildAuthQuery(clientId, clientSecret) {
  if (
    typeof clientSecret !== 'string' ||
    !/^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{22,}/.test(clientSecret)
  ) {
    const err = new Error('INVALID_CLIENT_SECRET_FORMAT');
    err.code = 'INVALID_CLIENT_SECRET_FORMAT';
    throw err;
  }

  const timestamp = Date.now() - 30000; // C# 코드와 동일: UTC now - 30초
  const hashed = bcrypt.hashSync(`${clientId}_${timestamp}`, clientSecret);
  const clientSecretSign = Buffer.from(hashed, 'utf8').toString('base64');

  const query = new URLSearchParams({
    client_id: clientId,
    timestamp: String(timestamp),
    client_secret_sign: clientSecretSign,
    grant_type: 'client_credentials',
    type: 'SELF'
  });

  return `?${query.toString()}`;
}

// 스마트스토어 토큰 발급 테스트
router.post('/token-test', async (req, res) => {
  try {
    const { marketAccount, clientId, clientSecret } = req.body;

    if (!marketAccount || !clientId || !clientSecret) {
      return res.status(400).json({
        success: false,
        message: 'marketAccount, clientId, clientSecret은 필수입니다.'
      });
    }

    const authQuery = buildAuthQuery(clientId, clientSecret);
    const response = await fetch(`${SMARTSTORE_API_BASE}/external/v1/oauth2/token${authQuery}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    const raw = await response.text();
    let parsed = null;
    try {
      parsed = raw ? JSON.parse(raw) : null;
    } catch (_) {
      parsed = null;
    }

    // C# 로직과 동일: 200 아니면 API 정보 확인 안내
    if (response.status !== 200) {
      const invalidInputMessage =
        parsed && Array.isArray(parsed.invalidInputs) && parsed.invalidInputs.length > 0
          ? parsed.invalidInputs[0].message
          : null;
      const apiMessage = (parsed && parsed.message) || invalidInputMessage || null;

      return res.status(400).json({
        success: false,
        message: apiMessage || `[스마트스토어 : ${marketAccount}] API 정보를 다시 확인해주세요.`,
        statusCode: response.status,
        details: parsed || raw
      });
    }

    // C# 로직과 동일: message가 있으면 실패 응답 처리
    if (parsed && parsed.message) {
      const invalidInputMessage =
        Array.isArray(parsed.invalidInputs) && parsed.invalidInputs.length > 0
          ? parsed.invalidInputs[0].message
          : null;

      return res.status(400).json({
        success: false,
        message: invalidInputMessage || parsed.message
      });
    }

    if (!parsed || !parsed.access_token) {
      return res.status(400).json({
        success: false,
        message: '토큰 발급 응답이 올바르지 않습니다.'
      });
    }

    return res.json({
      success: true,
      message: '스마트스토어 연동 테스트 성공',
      expires_in: parsed.expires_in
    });
  } catch (error) {
    if (error.code === 'INVALID_CLIENT_SECRET_FORMAT') {
      return res.status(400).json({
        success: false,
        message: 'APP 시크릿 형식이 올바르지 않습니다. 스마트스토어에서 발급된 client_secret 값을 입력해주세요.'
      });
    }

    console.error('스마트스토어 토큰 테스트 오류:', error);
    return res.status(500).json({
      success: false,
      message: '스마트스토어 연동 테스트 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

/**
 * 스마트스토어 토큰 발급
 */
async function getSmartStoreToken() {
  const marketAccount = process.env.SMARTSTORE_MARKET_ACCOUNT;
  const clientId = process.env.SMARTSTORE_CLIENT_ID;
  const clientSecret = process.env.SMARTSTORE_CLIENT_SECRET;

  const authQuery = buildAuthQuery(clientId, clientSecret);
  const response = await fetch(`${SMARTSTORE_API_BASE}/external/v1/oauth2/token${authQuery}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    }
  });

  const result = await response.json();
  
  if (result.access_token) {
    return result.access_token;
  }
  
  throw new Error(result.error || '토큰 발급 실패');
}

/**
 * 스마트스토어 이미지 업로드
 */
router.post('/upload-images', upload.fields([
  { name: 'topImage', maxCount: 1 },
  { name: 'bottomImage', maxCount: 1 }
]), async (req, res) => {
  try {
    const files = req.files;
    
    if (!files || (!files.topImage && !files.bottomImage)) {
      return res.status(400).json({
        success: false,
        message: '업로드할 이미지가 없습니다.'
      });
    }

    // 토큰 발급
    const accessToken = await getSmartStoreToken();

    const uploadedUrls = {
      topImageUrl: null,
      bottomImageUrl: null
    };

    // 상단 이미지 업로드
    if (files.topImage && files.topImage[0]) {
      const topFile = files.topImage[0];
      const formData = new FormData();
      
      // 파일명 확장자 처리
      let fileName = topFile.originalname;
      const mimeType = topFile.mimetype;
      
      if (mimeType === 'image/png') {
        fileName = fileName.replace(/\.(jpg|jpeg)$/i, '.png');
      } else if (mimeType === 'image/jpeg') {
        fileName = fileName.replace(/\.png$/i, '.jpg');
      }
      
      formData.append('imageFiles[0]', topFile.buffer, {
        filename: fileName,
        contentType: mimeType
      });

      const uploadResponse = await fetch(`${SMARTSTORE_API_BASE}/v1/product-images/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          ...formData.getHeaders()
        },
        body: formData
      });

      const uploadResult = await uploadResponse.json();
      
      if (uploadResult.images && uploadResult.images.length > 0) {
        uploadedUrls.topImageUrl = uploadResult.images[0].url;
      }
    }

    // 하단 이미지 업로드
    if (files.bottomImage && files.bottomImage[0]) {
      const bottomFile = files.bottomImage[0];
      const formData = new FormData();
      
      // 파일명 확장자 처리
      let fileName = bottomFile.originalname;
      const mimeType = bottomFile.mimetype;
      
      if (mimeType === 'image/png') {
        fileName = fileName.replace(/\.(jpg|jpeg)$/i, '.png');
      } else if (mimeType === 'image/jpeg') {
        fileName = fileName.replace(/\.png$/i, '.jpg');
      }
      
      formData.append('imageFiles[0]', bottomFile.buffer, {
        filename: fileName,
        contentType: mimeType
      });

      const uploadResponse = await fetch(`${SMARTSTORE_API_BASE}/v1/product-images/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          ...formData.getHeaders()
        },
        body: formData
      });

      const uploadResult = await uploadResponse.json();
      
      if (uploadResult.images && uploadResult.images.length > 0) {
        uploadedUrls.bottomImageUrl = uploadResult.images[0].url;
      }
    }

    res.json({
      success: true,
      message: '이미지 업로드 성공',
      data: uploadedUrls
    });

  } catch (error) {
    console.error('스마트스토어 이미지 업로드 오류:', error);
    res.status(500).json({
      success: false,
      message: '이미지 업로드 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

module.exports = router;
