// 인증 관련 API 라우트
const express = require('express');
const router = express.Router();
const { getConnection, sql } = require('../config/database');

// 로그인 API - 비밀번호 검증을 서버에서 수행
router.post('/login', async (req, res) => {
  try {
    const { userId, password } = req.body;

    console.log('🔐 로그인 시도 - userId:', userId);

    if (!userId || !password) {
      return res.status(400).json({
        success: false,
        message: '아이디와 비밀번호를 입력해주세요.'
      });
    }

    const pool = await getConnection();
    const result = await pool.request()
      .input('userId', sql.NVarChar, userId)
      .query(`
        SELECT 
          user_id, user_pwd, user_name, start_date, end_date, user_type,
          margin_rate, user_phone, user_email, use_yn
        FROM tb_user
        WHERE user_id = @userId
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: '존재하지 않는 사용자입니다.'
      });
    }

    const user = result.recordset[0];

    // 비밀번호 확인
    if (user.user_pwd !== password) {
      return res.status(401).json({
        success: false,
        message: '비밀번호가 일치하지 않습니다.'
      });
    }

    // 사용 여부 확인
    if (user.use_yn !== 'Y') {
      return res.status(403).json({
        success: false,
        message: '사용이 중지된 계정입니다.'
      });
    }

    // 비밀번호 제외하고 사용자 정보 반환
    const { user_pwd, ...userWithoutPassword } = user;

    console.log('✅ 로그인 성공 - userId:', userId);

    res.json({
      success: true,
      data: userWithoutPassword,
      message: '로그인 성공'
    });
  } catch (error) {
    console.error('로그인 오류:', error);
    res.status(500).json({
      success: false,
      message: '로그인 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

module.exports = router;
