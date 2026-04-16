// 사용자관리 관련 API 라우트
const express = require('express');
const router = express.Router();
const { getConnection, sql } = require('../config/database');

// 서버 목록 조회 API
router.get('/servers', async (req, res) => {
  try {
    const pool = await getConnection();
    const result = await pool.request()
      .query(`
        SELECT server_id, server_name
        FROM tb_server_info
        ORDER BY server_id
      `);
    
    res.json({
      success: true,
      data: result.recordset
    });
  } catch (error) {
    console.error('서버 목록 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '서버 목록 조회 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 사용자 목록 조회 API (검색 기능 포함)
router.get('/', async (req, res) => {
  try {
    const { userName, userPhone } = req.query;
    
    const pool = await getConnection();
    const columnCheckResult = await pool.request().query(`
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'tb_user'
        AND COLUMN_NAME IN ('dispatch_Location', 'dispatch_location', 'rturn_location', 'return_location')
    `);
    const columnNames = new Set(columnCheckResult.recordset.map(row => row.COLUMN_NAME));
    const dispatchColumn = columnNames.has('dispatch_Location')
      ? 'dispatch_Location'
      : columnNames.has('dispatch_location')
        ? 'dispatch_location'
        : null;
    const returnColumn = columnNames.has('rturn_location')
      ? 'rturn_location'
      : columnNames.has('return_location')
        ? 'return_location'
        : null;
    const dispatchSelect = dispatchColumn
      ? `${dispatchColumn} AS dispatch_Location`
      : `CAST('' AS NVARCHAR(500)) AS dispatch_Location`;
    const rturnSelect = returnColumn
      ? `${returnColumn} AS rturn_location`
      : `CAST('' AS NVARCHAR(500)) AS rturn_location`;

    let query = `
      SELECT 
        user_id, user_pwd, user_name, start_date, end_date, user_type,
        margin_rate, user_phone, user_email, input_date, server_id,
        last_proc_date, proc_ord, batch_date, last_delete_date, use_yn,
        reupload_target_yn, get_cnt, del_cnt, del_days, sale_keep_days,
        cs_phone, cs_phone_apply, biz_hours, upload_stop, ${dispatchSelect}, ${rturnSelect}
      FROM tb_user
      WHERE 1=1
    `;
    
    const request = pool.request();
    
    // 사용자명 검색
    if (userName && userName.trim() !== '') {
      query += ` AND user_name LIKE @userName`;
      request.input('userName', sql.NVarChar, `%${userName}%`);
    }
    
    // 전화번호 검색
    if (userPhone && userPhone.trim() !== '') {
      query += ` AND user_phone LIKE @userPhone`;
      request.input('userPhone', sql.NVarChar, `%${userPhone}%`);
    }
    
    query += ` ORDER BY input_date DESC`;
    
    const result = await request.query(query);
    
    // 비밀번호 마스킹 처리 (보안)
    const sanitizedData = result.recordset.map(user => {
      return {
        ...user,
        user_pwd: user.user_pwd ? '********' : ''
      };
    });
    
    res.json({
      success: true,
      data: sanitizedData
    });
  } catch (error) {
    console.error('사용자 목록 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '사용자 목록 조회 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 특정 사용자 조회 API
router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const pool = await getConnection();
    const columnCheckResult = await pool.request().query(`
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'tb_user'
        AND COLUMN_NAME IN ('dispatch_Location', 'dispatch_location', 'rturn_location', 'return_location')
    `);
    const columnNames = new Set(columnCheckResult.recordset.map(row => row.COLUMN_NAME));
    const dispatchColumn = columnNames.has('dispatch_Location')
      ? 'dispatch_Location'
      : columnNames.has('dispatch_location')
        ? 'dispatch_location'
        : null;
    const returnColumn = columnNames.has('rturn_location')
      ? 'rturn_location'
      : columnNames.has('return_location')
        ? 'return_location'
        : null;
    const dispatchSelect = dispatchColumn
      ? `${dispatchColumn} AS dispatch_Location`
      : `CAST('' AS NVARCHAR(500)) AS dispatch_Location`;
    const rturnSelect = returnColumn
      ? `${returnColumn} AS rturn_location`
      : `CAST('' AS NVARCHAR(500)) AS rturn_location`;

    const result = await pool.request()
      .input('userId', sql.NVarChar, userId)
      .query(`
        SELECT 
          user_id, user_pwd, user_name, start_date, end_date, user_type,
          margin_rate, user_phone, user_email, input_date, server_id,
          last_proc_date, proc_ord, batch_date, last_delete_date, use_yn,
          reupload_target_yn, get_cnt, del_cnt, del_days, sale_keep_days,
          cs_phone, cs_phone_apply, biz_hours, upload_stop, ${dispatchSelect}, ${rturnSelect}
        FROM tb_user
        WHERE user_id = @userId
      `);
    
    if (result.recordset.length > 0) {
      // 비밀번호 마스킹 처리 (보안)
      const user = result.recordset[0];
      const sanitizedUser = {
        ...user,
        user_pwd: user.user_pwd ? '********' : ''
      };
      
      res.json({
        success: true,
        data: sanitizedUser
      });
    } else {
      res.status(404).json({
        success: false,
        message: '사용자를 찾을 수 없습니다.'
      });
    }
  } catch (error) {
    console.error('사용자 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '사용자 조회 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 사용자 신규 등록 API
router.post('/', async (req, res) => {
  try {
    const {
      user_id, user_pwd, user_name, start_date, end_date, user_type,
      margin_rate, user_phone, user_email, server_id,
      use_yn, reupload_target_yn, get_cnt, del_cnt, del_days, sale_keep_days, proc_ord, upload_stop
    } = req.body;
    
    // 필수 필드 검증
    if (!user_id || !user_pwd || !user_name) {
      return res.status(400).json({
        success: false,
        message: '사용자ID, 비밀번호, 사용자명은 필수 입력 항목입니다.'
      });
    }
    
    const pool = await getConnection();
    
    // 중복 ID 체크
    const checkResult = await pool.request()
      .input('userId', sql.NVarChar, user_id)
      .query('SELECT user_id FROM tb_user WHERE user_id = @userId');
    
    if (checkResult.recordset.length > 0) {
      return res.status(400).json({
        success: false,
        message: '이미 존재하는 사용자ID입니다.'
      });
    }
    
    // 사용자 등록
    await pool.request()
      .input('user_id', sql.NVarChar, user_id)
      .input('user_pwd', sql.NVarChar, user_pwd)
      .input('user_name', sql.NVarChar, user_name)
      .input('start_date', sql.DateTime, start_date || null)
      .input('end_date', sql.DateTime, end_date || null)
      .input('user_type', sql.NVarChar, user_type || '')
      .input('margin_rate', sql.Decimal(18, 2), margin_rate || 0)
      .input('user_phone', sql.NVarChar, user_phone || '')
      .input('user_email', sql.NVarChar, user_email || '')
      .input('server_id', sql.NVarChar, server_id || '')
      .input('use_yn', sql.NVarChar, use_yn || 'Y')
      .input('reupload_target_yn', sql.NVarChar, reupload_target_yn || 'N')
      .input('get_cnt', sql.Int, get_cnt || 0)
      .input('del_cnt', sql.Int, del_cnt || 0)
      .input('del_days', sql.Int, del_days || 0)
      .input('sale_keep_days', sql.Int, sale_keep_days || 0)
      .input('proc_ord', sql.Int, proc_ord || 0)
      .input('upload_stop', sql.NVarChar, upload_stop || 'N')
      .query(`
        INSERT INTO tb_user (
          user_id, user_pwd, user_name, start_date, end_date, user_type,
          margin_rate, user_phone, user_email, server_id, use_yn, reupload_target_yn,
          get_cnt, del_cnt, del_days, sale_keep_days, proc_ord, upload_stop, input_date
        ) VALUES (
          @user_id, @user_pwd, @user_name, @start_date, @end_date, @user_type,
          @margin_rate, @user_phone, @user_email, @server_id, @use_yn, @reupload_target_yn,
          @get_cnt, @del_cnt, @del_days, @sale_keep_days, @proc_ord, @upload_stop, GETDATE()
        )
      `);
    
    res.json({
      success: true,
      message: '사용자가 등록되었습니다.'
    });
  } catch (error) {
    console.error('사용자 등록 오류:', error);
    res.status(500).json({
      success: false,
      message: '사용자 등록 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 사용자 정보 수정 API
router.put('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    console.log('사용자 수정 요청 - userId:', userId);
    console.log('사용자 수정 요청 body:', req.body);
    
    const {
      user_pwd, user_name, start_date, end_date, user_type,
      margin_rate, user_phone, user_email, server_id,
      use_yn, reupload_target_yn, get_cnt, del_cnt, del_days, sale_keep_days,
      proc_ord, last_proc_date, batch_date, last_delete_date,
      cs_phone, cs_phone_apply, biz_hours, upload_stop, // 추가된 필드
      current_password // 비밀번호 변경 시 현재 비밀번호 검증용
    } = req.body;
    
    const pool = await getConnection();
    
    // 비밀번호 변경 요청인 경우 현재 비밀번호 검증
    if (current_password) {
      const checkResult = await pool.request()
        .input('userId', sql.NVarChar, userId)
        .query('SELECT user_pwd FROM tb_user WHERE user_id = @userId');
      
      if (checkResult.recordset.length === 0) {
        return res.status(404).json({
          success: false,
          message: '사용자를 찾을 수 없습니다.'
        });
      }
      
      const dbPassword = checkResult.recordset[0].user_pwd;
      if (dbPassword !== current_password) {
        return res.status(400).json({
          success: false,
          message: '현재 비밀번호가 일치하지 않습니다.'
        });
      }
    }
    
    // 비밀번호가 마스킹된 값(******** 또는 빈 문자열)인 경우 비밀번호 제외하고 업데이트
    const isMaskedPassword = !user_pwd || user_pwd === '********' || user_pwd.trim() === '';
    
    let updateQuery;
    let request = pool.request()
      .input('userId', sql.NVarChar, userId)
      .input('user_name', sql.NVarChar, user_name)
      .input('start_date', sql.DateTime, start_date || null)
      .input('end_date', sql.DateTime, end_date || null)
      .input('user_type', sql.NVarChar, user_type)
      .input('margin_rate', sql.Decimal(18, 2), margin_rate || 0)
      .input('user_phone', sql.NVarChar, user_phone)
      .input('user_email', sql.NVarChar, user_email)
      .input('server_id', sql.NVarChar, server_id)
      .input('use_yn', sql.NVarChar, use_yn)
      .input('reupload_target_yn', sql.NVarChar, reupload_target_yn || 'N')
      .input('get_cnt', sql.Int, get_cnt || 0)
      .input('del_cnt', sql.Int, del_cnt || 0)
      .input('del_days', sql.Int, del_days || 0)
      .input('sale_keep_days', sql.Int, sale_keep_days || 0)
      .input('proc_ord', sql.Int, proc_ord || 0)
      .input('last_proc_date', sql.DateTime, last_proc_date || null)
      .input('batch_date', sql.DateTime, batch_date || null)
      .input('last_delete_date', sql.DateTime, last_delete_date || null)
      .input('cs_phone', sql.NVarChar, cs_phone || '')
      .input('cs_phone_apply', sql.NVarChar, cs_phone_apply || 'N')
      .input('biz_hours', sql.NVarChar, biz_hours || '')
      .input('upload_stop', sql.NVarChar, upload_stop || 'N');
    
    if (isMaskedPassword) {
      // 비밀번호 제외하고 업데이트
      updateQuery = `
        UPDATE tb_user
        SET 
          user_name = @user_name,
          start_date = @start_date,
          end_date = @end_date,
          user_type = @user_type,
          margin_rate = @margin_rate,
          user_phone = @user_phone,
          user_email = @user_email,
          server_id = @server_id,
          use_yn = @use_yn,
          reupload_target_yn = @reupload_target_yn,
          get_cnt = @get_cnt,
          del_cnt = @del_cnt,
          del_days = @del_days,
          sale_keep_days = @sale_keep_days,
          proc_ord = @proc_ord,
          last_proc_date = @last_proc_date,
          batch_date = @batch_date,
          last_delete_date = @last_delete_date,
          cs_phone = @cs_phone,
          cs_phone_apply = @cs_phone_apply,
          biz_hours = @biz_hours,
          upload_stop = @upload_stop
        WHERE user_id = @userId
      `;
    } else {
      // 비밀번호 포함하여 업데이트
      request.input('user_pwd', sql.NVarChar, user_pwd);
      updateQuery = `
        UPDATE tb_user
        SET 
          user_pwd = @user_pwd,
          user_name = @user_name,
          start_date = @start_date,
          end_date = @end_date,
          user_type = @user_type,
          margin_rate = @margin_rate,
          user_phone = @user_phone,
          user_email = @user_email,
          server_id = @server_id,
          use_yn = @use_yn,
          reupload_target_yn = @reupload_target_yn,
          get_cnt = @get_cnt,
          del_cnt = @del_cnt,
          del_days = @del_days,
          sale_keep_days = @sale_keep_days,
          proc_ord = @proc_ord,
          last_proc_date = @last_proc_date,
          batch_date = @batch_date,
          last_delete_date = @last_delete_date,
          cs_phone = @cs_phone,
          cs_phone_apply = @cs_phone_apply,
          biz_hours = @biz_hours,
          upload_stop = @upload_stop
        WHERE user_id = @userId
      `;
    }
    
    await request.query(updateQuery);
    
    console.log('사용자 수정 완료 - userId:', userId);
    
    res.json({
      success: true,
      message: '사용자 정보가 수정되었습니다.'
    });
  } catch (error) {
    console.error('사용자 수정 오류:', error);
    console.error('오류 상세:', error.message);
    console.error('오류 스택:', error.stack);
    res.status(500).json({
      success: false,
      message: '사용자 수정 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 비밀번호 변경 전용 API
router.put('/:userId/password', async (req, res) => {
  try {
    const { userId } = req.params;
    const { current_password, new_password } = req.body;
    
    console.log('비밀번호 변경 요청 - userId:', userId);
    
    if (!current_password || !new_password) {
      return res.status(400).json({
        success: false,
        message: '현재 비밀번호와 새 비밀번호를 입력해주세요.'
      });
    }
    
    const pool = await getConnection();
    
    // 현재 비밀번호 검증
    const checkResult = await pool.request()
      .input('userId', sql.NVarChar, userId)
      .query('SELECT user_pwd FROM tb_user WHERE user_id = @userId');
    
    if (checkResult.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: '사용자를 찾을 수 없습니다.'
      });
    }
    
    const dbPassword = checkResult.recordset[0].user_pwd;
    if (dbPassword !== current_password) {
      return res.status(400).json({
        success: false,
        message: '현재 비밀번호가 일치하지 않습니다.'
      });
    }
    
    // 비밀번호만 업데이트
    await pool.request()
      .input('userId', sql.NVarChar, userId)
      .input('newPassword', sql.NVarChar, new_password)
      .query(`
        UPDATE tb_user
        SET user_pwd = @newPassword
        WHERE user_id = @userId
      `);
    
    console.log('비밀번호 변경 완료 - userId:', userId);
    
    res.json({
      success: true,
      message: '비밀번호가 변경되었습니다.'
    });
  } catch (error) {
    console.error('비밀번호 변경 오류:', error);
    res.status(500).json({
      success: false,
      message: '비밀번호 변경 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 계정관리 저장 전용 API (이름, 이메일, 휴대번호만)
router.put('/:userId/profile', async (req, res) => {
  try {
    const { userId } = req.params;
    const { user_name, user_email, user_phone } = req.body;
    
    console.log('계정 기본정보 수정 요청 - userId:', userId);
    
    const pool = await getConnection();
    
    // 사용자 존재 확인
    const checkResult = await pool.request()
      .input('userId', sql.NVarChar, userId)
      .query('SELECT user_id FROM tb_user WHERE user_id = @userId');
    
    if (checkResult.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: '사용자를 찾을 수 없습니다.'
      });
    }
    
    // 이름, 이메일, 휴대번호만 업데이트
    await pool.request()
      .input('userId', sql.NVarChar, userId)
      .input('userName', sql.NVarChar, user_name || '')
      .input('userEmail', sql.NVarChar, user_email || '')
      .input('userPhone', sql.NVarChar, user_phone || '')
      .query(`
        UPDATE tb_user
        SET 
          user_name = @userName,
          user_email = @userEmail,
          user_phone = @userPhone
        WHERE user_id = @userId
      `);
    
    console.log('계정 기본정보 수정 완료 - userId:', userId);
    
    res.json({
      success: true,
      message: '계정 정보가 저장되었습니다.'
    });
  } catch (error) {
    console.error('계정 기본정보 수정 오류:', error);
    res.status(500).json({
      success: false,
      message: '계정 정보 저장 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 기본정보 저장 전용 API (고객센터, 영업시간, 출고지, 반품지만)
router.put('/:userId/basic-info', async (req, res) => {
  try {
    const { userId } = req.params;
    const { cs_phone, biz_hours, dispatch_location, rturn_location } = req.body;

    console.log('기본정보 수정 요청 - userId:', userId);

    const pool = await getConnection();

    // 사용자 존재 확인
    const checkResult = await pool.request()
      .input('userId', sql.NVarChar, userId)
      .query('SELECT user_id FROM tb_user WHERE user_id = @userId');

    if (checkResult.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: '사용자를 찾을 수 없습니다.'
      });
    }

    const columnCheckResult = await pool.request().query(`
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'tb_user'
        AND COLUMN_NAME IN ('dispatch_Location', 'dispatch_location', 'rturn_location', 'return_location')
    `);
    const columnNames = new Set(columnCheckResult.recordset.map(row => row.COLUMN_NAME));
    const dispatchColumn = columnNames.has('dispatch_Location')
      ? 'dispatch_Location'
      : columnNames.has('dispatch_location')
        ? 'dispatch_location'
        : null;
    const returnColumn = columnNames.has('rturn_location')
      ? 'rturn_location'
      : columnNames.has('return_location')
        ? 'return_location'
        : null;

    let setClause = `
          cs_phone = @csPhone,
          biz_hours = @bizHours
    `;
    if (dispatchColumn) {
      setClause += `,
          ${dispatchColumn} = @dispatchLocation
      `;
    }
    if (returnColumn) {
      setClause += `,
          ${returnColumn} = @rturnLocation
      `;
    }

    await pool.request()
      .input('userId', sql.NVarChar, userId)
      .input('csPhone', sql.NVarChar, cs_phone || '')
      .input('bizHours', sql.NVarChar, biz_hours || '')
      .input('dispatchLocation', sql.NVarChar, dispatch_location || '')
      .input('rturnLocation', sql.NVarChar, rturn_location || '')
      .query(`
        UPDATE tb_user
        SET
          ${setClause}
        WHERE user_id = @userId
      `);

    console.log('기본정보 수정 완료 - userId:', userId);

    res.json({
      success: true,
      message: '기본정보가 저장되었습니다.'
    });
  } catch (error) {
    console.error('기본정보 수정 오류:', error);
    res.status(500).json({
      success: false,
      message: '기본정보 저장 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 사용자별 마켓 연동 수 조회 API
router.get('/:userId/market-count', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const pool = await getConnection();
    
    // 스마트스토어 수
    const ssResult = await pool.request()
      .input('userId', sql.NVarChar, userId)
      .query(`
        SELECT COUNT(*) as count FROM tb_user_market_ss
        WHERE user_id = @userId
        AND client_id IS NOT NULL
        AND client_id != ''
      `);
    
    // 쿠팡 수
    const cpResult = await pool.request()
      .input('userId', sql.NVarChar, userId)
      .query(`
        SELECT COUNT(*) as count FROM tb_user_market_cp
        WHERE user_id = @userId
        AND vendorId IS NOT NULL
        AND vendorId != ''
      `);
    
    const smartstoreCount = ssResult.recordset[0].count;
    const coupangCount = cpResult.recordset[0].count;
    const totalCount = smartstoreCount + coupangCount;
    
    res.json({
      success: true,
      data: {
        smartstoreCount,
        coupangCount,
        totalCount
      }
    });
  } catch (error) {
    console.error('마켓 연동 수 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '마켓 연동 수 조회 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

module.exports = router;
