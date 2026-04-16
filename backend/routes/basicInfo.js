// 기본정보 관련 API 라우트
const express = require('express');
const router = express.Router();
const { getConnection, sql } = require('../config/database');

// 상세페이지 이미지 목록 조회 API
router.get('/detail-images', async (req, res) => {
  try {
    const pool = await getConnection();
    const result = await pool.request()
      .query(`
        SELECT seq, img_type, img_url
        FROM tb_detail_page
        ORDER BY img_type, seq
      `);
    
    res.json({
      success: true,
      data: result.recordset
    });
  } catch (error) {
    console.error('상세페이지 이미지 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '이미지 조회 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 사용자 이미지 seq 조회 API (tb_user_detail)
router.get('/user-images/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    console.log('사용자 이미지 조회 요청 - userId:', userId);
    
    const pool = await getConnection();
    const result = await pool.request()
      .input('userId', sql.NVarChar, userId)
      .query(`
        SELECT top_img, bottom_img
        FROM tb_user_detail
        WHERE user_id = @userId
      `);
    
    console.log('DB 조회 결과:', result.recordset);
    
    if (result.recordset.length === 0) {
      console.log('저장된 이미지 없음 - null 반환');
      return res.json({
        success: true,
        data: {
          top_img: null,
          bottom_img: null
        }
      });
    }
    
    const userData = result.recordset[0];
    console.log('저장된 이미지 seq:', userData);
    
    // 정수형으로 변환하여 반환
    res.json({
      success: true,
      data: {
        top_img: userData.top_img ? parseInt(userData.top_img) : null,
        bottom_img: userData.bottom_img ? parseInt(userData.bottom_img) : null
      }
    });
  } catch (error) {
    console.error('사용자 이미지 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '사용자 이미지 조회 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 사용자 이미지 seq 저장 API (tb_user_detail - INSERT or UPDATE)
router.put('/user-images/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { top_img, bottom_img } = req.body;
    
    const pool = await getConnection();
    
    // 기존 데이터 확인
    const checkResult = await pool.request()
      .input('userId', sql.NVarChar, userId)
      .query(`
        SELECT COUNT(*) as count
        FROM tb_user_detail
        WHERE user_id = @userId
      `);
    
    const exists = checkResult.recordset[0].count > 0;
    
    if (exists) {
      // UPDATE
      await pool.request()
        .input('userId', sql.NVarChar, userId)
        .input('topImg', sql.Int, top_img)
        .input('bottomImg', sql.Int, bottom_img)
        .query(`
          UPDATE tb_user_detail
          SET 
            top_img = @topImg,
            bottom_img = @bottomImg
          WHERE user_id = @userId
        `);
    } else {
      // INSERT
      await pool.request()
        .input('userId', sql.NVarChar, userId)
        .input('topImg', sql.Int, top_img)
        .input('bottomImg', sql.Int, bottom_img)
        .query(`
          INSERT INTO tb_user_detail (user_id, top_img, bottom_img)
          VALUES (@userId, @topImg, @bottomImg)
        `);
    }
    
    res.json({
      success: true,
      message: '이미지가 저장되었습니다.'
    });
  } catch (error) {
    console.error('사용자 이미지 저장 오류:', error);
    res.status(500).json({
      success: false,
      message: '이미지 저장 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

module.exports = router;
