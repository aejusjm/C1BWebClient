// 사용자 상세 이미지 관리 라우터
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const https = require('https');
const FormData = require('form-data');
const bcrypt = require('bcryptjs');
const { getConnection, sql } = require('../config/database');
require('dotenv').config();

const router = express.Router();

const SMARTSTORE_API_BASE = 'https://api.commerce.naver.com';

// 업로드 디렉토리 설정
const UPLOAD_DIR = path.join(__dirname, '../uploads/detail-pages/user_detail_imgs');

// 디렉토리가 없으면 생성
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// multer 설정 (메모리 스토리지 사용)
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('JPG, PNG 파일만 업로드 가능합니다.'));
    }
  }
});

/**
 * 사용자 상세 이미지 조회
 */
router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const pool = await getConnection();
    
    const result = await pool.request()
      .input('user_id', sql.NVarChar, userId)
      .query(`
        SELECT top_img_url, bottom_img_url
        FROM tb_user_detail
        WHERE user_id = @user_id
      `);
    
    if (result.recordset.length > 0) {
      res.json({
        success: true,
        data: result.recordset[0]
      });
    } else {
      res.json({
        success: true,
        data: {
          top_img_url: null,
          bottom_img_url: null
        }
      });
    }
  } catch (error) {
    console.error('상세 이미지 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '상세 이미지 조회 중 오류가 발생했습니다.'
    });
  }
});

/**
 * 스마트스토어 토큰 발급
 */
async function getSmartStoreToken() {
  const clientId = process.env.SMARTSTORE_CLIENT_ID;
  const clientSecret = process.env.SMARTSTORE_CLIENT_SECRET;

  console.log('토큰 발급 시도 - clientId:', clientId);

  const timestamp = Date.now() - 30000;
  const hashed = bcrypt.hashSync(`${clientId}_${timestamp}`, clientSecret);
  const clientSecretSign = Buffer.from(hashed, 'utf8').toString('base64');

  const query = new URLSearchParams({
    client_id: clientId,
    timestamp: String(timestamp),
    client_secret_sign: clientSecretSign,
    grant_type: 'client_credentials',
    type: 'SELF'
  });

  const url = `${SMARTSTORE_API_BASE}/external/v1/oauth2/token?${query.toString()}`;
  console.log('토큰 발급 URL:', url);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    }
  });

  const responseText = await response.text();
  console.log('토큰 발급 응답 상태:', response.status);
  console.log('토큰 발급 응답:', responseText.substring(0, 500));

  let result;
  try {
    result = JSON.parse(responseText);
  } catch (e) {
    throw new Error(`토큰 발급 응답 파싱 실패: ${responseText.substring(0, 200)}`);
  }
  
  if (result.access_token) {
    console.log('토큰 발급 성공');
    return result.access_token;
  }
  
  throw new Error(`토큰 발급 실패: ${JSON.stringify(result)}`);
}

/**
 * 스마트스토어 이미지 업로드
 * API 문서: https://apicenter.commerce.naver.com/docs/commerce-api/current/upload-product
 * 정확한 엔드포인트: /external/v1/product-images/upload
 */
async function uploadToSmartStore(fileBuffer, originalName, mimeType, accessToken, tempFilePath) {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    
    // 파일명과 MIME 타입 처리
    const timestamp = Date.now();
    const ext = path.extname(originalName).toLowerCase();
    let safeFileName = `product_image_${timestamp}`;
    let actualMimeType = mimeType;
    
    // MIME 타입에 따라 확장자 설정
    if (mimeType === 'image/png' || ext === '.png') {
      safeFileName += '.png';
      actualMimeType = 'image/png';
      // 파일명도 .png로 변경
      if (!safeFileName.endsWith('.png')) {
        safeFileName = safeFileName.replace(/\.(jpg|jpeg)$/i, '.png');
      }
    } else if (mimeType === 'image/jpeg' || ext === '.jpg' || ext === '.jpeg') {
      safeFileName += '.jpg';
      actualMimeType = 'image/jpeg';
      // 파일명도 .jpg로 변경
      if (!safeFileName.endsWith('.jpg')) {
        safeFileName = safeFileName.replace(/\.png$/i, '.jpg');
      }
    } else {
      safeFileName += ext || '.jpg';
    }
    
    console.log('업로드 파일 정보:', { 
      originalName, 
      safeFileName, 
      mimeType: actualMimeType, 
      size: fileBuffer.length,
      tempFilePath
    });
    
    // 임시 파일에서 스트림 생성 (C# 코드와 동일한 방식)
    formData.append('imageFiles', fs.createReadStream(tempFilePath), {
      filename: safeFileName,
      contentType: actualMimeType
    });

    // 정확한 엔드포인트 사용
    const imageUploadUrl = 'https://api.commerce.naver.com/external/v1/product-images/upload';
    console.log('이미지 업로드 URL:', imageUploadUrl);
    
    const https = require('https');
    const urlObj = new URL(imageUploadUrl);
    
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || 443,
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: {
        ...formData.getHeaders(),
        'Authorization': `Bearer ${accessToken}`
      }
    };

    const request = https.request(options, (response) => {
      let data = '';

      response.on('data', (chunk) => {
        data += chunk;
      });

      response.on('end', () => {
        console.log('스마트스토어 이미지 업로드 응답 상태:', response.statusCode);
        console.log('스마트스토어 이미지 업로드 응답:', data.substring(0, 500));
        
        try {
          const uploadResult = JSON.parse(data);
          
          // 성공 응답 확인: { "images": [{ "url": "string" }] }
          if (uploadResult.images && Array.isArray(uploadResult.images) && uploadResult.images.length > 0) {
            const imageUrl = uploadResult.images[0].url;
            if (imageUrl) {
              console.log('✓ 이미지 업로드 성공:', imageUrl);
              resolve(imageUrl);
              return;
            }
          }
          
          // 실패 시 에러 메시지 확인
          const errorMsg = uploadResult.message || uploadResult.error || JSON.stringify(uploadResult);
          reject(new Error(`이미지 업로드 실패: ${errorMsg}`));
        } catch (e) {
          reject(new Error(`API 응답 파싱 실패 (${response.statusCode}): ${data.substring(0, 200)}`));
        }
      });
    });

    request.on('error', (error) => {
      console.error('HTTP 요청 오류:', error);
      reject(error);
    });

    formData.pipe(request);
  });
}

