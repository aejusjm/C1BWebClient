// 기준정보 관련 API 라우트
const express = require('express');
const router = express.Router();
const { getConnection, sql } = require('../config/database');

// 기준정보 조회 API
router.get('/', async (req, res) => {
  try {
    const pool = await getConnection();
    const result = await pool.request()
      .query('SELECT exchange_rate, market_fee_ss, market_fee_cp, discount_ss, discount_cp FROM tb_setting_info');
    
    if (result.recordset.length > 0) {
      const data = result.recordset[0];
      res.json({
        success: true,
        data: {
          rate: data.exchange_rate,
          smartStoreFee: data.market_fee_ss,
          coupangFee: data.market_fee_cp,
          smartStoreDiscount: data.discount_ss,
          coupangDiscount: data.discount_cp
        }
      });
    } else {
      res.json({
        success: true,
        data: {
          rate: '',
          smartStoreFee: '',
          coupangFee: '',
          smartStoreDiscount: '',
          coupangDiscount: ''
        }
      });
    }
  } catch (error) {
    console.error('기준정보 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '기준정보 조회 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 기준정보 저장 API
router.post('/', async (req, res) => {
  try {
    const { rate, smartStoreFee, coupangFee, smartStoreDiscount, coupangDiscount } = req.body;
    
    const pool = await getConnection();
    
    // 기존 데이터 확인
    const checkResult = await pool.request()
      .query('SELECT COUNT(*) as count FROM tb_setting_info');
    
    const hasData = checkResult.recordset[0].count > 0;
    
    if (hasData) {
      // 업데이트
      await pool.request()
        .input('exchange_rate', sql.Decimal(18, 2), rate || 0)
        .input('market_fee_ss', sql.Decimal(18, 2), smartStoreFee || 0)
        .input('market_fee_cp', sql.Decimal(18, 2), coupangFee || 0)
        .input('discount_ss', sql.Decimal(18, 2), smartStoreDiscount || 0)
        .input('discount_cp', sql.Decimal(18, 2), coupangDiscount || 0)
        .query(`
          UPDATE tb_setting_info 
          SET exchange_rate = @exchange_rate,
              market_fee_ss = @market_fee_ss,
              market_fee_cp = @market_fee_cp,
              discount_ss = @discount_ss,
              discount_cp = @discount_cp
        `);
    } else {
      // 삽입
      await pool.request()
        .input('exchange_rate', sql.Decimal(18, 2), rate || 0)
        .input('market_fee_ss', sql.Decimal(18, 2), smartStoreFee || 0)
        .input('market_fee_cp', sql.Decimal(18, 2), coupangFee || 0)
        .input('discount_ss', sql.Decimal(18, 2), smartStoreDiscount || 0)
        .input('discount_cp', sql.Decimal(18, 2), coupangDiscount || 0)
        .query(`
          INSERT INTO tb_setting_info (exchange_rate, market_fee_ss, market_fee_cp, discount_ss, discount_cp)
          VALUES (@exchange_rate, @market_fee_ss, @market_fee_cp, @discount_ss, @discount_cp)
        `);
    }
    
    res.json({
      success: true,
      message: '기준정보가 저장되었습니다.'
    });
  } catch (error) {
    console.error('기준정보 저장 오류:', error);
    res.status(500).json({
      success: false,
      message: '기준정보 저장 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

module.exports = router;
