// 상품관리 관련 API 라우트
const express = require('express');
const router = express.Router();
const { getConnection, sql } = require('../config/database');

// 상품 목록 조회 API
router.get('/products/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { productCode, productName, soldOnly, soldMarket = 'all', excludeReturnCancel, dateFrom, dateTo, sortBy, page = 1, limit = 20 } = req.query;
    
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;

    const excludeRC = String(excludeReturnCancel) === '1' || String(excludeReturnCancel).toLowerCase() === 'true';
    const orderStatusExclude = excludeRC ? ` AND order_status NOT IN ('RETURNED', 'CANCELED')` : '';
    const orderStatusExcludeO = excludeRC ? ` AND O.order_status NOT IN ('RETURNED', 'CANCELED')` : '';
    
    const saleCntSsSub = `(SELECT count(*) FROM tb_order_info WHERE TRY_CAST(RIGHT(seller_cd, 7) AS INT) = B.seq AND market_type = 'SS'${orderStatusExclude}) AS sale_cnt_ss`;
    const saleCntCpSub = `(SELECT count(*) FROM tb_order_info WHERE TRY_CAST(RIGHT(seller_cd, 7) AS INT) = B.seq AND market_type = 'CP'${orderStatusExclude}) AS sale_cnt_cp`;
    const saleCntSub = `(SELECT count(*) FROM tb_order_info WHERE TRY_CAST(RIGHT(seller_cd, 7) AS INT) = B.seq${orderStatusExclude}) AS sale_cnt`;
    
    const pool = await getConnection();
    
    // 전체 카운트 쿼리
    let countQuery = `
      SELECT COUNT(*) as total
      FROM tb_good_user A
      INNER JOIN tb_good_master B
        ON A.gm_seq = B.seq 
      LEFT OUTER JOIN tb_user_market_ss C
        ON A.user_id = C.user_id 
        AND A.biz_idx = C.biz_idx 
      WHERE A.user_id = @userId
        AND result_ss ='성공'
        AND del_date IS NULL 
        AND A.use_yn = N'Y'
    `;
    
    // 데이터 조회 쿼리
    let dataQuery = `
      SELECT
        A.seq,
        A.user_id,
        A.good_name_ss,
        A.seller_cd,
        A.display_id_ss,
        A.display_id_cp,
        B.t_url,
        B.t_img_url,
        B.main_img_url,
        B.base_folder,
        B.item_id,
        B.mp_delv_Price,
        C.store_id,
        A.biz_idx,
        ${saleCntSsSub},
        ${saleCntCpSub},
        ${saleCntSub},
        CONVERT(VARCHAR(19), A.get_date, 120) as get_date
      FROM tb_good_user A
      INNER JOIN tb_good_master B
        ON A.gm_seq = B.seq 
      LEFT OUTER JOIN tb_user_market_ss C
        ON A.user_id = C.user_id 
        AND A.biz_idx = C.biz_idx 
      WHERE A.user_id = @userId
        AND result_ss ='성공'
        AND del_date IS NULL 
        AND A.use_yn = N'Y'
    `;
    
    const countRequest = pool.request().input('userId', sql.NVarChar, userId);
    const dataRequest = pool.request().input('userId', sql.NVarChar, userId);
    
    // 상품코드 검색 (접두사 제거)
    if (productCode) {
      // C, C1-, C2-, C3-, P1-, P2-, P3- 제거
      let cleanCode = productCode.trim();
      const prefixes = ['C1-', 'C2-', 'C3-', 'P1-', 'P2-', 'P3-'];
      
      for (const prefix of prefixes) {
        if (cleanCode.toUpperCase().startsWith(prefix)) {
          cleanCode = cleanCode.substring(prefix.length);
          break;
        }
      }
      
      // 단순 'C'로 시작하는 경우도 제거
      if (cleanCode.toUpperCase().startsWith('C') && cleanCode.length > 1 && cleanCode[1] !== '-') {
        cleanCode = cleanCode.substring(1);
      }
      
      countQuery += ` AND A.seller_cd LIKE @productCode`;
      dataQuery += ` AND A.seller_cd LIKE @productCode`;
      countRequest.input('productCode', sql.NVarChar, `%${cleanCode}%`);
      dataRequest.input('productCode', sql.NVarChar, `%${cleanCode}%`);
    }
    
    // 상품명 검색
    if (productName) {
      countQuery += ` AND A.good_name_ss LIKE @productName`;
      dataQuery += ` AND A.good_name_ss LIKE @productName`;
      countRequest.input('productName', sql.NVarChar, `%${productName}%`);
      dataRequest.input('productName', sql.NVarChar, `%${productName}%`);
    }

    // 판매된상품만 보기: 주문 정보가 1건 이상 존재하는 상품만
    if (String(soldOnly) === '1' || String(soldOnly).toLowerCase() === 'true') {
      let soldOnlyFilter = '';
      
      if (soldMarket === 'ss') {
        // 스마트스토어만
        soldOnlyFilter = `
          AND EXISTS (
            SELECT 1
            FROM tb_order_info O
            WHERE TRY_CAST(RIGHT(O.seller_cd, 7) AS INT) = B.seq
            AND O.market_type = 'SS'
            ${orderStatusExcludeO}
          )
        `;
      } else if (soldMarket === 'cp') {
        // 쿠팡만
        soldOnlyFilter = `
          AND EXISTS (
            SELECT 1
            FROM tb_order_info O
            WHERE TRY_CAST(RIGHT(O.seller_cd, 7) AS INT) = B.seq
            AND O.market_type = 'CP'
            ${orderStatusExcludeO}
          )
        `;
      } else {
        // 전체 (스마트스토어 또는 쿠팡)
        soldOnlyFilter = `
          AND EXISTS (
            SELECT 1
            FROM tb_order_info O
            WHERE TRY_CAST(RIGHT(O.seller_cd, 7) AS INT) = B.seq
            ${orderStatusExcludeO}
          )
        `;
      }
      
      countQuery += soldOnlyFilter;
      dataQuery += soldOnlyFilter;
    }

    // 등록일자 필터: dateFrom/dateTo는 'YYYY-MM-DD' (기본값: 비어있으면 전체 조회)
    const dateFromStr = typeof dateFrom === 'string' ? dateFrom.trim() : '';
    const dateToStr = typeof dateTo === 'string' ? dateTo.trim() : '';

    if (dateFromStr) {
      // 선택일 00:00:00부터
      const from = new Date(`${dateFromStr}T00:00:00`);
      if (!Number.isNaN(from.getTime())) {
        countQuery += ` AND A.get_date >= @dateFrom`;
        dataQuery += ` AND A.get_date >= @dateFrom`;
        countRequest.input('dateFrom', sql.DateTime, from);
        dataRequest.input('dateFrom', sql.DateTime, from);
      }
    }

    if (dateToStr) {
      // 선택일 다음날 00:00:00 미만까지(=해당 날짜 포함)
      const toNext = new Date(`${dateToStr}T00:00:00`);
      if (!Number.isNaN(toNext.getTime())) {
        toNext.setDate(toNext.getDate() + 1);
        countQuery += ` AND A.get_date < @dateToNext`;
        dataQuery += ` AND A.get_date < @dateToNext`;
        countRequest.input('dateToNext', sql.DateTime, toNext);
        dataRequest.input('dateToNext', sql.DateTime, toNext);
      }
    }
    
    // 카운트 조회
    const countResult = await countRequest.query(countQuery);
    const totalCount = countResult.recordset[0].total;
    
    // 정렬 조건 (기본: 최근 등록 순)
    let orderByClause = 'A.seq DESC';
    if (String(sortBy) === 'oldest') {
      orderByClause = 'A.seq ASC';
    } else if (String(sortBy) === 'sales') {
      orderByClause = excludeRC
        ? `(SELECT count(*) FROM tb_order_info WHERE TRY_CAST(RIGHT(seller_cd, 7) AS INT) = B.seq AND order_status NOT IN ('RETURNED', 'CANCELED')) DESC, A.seq DESC`
        : `(SELECT count(*) FROM tb_order_info WHERE TRY_CAST(RIGHT(seller_cd, 7) AS INT) = B.seq) DESC, A.seq DESC`;
    }

    // 데이터 조회 (페이징)
    dataQuery += ` ORDER BY ${orderByClause} OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`;
    dataRequest.input('offset', sql.Int, offset);
    dataRequest.input('limit', sql.Int, limitNum);
    
    console.log('📦 상품 조회 쿼리 실행 - userId:', userId, 'page:', pageNum, 'limit:', limitNum);
    const dataResult = await dataRequest.query(dataQuery);
    console.log('📦 조회된 상품 수:', dataResult.recordset.length);
    if (dataResult.recordset.length > 0) {
      console.log('📦 첫 번째 상품 seq:', dataResult.recordset[0].seq);
      console.log('📦 첫 번째 상품 판매건수:', {
        sale_cnt: dataResult.recordset[0].sale_cnt,
        sale_cnt_ss: dataResult.recordset[0].sale_cnt_ss,
        sale_cnt_cp: dataResult.recordset[0].sale_cnt_cp
      });
      console.log('📦 마지막 상품 seq:', dataResult.recordset[dataResult.recordset.length - 1].seq);
    }
    
    res.json({
      success: true,
      data: dataResult.recordset,
      pagination: {
        currentPage: pageNum,
        pageSize: limitNum,
        totalCount: totalCount,
        totalPages: Math.ceil(totalCount / limitNum)
      }
    });
  } catch (error) {
    console.error('상품 목록 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '상품 목록 조회 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 삭제요청 API
router.post('/delete-request', async (req, res) => {
  try {
    const { user_id, gu_seq, biz_idx, del_reason, del_type } = req.body;

    // 필수 파라미터 검증
    if (!user_id || !gu_seq || !del_reason || !del_type) {
      return res.status(400).json({
        success: false,
        message: '필수 파라미터가 누락되었습니다.'
      });
    }

    const pool = await getConnection();

    // tb_del_request 테이블에 삭제요청 저장
    const insertQuery = `
      INSERT INTO tb_del_request (
        user_id,
        gu_seq,
        biz_idx,
        del_reason,
        del_type,
        input_date
      ) VALUES (
        @user_id,
        @gu_seq,
        @biz_idx,
        @del_reason,
        @del_type,
        GETDATE()
      )
    `;

    // biz_idx는 프론트에서 number로 올 수 있음 — NVarChar에는 문자열만 전달
    const bizIdxStr =
      biz_idx === null || biz_idx === undefined || biz_idx === ''
        ? ''
        : String(biz_idx);

    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      const updateResult = await new sql.Request(transaction)
        .input('gu_seq', sql.Int, gu_seq)
        .input('user_id', sql.NVarChar, user_id)
        .query(`
          UPDATE tb_good_user
          SET use_yn = N'N'
          WHERE seq = @gu_seq AND user_id = @user_id
        `);

      const updatedRows = updateResult.rowsAffected?.[0] ?? 0;
      if (updatedRows === 0) {
        await transaction.rollback();
        return res.status(404).json({
          success: false,
          message: '해당 상품을 찾을 수 없습니다.'
        });
      }

      await new sql.Request(transaction)
        .input('user_id', sql.NVarChar, user_id)
        .input('gu_seq', sql.Int, gu_seq)
        .input('biz_idx', sql.NVarChar, bizIdxStr)
        .input('del_reason', sql.NVarChar, del_reason)
        .input('del_type', sql.NVarChar, del_type)
        .query(insertQuery);

      await transaction.commit();
    } catch (txErr) {
      try {
        await transaction.rollback();
      } catch (_) {
        /* ignore rollback error */
      }
      throw txErr;
    }

    res.json({
      success: true,
      message: '삭제요청이 완료되었습니다.'
    });
  } catch (error) {
    console.error('삭제요청 저장 오류:', error);
    res.status(500).json({
      success: false,
      message: '삭제요청 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 상품 통계 조회 (마켓별, 스토어별)
router.get('/stats/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    console.log('📊 상품 통계 조회 요청 - userId:', userId);

    const pool = await getConnection();

    // 스토어별 마켓별 상품 수 조회
    const statsQuery = `
      SELECT
        A.biz_idx,
        C.store_name,
        SUM(CASE WHEN result_ss = '성공' THEN 1 ELSE 0 END) AS SS_CNT,
        SUM(CASE WHEN result_cp = '성공' THEN 1 ELSE 0 END) AS CP_CNT
      FROM tb_good_user A
      INNER JOIN tb_good_master B
        ON A.gm_seq = B.seq 
      LEFT OUTER JOIN tb_user_market_ss C
        ON A.user_id = C.user_id 
        AND A.biz_idx = C.biz_idx 
      WHERE A.user_id = @userId
        AND del_date IS NULL 
        AND A.use_yn = N'Y'
      GROUP BY A.biz_idx, C.store_name
      ORDER BY A.biz_idx
    `;

    const result = await pool.request()
      .input('userId', sql.NVarChar, userId)
      .query(statsQuery);

    console.log('📊 스토어별 마켓별 상품 수:', result.recordset);

    // 마켓별 총 상품 수 계산
    const smartStoreTotal = result.recordset.reduce((sum, item) => sum + item.SS_CNT, 0);
    const coupangTotal = result.recordset.reduce((sum, item) => sum + item.CP_CNT, 0);

    // 스마트스토어 스토어별 데이터
    const smartStoreStores = result.recordset
      .filter(item => item.SS_CNT > 0)
      .map(item => ({
        biz_idx: item.biz_idx,
        store_name: item.store_name,
        count: item.SS_CNT
      }));

    // 쿠팡 스토어별 데이터
    const coupangStores = result.recordset
      .filter(item => item.CP_CNT > 0)
      .map(item => ({
        biz_idx: item.biz_idx,
        store_name: item.store_name,
        count: item.CP_CNT
      }));

    res.json({
      success: true,
      data: {
        smartStore: {
          total: smartStoreTotal,
          stores: smartStoreStores
        },
        coupang: {
          total: coupangTotal,
          stores: coupangStores
        }
      }
    });
  } catch (error) {
    console.error('상품 통계 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '상품 통계 조회 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

module.exports = router;
