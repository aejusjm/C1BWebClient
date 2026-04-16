// 마켓연동 관련 API 라우트
const express = require('express');
const router = express.Router();
const { getConnection, sql } = require('../config/database');

// 테이블 구조 확인 API (디버깅용)
router.get('/check-table-structure', async (req, res) => {
  try {
    const pool = await getConnection();
    const result = await pool.request().query(`
      SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'tb_user_market_ss'
      ORDER BY ORDINAL_POSITION
    `);
    
    res.json({
      success: true,
      columns: result.recordset
    });
  } catch (error) {
    console.error('테이블 구조 확인 오류:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 스마트스토어 목록 조회 API
router.get('/smartstore/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const pool = await getConnection();
    const result = await pool.request()
      .input('userId', sql.NVarChar, userId)
      .query(`
        SELECT 
          biz_idx, 
          store_name,
          account_id,
          user_pwd,
          store_id,
          client_id, 
          client_secret_sign, 
          [use_yn]
        FROM tb_user_market_ss
        WHERE user_id = @userId
        ORDER BY biz_idx
      `);
    
    res.json({
      success: true,
      data: result.recordset
    });
  } catch (error) {
    console.error('스마트스토어 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '스마트스토어 정보 조회 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 쿠팡 목록 조회 API
router.get('/coupang/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const pool = await getConnection();
    const result = await pool.request()
      .input('userId', sql.NVarChar, userId)
      .query(`
        SELECT 
          biz_idx, store_name, accountId, user_pwd, vendorId,
          accessKey, secretKey, [use_yn]
        FROM tb_user_market_cp
        WHERE user_id = @userId
        ORDER BY biz_idx
      `);
    
    res.json({
      success: true,
      data: result.recordset
    });
  } catch (error) {
    console.error('쿠팡 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '쿠팡 정보 조회 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 스마트스토어 저장 API (INSERT or UPDATE)
router.post('/smartstore/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { biz_idx, store_name, account_id, user_pwd, store_id, client_id, client_secret_sign, use_yn } = req.body;
    
    console.log('스마트스토어 저장 요청:', { userId, biz_idx, store_name, account_id, client_id, use_yn });
    
    const pool = await getConnection();
    
    // 기존 데이터 확인
    const checkResult = await pool.request()
      .input('userId', sql.NVarChar, userId)
      .input('bizIdx', sql.Int, biz_idx)
      .query('SELECT biz_idx FROM tb_user_market_ss WHERE user_id = @userId AND biz_idx = @bizIdx');
    
    if (checkResult.recordset.length > 0) {
      // UPDATE
      await pool.request()
        .input('userId', sql.NVarChar, userId)
        .input('bizIdx', sql.Int, biz_idx)
        .input('storeName', sql.NVarChar, store_name)
        .input('accountId', sql.NVarChar, account_id)
        .input('storeId', sql.NVarChar, store_id)
        .input('userPwd', sql.NVarChar, user_pwd)
        .input('clientId', sql.NVarChar, client_id)
        .input('clientSecretSign', sql.NVarChar, client_secret_sign)
        .input('useYn', sql.NVarChar, use_yn)
        .query(`
          UPDATE tb_user_market_ss
          SET 
            store_name = @storeName,
            account_id = @accountId,
            user_pwd = @userPwd,
            store_id = @storeId,
            client_id = @clientId,
            client_secret_sign = @clientSecretSign,
            [use_yn] = @useYn
          WHERE user_id = @userId AND biz_idx = @bizIdx
        `);
    } else {
      // INSERT
      await pool.request()
        .input('userId', sql.NVarChar, userId)
        .input('bizIdx', sql.Int, biz_idx)
        .input('storeName', sql.NVarChar, store_name)
        .input('accountId', sql.NVarChar, account_id)
        .input('storeId', sql.NVarChar, store_id)
        .input('userPwd', sql.NVarChar, user_pwd)
        .input('clientId', sql.NVarChar, client_id)
        .input('clientSecretSign', sql.NVarChar, client_secret_sign)
        .input('useYn', sql.NVarChar, use_yn)
        .query(`
          INSERT INTO tb_user_market_ss 
            (user_id, biz_idx, store_name, account_id, user_pwd, store_id, client_id, client_secret_sign, [use_yn])
          VALUES 
            (@userId, @bizIdx, @storeName, @accountId, @userPwd, @storeId, @clientId, @clientSecretSign, @useYn)
        `);
    }
    
    res.json({
      success: true,
      message: '스마트스토어 정보가 저장되었습니다.'
    });
  } catch (error) {
    console.error('스마트스토어 저장 오류:', error);
    res.status(500).json({
      success: false,
      message: '스마트스토어 정보 저장 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 쿠팡 저장 API (INSERT or UPDATE)
router.post('/coupang/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { biz_idx, store_name, accountId, user_pwd, vendorId, accessKey, secretKey, use_yn } = req.body;
    
    const pool = await getConnection();
    
    // 기존 데이터 확인
    const checkResult = await pool.request()
      .input('userId', sql.NVarChar, userId)
      .input('bizIdx', sql.Int, biz_idx)
      .query('SELECT biz_idx FROM tb_user_market_cp WHERE user_id = @userId AND biz_idx = @bizIdx');
    
    if (checkResult.recordset.length > 0) {
      // UPDATE
      await pool.request()
        .input('userId', sql.NVarChar, userId)
        .input('bizIdx', sql.Int, biz_idx)
        .input('storeName', sql.NVarChar, store_name)
        .input('accountId', sql.NVarChar, accountId)
        .input('userPwd', sql.NVarChar, user_pwd)
        .input('vendorId', sql.NVarChar, vendorId)
        .input('accessKey', sql.NVarChar, accessKey)
        .input('secretKey', sql.NVarChar, secretKey)
        .input('useYn', sql.NVarChar, use_yn)
        .query(`
          UPDATE tb_user_market_cp
          SET 
            store_name = @storeName,
            accountId = @accountId,
            user_pwd = @userPwd,
            vendorId = @vendorId,
            accessKey = @accessKey,
            secretKey = @secretKey,
            [use_yn] = @useYn
          WHERE user_id = @userId AND biz_idx = @bizIdx
        `);
    } else {
      // INSERT
      await pool.request()
        .input('userId', sql.NVarChar, userId)
        .input('bizIdx', sql.Int, biz_idx)
        .input('storeName', sql.NVarChar, store_name)
        .input('accountId', sql.NVarChar, accountId)
        .input('userPwd', sql.NVarChar, user_pwd)
        .input('vendorId', sql.NVarChar, vendorId)
        .input('accessKey', sql.NVarChar, accessKey)
        .input('secretKey', sql.NVarChar, secretKey)
        .input('useYn', sql.NVarChar, use_yn)
        .query(`
          INSERT INTO tb_user_market_cp 
            (user_id, biz_idx, store_name, accountId, user_pwd, vendorId, accessKey, secretKey, [use_yn])
          VALUES 
            (@userId, @bizIdx, @storeName, @accountId, @userPwd, @vendorId, @accessKey, @secretKey, @useYn)
        `);
    }
    
    res.json({
      success: true,
      message: '쿠팡 정보가 저장되었습니다.'
    });
  } catch (error) {
    console.error('쿠팡 저장 오류:', error);
    res.status(500).json({
      success: false,
      message: '쿠팡 정보 저장 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

module.exports = router;
