// 서버관리 관련 API 라우트
const express = require('express');
const router = express.Router();
const { getConnection, sql } = require('../config/database');

// 서버 목록 조회 API
router.get('/', async (req, res) => {
  try {
    const pool = await getConnection();
    const result = await pool.request()
      .query(`
        SELECT 
          server_id,
          server_ip,
          server_name,
          server_type,
          use_yn,
          input_date,
          update_date
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

// 특정 서버 조회 API
router.get('/:serverId', async (req, res) => {
  try {
    const { serverId } = req.params;
    
    const pool = await getConnection();
    const result = await pool.request()
      .input('serverId', sql.NVarChar, serverId)
      .query(`
        SELECT 
          server_id,
          server_ip,
          server_name,
          server_type,
          use_yn,
          input_date,
          update_date
        FROM tb_server_info
        WHERE server_id = @serverId
      `);
    
    if (result.recordset.length > 0) {
      res.json({
        success: true,
        data: result.recordset[0]
      });
    } else {
      res.status(404).json({
        success: false,
        message: '서버를 찾을 수 없습니다.'
      });
    }
  } catch (error) {
    console.error('서버 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '서버 조회 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 서버 추가 API
router.post('/', async (req, res) => {
  try {
    const {
      server_id,
      server_ip,
      server_name,
      server_type,
      use_yn
    } = req.body;
    
    // 필수 필드 검증
    if (!server_id || !server_ip || !server_name) {
      return res.status(400).json({
        success: false,
        message: '필수 항목(서버ID, 서버IP, 서버명)을 모두 입력해주세요.'
      });
    }
    
    const pool = await getConnection();
    
    // 중복 체크
    const checkResult = await pool.request()
      .input('serverId', sql.NVarChar, server_id)
      .query('SELECT COUNT(*) as cnt FROM tb_server_info WHERE server_id = @serverId');
    
    if (checkResult.recordset[0].cnt > 0) {
      return res.status(400).json({
        success: false,
        message: '이미 존재하는 서버ID입니다.'
      });
    }
    
    await pool.request()
      .input('server_id', sql.NVarChar, server_id)
      .input('server_ip', sql.NVarChar, server_ip)
      .input('server_name', sql.NVarChar, server_name)
      .input('server_type', sql.NVarChar, server_type || '')
      .input('use_yn', sql.NVarChar, use_yn || 'Y')
      .query(`
        INSERT INTO tb_server_info (server_id, server_ip, server_name, server_type, use_yn, input_date)
        VALUES (@server_id, @server_ip, @server_name, @server_type, @use_yn, GETDATE())
      `);
    
    res.json({
      success: true,
      message: '서버가 등록되었습니다.'
    });
  } catch (error) {
    console.error('서버 추가 오류:', error);
    res.status(500).json({
      success: false,
      message: '서버 추가 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 서버 수정 API
router.put('/:serverId', async (req, res) => {
  try {
    const { serverId } = req.params;
    const {
      server_ip,
      server_name,
      server_type,
      use_yn
    } = req.body;
    
    // 필수 필드 검증
    if (!server_ip || !server_name) {
      return res.status(400).json({
        success: false,
        message: '필수 항목(서버IP, 서버명)을 모두 입력해주세요.'
      });
    }
    
    const pool = await getConnection();
    
    await pool.request()
      .input('serverId', sql.NVarChar, serverId)
      .input('server_ip', sql.NVarChar, server_ip)
      .input('server_name', sql.NVarChar, server_name)
      .input('server_type', sql.NVarChar, server_type || '')
      .input('use_yn', sql.NVarChar, use_yn || 'Y')
      .query(`
        UPDATE tb_server_info
        SET 
          server_ip = @server_ip,
          server_name = @server_name,
          server_type = @server_type,
          use_yn = @use_yn,
          update_date = GETDATE()
        WHERE server_id = @serverId
      `);
    
    res.json({
      success: true,
      message: '서버가 수정되었습니다.'
    });
  } catch (error) {
    console.error('서버 수정 오류:', error);
    res.status(500).json({
      success: false,
      message: '서버 수정 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 서버 삭제 API
router.delete('/:serverId', async (req, res) => {
  try {
    const { serverId } = req.params;
    
    const pool = await getConnection();
    
    await pool.request()
      .input('serverId', sql.NVarChar, serverId)
      .query('DELETE FROM tb_server_info WHERE server_id = @serverId');
    
    res.json({
      success: true,
      message: '서버가 삭제되었습니다.'
    });
  } catch (error) {
    console.error('서버 삭제 오류:', error);
    res.status(500).json({
      success: false,
      message: '서버 삭제 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

module.exports = router;