/**
 * 사용자 상세 이미지 저장
 */
router.post('/:userId', upload.fields([
  { name: 'topImage', maxCount: 1 },
  { name: 'bottomImage', maxCount: 1 }
]), async (req, res) => {
  try {
    const { userId } = req.params;
    const files = req.files;
    
    let topImgUrl = null;
    let bottomImgUrl = null;
    let topSmartstoreUrl = null;
    let bottomSmartstoreUrl = null;
    
    // 스마트스토어 토큰 발급
    const accessToken = await getSmartStoreToken();
    
    // 상단 이미지 저장
    if (files.topImage && files.topImage[0]) {
      const topFile = files.topImage[0];
      const ext = path.extname(topFile.originalname);
      const filename = `${userId}_top${ext}`;
      const filepath = path.join(UPLOAD_DIR, filename);
      
      // 로컬 저장
      fs.writeFileSync(filepath, topFile.buffer);
      topImgUrl = `/uploads/detail-pages/user_detail_imgs/${filename}`;
      
      // 스마트스토어 업로드 (로컬 파일 경로 전달)
      try {
        topSmartstoreUrl = await uploadToSmartStore(topFile.buffer, topFile.originalname, topFile.mimetype, accessToken, filepath);
      } catch (error) {
        console.error('상단 이미지 스마트스토어 업로드 실패:', error);
      }
    }
    
    // 하단 이미지 저장
    if (files.bottomImage && files.bottomImage[0]) {
      const bottomFile = files.bottomImage[0];
      const ext = path.extname(bottomFile.originalname);
      const filename = `${userId}_bottom${ext}`;
      const filepath = path.join(UPLOAD_DIR, filename);
      
      // 로컬 저장
      fs.writeFileSync(filepath, bottomFile.buffer);
      bottomImgUrl = `/uploads/detail-pages/user_detail_imgs/${filename}`;
      
      // 스마트스토어 업로드 (로컬 파일 경로 전달)
      try {
        bottomSmartstoreUrl = await uploadToSmartStore(bottomFile.buffer, bottomFile.originalname, bottomFile.mimetype, accessToken, filepath);
      } catch (error) {
        console.error('하단 이미지 스마트스토어 업로드 실패:', error);
      }
    }
    
    // DB 업데이트
    const pool = await getConnection();
    
    // 기존 레코드 확인
    const checkResult = await pool.request()
      .input('user_id', sql.NVarChar, userId)
      .query(`
        SELECT COUNT(*) as cnt
        FROM tb_user_detail
        WHERE user_id = @user_id
      `);
    
    const exists = checkResult.recordset[0].cnt > 0;
    
    if (exists) {
      // UPDATE
      let updateQuery = 'UPDATE tb_user_detail SET ';
      const updateFields = [];
      const request = pool.request().input('user_id', sql.NVarChar, userId);
      
      if (topImgUrl) {
        updateFields.push('top_img_url = @top_img_url');
        request.input('top_img_url', sql.NVarChar, topImgUrl);
      }
      
      if (bottomImgUrl) {
        updateFields.push('bottom_img_url = @bottom_img_url');
        request.input('bottom_img_url', sql.NVarChar, bottomImgUrl);
      }
      
      if (topSmartstoreUrl) {
        updateFields.push('top_smartstore_url = @top_smartstore_url');
        request.input('top_smartstore_url', sql.NVarChar, topSmartstoreUrl);
      }
      
      if (bottomSmartstoreUrl) {
        updateFields.push('bottom_smartstore_url = @bottom_smartstore_url');
        request.input('bottom_smartstore_url', sql.NVarChar, bottomSmartstoreUrl);
      }
      
      if (updateFields.length > 0) {
        updateQuery += updateFields.join(', ') + ' WHERE user_id = @user_id';
        await request.query(updateQuery);
      }
    } else {
      // INSERT
      await pool.request()
        .input('user_id', sql.NVarChar, userId)
        .input('top_img_url', sql.NVarChar, topImgUrl || '')
        .input('bottom_img_url', sql.NVarChar, bottomImgUrl || '')
        .input('top_smartstore_url', sql.NVarChar, topSmartstoreUrl || '')
        .input('bottom_smartstore_url', sql.NVarChar, bottomSmartstoreUrl || '')
        .query(`
          INSERT INTO tb_user_detail (user_id, top_img_url, bottom_img_url, top_smartstore_url, bottom_smartstore_url)
          VALUES (@user_id, @top_img_url, @bottom_img_url, @top_smartstore_url, @bottom_smartstore_url)
        `);
    }
    
    res.json({
      success: true,
      message: '상세 이미지가 저장되었습니다.',
      data: {
        top_img_url: topImgUrl,
        bottom_img_url: bottomImgUrl,
        top_smartstore_url: topSmartstoreUrl,
        bottom_smartstore_url: bottomSmartstoreUrl
      }
    });
  } catch (error) {
    console.error('상세 이미지 저장 오류:', error);
    res.status(500).json({
      success: false,
      message: '상세 이미지 저장 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

module.exports = router;
