// 상세페이지관리 관련 API 라우트
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { getConnection, sql } = require('../config/database');

// 업로드 디렉토리 설정
const uploadDir = path.join(__dirname, '../uploads/detail-pages');

// 디렉토리가 없으면 생성
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer 설정 - 파일 저장
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB 제한
  fileFilter: function (req, file, cb) {
    const filetypes = /jpeg|jpg|png/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('JPG, PNG 파일만 업로드 가능합니다.'));
  }
});

// 전체 이미지 목록 조회 API
router.get('/images', async (req, res) => {
  try {
    const pool = await getConnection();
    const result = await pool.request()
      .query(`
        SELECT seq, img_type, img_local_path, img_url, input_date
        FROM tb_detail_page
        ORDER BY img_type, seq
      `);
    
    res.json({
      success: true,
      data: result.recordset
    });
  } catch (error) {
    console.error('이미지 목록 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '이미지 목록 조회 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 이미지 업로드 API
router.post('/upload', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: '파일이 업로드되지 않았습니다.'
      });
    }

    const { imgType, seq } = req.body;
    
    if (!imgType) {
      return res.status(400).json({
        success: false,
        message: '필수 파라미터가 누락되었습니다.'
      });
    }

    const fileUrl = `/uploads/detail-pages/${req.file.filename}`;
    const localPath = path.join(uploadDir, req.file.filename);
    const fullUrl = `http://localhost:3001${fileUrl}`;
    
    const pool = await getConnection();
    
    // 기존 데이터 확인
    let existingData = null;
    if (seq) {
      const checkResult = await pool.request()
        .input('seq', sql.Int, seq)
        .query('SELECT seq, img_local_path FROM tb_detail_page WHERE seq = @seq');
      
      if (checkResult.recordset.length > 0) {
        existingData = checkResult.recordset[0];
      }
    }
    
    if (existingData) {
      // 기존 파일 삭제
      if (existingData.img_local_path && fs.existsSync(existingData.img_local_path)) {
        fs.unlinkSync(existingData.img_local_path);
      }
      
      // UPDATE
      await pool.request()
        .input('seq', sql.Int, seq)
        .input('localPath', sql.NVarChar, localPath)
        .input('imgUrl', sql.NVarChar, fullUrl)
        .query(`
          UPDATE tb_detail_page
          SET 
            img_local_path = @localPath,
            img_url = @imgUrl,
            input_date = GETDATE()
          WHERE seq = @seq
        `);
      
      res.json({
        success: true,
        message: '이미지가 수정되었습니다.',
        fileUrl: fullUrl,
        fileName: req.file.filename,
        seq: seq
      });
    } else {
      // INSERT
      const insertResult = await pool.request()
        .input('imgType', sql.NVarChar, imgType)
        .input('localPath', sql.NVarChar, localPath)
        .input('imgUrl', sql.NVarChar, fullUrl)
        .query(`
          INSERT INTO tb_detail_page (img_type, img_local_path, img_url, input_date)
          OUTPUT INSERTED.seq
          VALUES (@imgType, @localPath, @imgUrl, GETDATE())
        `);
      
      const newSeq = insertResult.recordset[0].seq;
      
      res.json({
        success: true,
        message: '이미지가 업로드되었습니다.',
        fileUrl: fullUrl,
        fileName: req.file.filename,
        seq: newSeq
      });
    }
  } catch (error) {
    console.error('이미지 업로드 오류:', error);
    res.status(500).json({
      success: false,
      message: '이미지 업로드 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 이미지 삭제 API
router.delete('/delete/:seq', async (req, res) => {
  try {
    const { seq } = req.params;
    
    const pool = await getConnection();
    
    // 기존 데이터 조회
    const result = await pool.request()
      .input('seq', sql.Int, seq)
      .query('SELECT img_local_path FROM tb_detail_page WHERE seq = @seq');
    
    if (result.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: '데이터를 찾을 수 없습니다.'
      });
    }
    
    const localPath = result.recordset[0].img_local_path;
    
    // 파일 삭제
    if (localPath && fs.existsSync(localPath)) {
      fs.unlinkSync(localPath);
    }
    
    // DB에서 삭제
    await pool.request()
      .input('seq', sql.Int, seq)
      .query('DELETE FROM tb_detail_page WHERE seq = @seq');
    
    res.json({
      success: true,
      message: '이미지가 삭제되었습니다.'
    });
  } catch (error) {
    console.error('이미지 삭제 오류:', error);
    res.status(500).json({
      success: false,
      message: '이미지 삭제 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

module.exports = router;
