// 스마트스토어 API 유틸/연동 테스트 라우터
const express = require('express');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const FormData = require('form-data');
require('dotenv').config();

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

const SMARTSTORE_API_BASE = 'https://api.commerce.naver.com';

function formatInvalidInputs(invalidInputs) {
  if (!Array.isArray(invalidInputs) || invalidInputs.length === 0) return null;
  return invalidInputs
    .map((item) => {
      if (!item) return null;
      if (typeof item === 'string') return item;
      const name = item.name || item.field || item.param || '';
      const msg = item.message || item.reason || JSON.stringify(item);
      return name ? `${name}: ${msg}` : msg;
    })
    .filter(Boolean)
    .join('\n');
}

/**
 * 네이버 커머스 API 토큰 발급용 전자서명/파라미터 생성
 * - type=SELF: account_id 포함하면 안 됨
 * - type=SELLER: account_id(스토어 계정) 필수
 */
function buildTokenForm({ clientId, clientSecret, type = 'SELF', accountId = null }) {
  if (
    typeof clientSecret !== 'string' ||
    !/^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{22,}/.test(clientSecret)
  ) {
    const err = new Error('INVALID_CLIENT_SECRET_FORMAT');
    err.code = 'INVALID_CLIENT_SECRET_FORMAT';
    throw err;
  }

  const timestamp = Date.now() - 30000; // 시계 오차 대비: now - 30초
  const hashed = bcrypt.hashSync(`${clientId}_${timestamp}`, clientSecret);
  const clientSecretSign = Buffer.from(hashed, 'utf8').toString('base64');

  const form = new URLSearchParams({
    client_id: clientId,
    timestamp: String(timestamp),
    client_secret_sign: clientSecretSign,
    grant_type: 'client_credentials',
    type
  });

  if (type === 'SELLER') {
    if (!accountId) {
      const err = new Error('SELLER_ACCOUNT_ID_REQUIRED');
      err.code = 'SELLER_ACCOUNT_ID_REQUIRED';
      throw err;
    }
    form.set('account_id', accountId);
  }

  return form;
}

async function requestSmartStoreToken(form) {
  // 규격 강화: 파라미터는 query가 아니라 x-www-form-urlencoded body 로 전달해야 함
  const response = await fetch(`${SMARTSTORE_API_BASE}/external/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: form.toString()
  });

  const raw = await response.text();
  let parsed = null;
  try {
    parsed = raw ? JSON.parse(raw) : null;
  } catch (_) {
    parsed = null;
  }

  return { response, raw, parsed };
}

// 스마트스토어 토큰 발급 테스트
router.post('/token-test', async (req, res) => {
  try {
    const marketAccount = String(req.body?.marketAccount || '').trim();
    const clientId = String(req.body?.clientId || '').trim();
    const clientSecret = String(req.body?.clientSecret || '').trim();
    const requestedType = String(req.body?.type || 'SELF').trim().toUpperCase();
    const authType = requestedType === 'SELLER' ? 'SELLER' : 'SELF';

    if (!clientId || !clientSecret) {
      return res.status(400).json({
        success: false,
        message: 'APP ID, APP 시크릿은 필수입니다.'
      });
    }
    if (authType === 'SELLER' && !marketAccount) {
      return res.status(400).json({
        success: false,
        message: 'SELLER 타입 연동 시 스마트스토어 아이디(account_id)가 필요합니다.'
      });
    }

    const form = buildTokenForm({
      clientId,
      clientSecret,
      type: authType,
      accountId: marketAccount || null
    });
    const { response, raw, parsed } = await requestSmartStoreToken(form);

    if (response.status !== 200) {
      const invalidInputMessage = formatInvalidInputs(parsed?.invalidInputs);
      const apiMessage = invalidInputMessage || parsed?.message || null;

      return res.status(400).json({
        success: false,
        message:
          apiMessage ||
          `[스마트스토어 : ${marketAccount || clientId}] API 정보를 다시 확인해주세요.`,
        statusCode: response.status,
        details: parsed || raw
      });
    }

    if (parsed && parsed.message && !parsed.access_token) {
      const invalidInputMessage = formatInvalidInputs(parsed.invalidInputs);
      return res.status(400).json({
        success: false,
        message: invalidInputMessage || parsed.message,
        details: parsed
      });
    }

    if (!parsed || !parsed.access_token) {
      return res.status(400).json({
        success: false,
        message: '토큰 발급 응답이 올바르지 않습니다.',
        details: parsed || raw
      });
    }

    return res.json({
      success: true,
      message: '스마트스토어 연동 테스트 성공',
      expires_in: parsed.expires_in,
      type: authType
    });
  } catch (error) {
    if (error.code === 'INVALID_CLIENT_SECRET_FORMAT') {
      return res.status(400).json({
        success: false,
        message: 'APP 시크릿 형식이 올바르지 않습니다. 스마트스토어에서 발급된 client_secret 값을 입력해주세요.'
      });
    }
    if (error.code === 'SELLER_ACCOUNT_ID_REQUIRED') {
      return res.status(400).json({
        success: false,
        message: 'SELLER 타입 연동 시 스마트스토어 아이디가 필요합니다.'
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
  const clientId = process.env.SMARTSTORE_CLIENT_ID;
  const clientSecret = process.env.SMARTSTORE_CLIENT_SECRET;

  const form = buildTokenForm({
    clientId,
    clientSecret,
    type: 'SELF'
  });
  const { response, raw, parsed } = await requestSmartStoreToken(form);

  if (parsed?.access_token) {
    return parsed.access_token;
  }

  throw new Error(parsed?.message || parsed?.error || raw || `토큰 발급 실패 (HTTP ${response.status})`);
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
