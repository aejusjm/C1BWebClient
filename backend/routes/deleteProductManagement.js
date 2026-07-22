// 삭제상품관리 관련 API 라우트
const express = require('express');
const router = express.Router();
const { getConnection, sql } = require('../config/database');
const {
  changeSmartStoreProductStatus
} = require('../services/smartStoreProductStatus');
const { stopCoupangProductSale } = require('../services/coupangProductStatus');

const RELATED_SUSPENSION_REASONS = new Set([
  '지재권 신고 상품',
  '유통경로 요청 상품',
  '불법(통관불가) 상품'
]);

async function saveSmartStoreSuspensionResult(seq, resultMessage) {
  const parsedSeq = Number.parseInt(String(seq), 10);
  if (!Number.isFinite(parsedSeq)) return;

  // suspen_ss는 NVARCHAR(150): 네이버의 긴 오류 응답도 컬럼 범위 내에서 보존한다.
  const message = String(resultMessage || '알 수 없는 오류').slice(0, 150);
  const pool = await getConnection();
  await pool.request()
    .input('seq', sql.Int, parsedSeq)
    .input('suspenSs', sql.NVarChar(150), message)
    .query(`
      UPDATE tb_del_request
      SET suspen_ss = @suspenSs
      WHERE seq = @seq
    `);
}

async function saveCoupangSuspensionResult(seq, resultMessage) {
  const parsedSeq = Number.parseInt(String(seq), 10);
  if (!Number.isFinite(parsedSeq)) return;

  const message = String(resultMessage || '알 수 없는 오류').slice(0, 150);
  const pool = await getConnection();
  await pool.request()
    .input('seq', sql.Int, parsedSeq)
    .input('suspenCp', sql.NVarChar(150), message)
    .query(`
      UPDATE tb_del_request
      SET suspen_cp = @suspenCp
      WHERE seq = @seq
    `);
}

async function stopRelatedProductSale(target) {
  let smartStoreSuccess = false;
  let coupangSuccess = false;

  const originProductNo = String(target.product_id_ss || '').trim();
  const ssClientId = String(target.ss_client_id || '').trim();
  const ssClientSecret = String(target.ss_client_secret || '').trim();
  try {
    if (!originProductNo) {
      throw new Error('스마트스토어 원상품번호(product_id_ss)가 없습니다.');
    }
    if (!ssClientId || !ssClientSecret) {
      throw new Error('스마트스토어 API 인증정보가 없습니다.');
    }
    await changeSmartStoreProductStatus({
      clientId: ssClientId,
      clientSecret: ssClientSecret,
      originProductNo,
      statusType: 'SUSPENSION'
    });
    smartStoreSuccess = true;
    await saveSmartStoreSuspensionResult(target.request_seq, '판매중지');
  } catch (error) {
    await saveSmartStoreSuspensionResult(target.request_seq, error.message);
  }

  const sellerProductId = String(target.product_id_cp || '').trim();
  const cpAccessKey = String(target.cp_access_key || '').trim();
  const cpSecretKey = String(target.cp_secret_key || '').trim();
  try {
    if (!sellerProductId) {
      throw new Error('쿠팡 상품번호(product_id_cp)가 없습니다.');
    }
    if (!cpAccessKey || !cpSecretKey) {
      throw new Error('쿠팡 API 인증정보가 없습니다.');
    }
    await stopCoupangProductSale({
      accessKey: cpAccessKey,
      secretKey: cpSecretKey,
      sellerProductId
    });
    coupangSuccess = true;
    await saveCoupangSuspensionResult(target.request_seq, '판매중지');
  } catch (error) {
    await saveCoupangSuspensionResult(target.request_seq, error.message);
  }

  return { smartStoreSuccess, coupangSuccess };
}

// 삭제상품 목록 조회 API
router.get('/', async (req, res) => {
  try {
    const { delType, productName, userKeyword, cohortSeq } = req.query;
    
    console.log('🗑️ 삭제상품 목록 조회 API 호출됨, delType:', delType, 'productName:', productName, 'userKeyword:', userKeyword, 'cohortSeq:', cohortSeq);
    
    let delTypeCondition = '';
    if (delType) {
      delTypeCondition = `AND A.del_type = N'${delType}'`;
    }

    let productNameCondition = '';
    let userCondition = '';
    let cohortCondition = '';
    const pool = await getConnection();
    const request = pool.request();
    if (productName && String(productName).trim()) {
      productNameCondition = 'AND B.good_name LIKE @productName';
      request.input('productName', sql.NVarChar, `%${String(productName).trim()}%`);
    }
    if (userKeyword && String(userKeyword).trim()) {
      userCondition = 'AND (A.user_id LIKE @userKeyword OR D.user_name LIKE @userKeyword)';
      request.input('userKeyword', sql.NVarChar, `%${String(userKeyword).trim()}%`);
    }
    if (cohortSeq !== undefined && cohortSeq !== null && String(cohortSeq).trim() !== '') {
      const parsedCohortSeq = parseInt(String(cohortSeq), 10);
      if (Number.isFinite(parsedCohortSeq)) {
        cohortCondition = 'AND D.cohort_seq = @cohortSeq';
        request.input('cohortSeq', sql.Int, parsedCohortSeq);
      }
    }
    
    const result = await request
      .query(`
        SELECT 
          A.seq,
          A.user_id,
          D.user_name,
          A.gu_seq,
          A.del_reason,
          A.market_type,
          A.biz_idx,
          A.del_yn,
          A.suspen_ss,
          A.suspen_cp,
          A.del_type,
          A.del_confirm,
          A.del_date,
          A.input_date,
          B.gm_seq,
          B.good_name,
          ('https://c1b.co.kr/CDN/' + C.base_folder + '/' + C.item_id + '/' + C.main_img_url) AS img_url,
          CASE 
            WHEN EXISTS (
              SELECT 1 
              FROM tb_del_request 
              WHERE dr_seq = A.seq
            ) THEN 1 
            ELSE 0 
          END AS has_child_requests
        FROM tb_del_request A
        INNER JOIN tb_good_user B
                ON A.gu_seq = B.seq 
        INNER JOIN tb_good_master C
                ON B.gm_seq = C.seq 
        INNER JOIN tb_user D
                ON A.user_id = D.user_id
        WHERE 1=1
        ${delTypeCondition}
        ${productNameCondition}
        ${userCondition}
        ${cohortCondition}
        ORDER BY A.seq DESC
      `);
    
    console.log('🗑️ 삭제상품 목록 조회 결과:', result.recordset.length, '건');
    if (result.recordset.length > 0) {
      console.log('🗑️ 첫 번째 레코드 날짜 샘플:', {
        input_date: result.recordset[0].input_date,
        del_date: result.recordset[0].del_date
      });
    }
    
    res.json({
      success: true,
      data: result.recordset
    });
  } catch (error) {
    console.error('🗑️ 삭제상품 목록 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '삭제상품 목록 조회 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 삭제상품 단건 삭제 처리 API
router.put('/:seq', async (req, res) => {
  try {
    const { seq } = req.params;
    
    const pool = await getConnection();
    
    await pool.request()
      .input('seq', sql.Int, seq)
      .query(`
        UPDATE tb_del_request
        SET del_yn = 'Y'
        WHERE seq = @seq
      `);
    
    res.json({
      success: true,
      message: '삭제 처리되었습니다.'
    });
  } catch (error) {
    console.error('삭제 처리 오류:', error);
    res.status(500).json({
      success: false,
      message: '삭제 처리 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 삭제확인 처리 API
router.put('/:seq/confirm', async (req, res) => {
  try {
    const { seq } = req.params;

    const pool = await getConnection();

    await pool.request()
      .input('seq', sql.Int, seq)
      .query(`
        UPDATE tb_del_request
        SET del_confirm = 'Y'
        WHERE seq = @seq
      `);

    res.json({
      success: true,
      message: '삭제확인 처리되었습니다.'
    });
  } catch (error) {
    console.error('삭제확인 처리 오류:', error);
    res.status(500).json({
      success: false,
      message: '삭제확인 처리 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 삭제확인 취소 API
router.put('/:seq/cancel-confirm', async (req, res) => {
  try {
    const { seq } = req.params;

    const pool = await getConnection();

    const result = await pool.request()
      .input('seq', sql.Int, seq)
      .query(`
        UPDATE tb_del_request
        SET del_confirm = 'N'
        WHERE seq = @seq
          AND del_confirm = 'Y'
          AND del_date IS NULL
      `);

    if (result.rowsAffected[0] === 0) {
      return res.status(400).json({
        success: false,
        message: '확인취소할 수 없습니다. 삭제일자가 있는 경우 확인취소가 불가합니다.'
      });
    }

    res.json({
      success: true,
      message: '삭제확인이 취소되었습니다.'
    });
  } catch (error) {
    console.error('삭제확인 취소 오류:', error);
    res.status(500).json({
      success: false,
      message: '삭제확인 취소 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 스마트스토어 상품 판매중지
router.put('/:seq/stop-sale/smartstore', async (req, res) => {
  try {
    const seq = Number.parseInt(String(req.params.seq), 10);
    if (!Number.isFinite(seq)) {
      return res.status(400).json({
        success: false,
        message: '삭제요청 번호가 올바르지 않습니다.'
      });
    }

    const pool = await getConnection();
    const result = await pool.request()
      .input('seq', sql.Int, seq)
      .query(`
        SELECT TOP 1
          A.seq,
          A.user_id,
          A.biz_idx,
          B.product_id_ss,
          C.client_id,
          C.client_secret_sign
        FROM tb_del_request A
        INNER JOIN tb_good_user B
          ON A.gu_seq = B.seq
        LEFT OUTER JOIN tb_user_market_ss C
          ON A.user_id = C.user_id
          AND A.biz_idx = C.biz_idx
        WHERE A.seq = @seq
      `);

    const target = result.recordset[0];
    if (!target) {
      return res.status(404).json({
        success: false,
        message: '삭제요청 상품을 찾을 수 없습니다.'
      });
    }

    const originProductNo = String(target.product_id_ss || '').trim();
    if (!originProductNo) {
      const message = '스마트스토어 원상품번호(product_id_ss)가 없습니다.';
      await saveSmartStoreSuspensionResult(seq, message);
      return res.status(400).json({
        success: false,
        message
      });
    }

    const clientId = String(target.client_id || '').trim();
    const clientSecret = String(target.client_secret_sign || '').trim();
    if (!clientId || !clientSecret) {
      const message = `사용자 ${target.user_id}의 스토어 IDX ${target.biz_idx}에 스마트스토어 API 인증정보가 없습니다.`;
      await saveSmartStoreSuspensionResult(seq, message);
      return res.status(400).json({
        success: false,
        message
      });
    }

    const apiResult = await changeSmartStoreProductStatus({
      clientId,
      clientSecret,
      originProductNo,
      statusType: 'SUSPENSION'
    });

    await saveSmartStoreSuspensionResult(seq, '판매중지');

    console.log('🛑 스마트스토어 판매중지 완료:', {
      requestSeq: seq,
      userId: target.user_id,
      bizIdx: target.biz_idx,
      originProductNo,
      statusCode: apiResult.statusCode
    });

    return res.json({
      success: true,
      message: '스마트스토어 상품이 판매중지 상태로 변경되었습니다.',
      data: {
        requestSeq: seq,
        originProductNo,
        statusType: 'SUSPENSION',
        statusCode: apiResult.statusCode
      }
    });
  } catch (error) {
    console.error('스마트스토어 판매중지 오류:', {
      seq: req.params.seq,
      code: error.code,
      status: error.status,
      message: error.message
    });

    try {
      await saveSmartStoreSuspensionResult(
        req.params.seq,
        error.message || '스마트스토어 판매중지 처리 중 오류가 발생했습니다.'
      );
    } catch (saveError) {
      console.error('스마트스토어 판매중지 결과 저장 오류:', saveError);
    }

    const statusCode =
      Number.isInteger(error.status) && error.status >= 400 && error.status < 500
        ? 400
        : 500;

    return res.status(statusCode).json({
      success: false,
      message: error.message || '스마트스토어 판매중지 처리 중 오류가 발생했습니다.'
    });
  }
});

// 쿠팡 상품 판매중지
router.put('/:seq/stop-sale/coupang', async (req, res) => {
  try {
    const seq = Number.parseInt(String(req.params.seq), 10);
    if (!Number.isFinite(seq)) {
      return res.status(400).json({
        success: false,
        message: '삭제요청 번호가 올바르지 않습니다.'
      });
    }

    const pool = await getConnection();
    const result = await pool.request()
      .input('seq', sql.Int, seq)
      .query(`
        SELECT TOP 1
          A.seq,
          A.user_id,
          A.biz_idx,
          B.product_id_cp,
          C.accessKey,
          C.secretKey
        FROM tb_del_request A
        INNER JOIN tb_good_user B
          ON A.gu_seq = B.seq
        LEFT OUTER JOIN tb_user_market_cp C
          ON A.user_id = C.user_id
          AND A.biz_idx = C.biz_idx
        WHERE A.seq = @seq
      `);

    const target = result.recordset[0];
    if (!target) {
      return res.status(404).json({
        success: false,
        message: '삭제요청 상품을 찾을 수 없습니다.'
      });
    }

    const sellerProductId = String(target.product_id_cp || '').trim();
    if (!sellerProductId) {
      const message = '쿠팡 상품번호(product_id_cp)가 없습니다.';
      await saveCoupangSuspensionResult(seq, message);
      return res.status(400).json({
        success: false,
        message
      });
    }

    const accessKey = String(target.accessKey || '').trim();
    const secretKey = String(target.secretKey || '').trim();
    if (!accessKey || !secretKey) {
      const message = `사용자 ${target.user_id}의 스토어 IDX ${target.biz_idx}에 쿠팡 API 인증정보가 없습니다.`;
      await saveCoupangSuspensionResult(seq, message);
      return res.status(400).json({
        success: false,
        message
      });
    }

    const apiResult = await stopCoupangProductSale({
      accessKey,
      secretKey,
      sellerProductId
    });

    await saveCoupangSuspensionResult(seq, '판매중지');

    console.log('🛑 쿠팡 판매중지 완료:', {
      requestSeq: seq,
      userId: target.user_id,
      bizIdx: target.biz_idx,
      sellerProductId,
      vendorItemCount: apiResult.totalCount
    });

    return res.json({
      success: true,
      message: `쿠팡 상품이 판매중지 상태로 변경되었습니다. (아이템 ${apiResult.totalCount}건)`,
      data: {
        requestSeq: seq,
        sellerProductId,
        vendorItemIds: apiResult.vendorItemIds
      }
    });
  } catch (error) {
    console.error('쿠팡 판매중지 오류:', {
      seq: req.params.seq,
      code: error.code,
      status: error.status,
      message: error.message
    });

    try {
      await saveCoupangSuspensionResult(
        req.params.seq,
        error.message || '쿠팡 판매중지 처리 중 오류가 발생했습니다.'
      );
    } catch (saveError) {
      console.error('쿠팡 판매중지 결과 저장 오류:', saveError);
    }

    const statusCode =
      Number.isInteger(error.status) && error.status >= 400 && error.status < 500
        ? 400
        : 500;

    return res.status(statusCode).json({
      success: false,
      message: error.message || '쿠팡 판매중지 처리 중 오류가 발생했습니다.'
    });
  }
});

// 지정 사유의 동일 gm_seq 다른 사용자 상품 일괄 판매중지
router.put('/:seq/stop-sale/related-products', async (req, res) => {
  try {
    const seq = Number.parseInt(String(req.params.seq), 10);
    if (!Number.isFinite(seq)) {
      return res.status(400).json({
        success: false,
        message: '삭제요청 번호가 올바르지 않습니다.'
      });
    }

    const pool = await getConnection();
    const sourceResult = await pool.request()
      .input('seq', sql.Int, seq)
      .query(`
        SELECT TOP 1
          A.seq,
          A.gu_seq,
          A.user_id,
          A.market_type,
          A.del_reason,
          B.gm_seq
        FROM tb_del_request A
        INNER JOIN tb_good_user B
          ON A.gu_seq = B.seq
        WHERE A.seq = @seq
      `);

    const source = sourceResult.recordset[0];
    if (!source) {
      return res.status(404).json({
        success: false,
        message: '삭제요청 상품을 찾을 수 없습니다.'
      });
    }
    if (!RELATED_SUSPENSION_REASONS.has(String(source.del_reason || '').trim())) {
      return res.status(400).json({
        success: false,
        message: '동일 상품 전체 판매중지 대상 삭제사유가 아닙니다.'
      });
    }

    // 다른 사용자의 동일 마스터 상품에도 삭제요청 행을 생성한다.
    // 기존 미처리 요청이 있으면 중복 생성하지 않고 해당 요청을 재사용한다.
    await pool.request()
      .input('sourceSeq', sql.Int, seq)
      .input('sourceGuSeq', sql.Int, source.gu_seq)
      .input('sourceUserId', sql.NVarChar, source.user_id)
      .input('gmSeq', sql.Int, source.gm_seq)
      .input('marketType', sql.NVarChar, source.market_type)
      .input('delReason', sql.NVarChar, source.del_reason)
      .query(`
        INSERT INTO tb_del_request (
          user_id,
          gu_seq,
          biz_idx,
          market_type,
          del_reason,
          del_type,
          input_date,
          dr_seq
        )
        SELECT
          GU.user_id,
          GU.seq,
          GU.biz_idx,
          @marketType,
          @delReason,
          N'연관삭제',
          GETDATE(),
          @sourceSeq
        FROM tb_good_user GU
        WHERE GU.gm_seq = @gmSeq
          AND GU.seq <> @sourceGuSeq
          AND GU.user_id <> @sourceUserId
          AND NOT EXISTS (
            SELECT 1
            FROM tb_del_request DR
            WHERE DR.gu_seq = GU.seq
              AND ISNULL(DR.del_yn, N'N') = N'N'
          )
      `);

    const targetsResult = await pool.request()
      .input('sourceGuSeq', sql.Int, source.gu_seq)
      .input('sourceUserId', sql.NVarChar, source.user_id)
      .input('gmSeq', sql.Int, source.gm_seq)
      .query(`
        SELECT
          GU.seq AS gu_seq,
          GU.user_id,
          GU.biz_idx,
          GU.product_id_ss,
          GU.product_id_cp,
          DR.seq AS request_seq,
          SS.client_id AS ss_client_id,
          SS.client_secret_sign AS ss_client_secret,
          CP.accessKey AS cp_access_key,
          CP.secretKey AS cp_secret_key
        FROM tb_good_user GU
        CROSS APPLY (
          SELECT TOP 1 R.seq
          FROM tb_del_request R
          WHERE R.gu_seq = GU.seq
            AND ISNULL(R.del_yn, N'N') = N'N'
          ORDER BY R.seq DESC
        ) DR
        LEFT OUTER JOIN tb_user_market_ss SS
          ON GU.user_id = SS.user_id
          AND GU.biz_idx = SS.biz_idx
        LEFT OUTER JOIN tb_user_market_cp CP
          ON GU.user_id = CP.user_id
          AND GU.biz_idx = CP.biz_idx
        WHERE GU.gm_seq = @gmSeq
          AND GU.seq <> @sourceGuSeq
          AND GU.user_id <> @sourceUserId
        ORDER BY GU.seq
      `);

    let smartStoreSuccessCount = 0;
    let coupangSuccessCount = 0;
    for (const target of targetsResult.recordset) {
      const result = await stopRelatedProductSale(target);
      if (result.smartStoreSuccess) smartStoreSuccessCount += 1;
      if (result.coupangSuccess) coupangSuccessCount += 1;
    }

    return res.json({
      success: true,
      message: `동일 상품의 다른 사용자 ${targetsResult.recordset.length}건 판매중지 처리가 완료되었습니다.`,
      data: {
        targetCount: targetsResult.recordset.length,
        smartStoreSuccessCount,
        coupangSuccessCount
      }
    });
  } catch (error) {
    console.error('동일 상품 다른 사용자 판매중지 오류:', {
      seq: req.params.seq,
      message: error.message
    });
    return res.status(500).json({
      success: false,
      message: error.message || '동일 상품 판매중지 처리 중 오류가 발생했습니다.'
    });
  }
});

// 전체 삭제 요청 API
router.post('/delete-all', async (req, res) => {
  try {
    const { seq } = req.body;
    
    if (!seq) {
      return res.status(400).json({
        success: false,
        message: '상품 SEQ가 필요합니다.'
      });
    }
    
    console.log('🗑️ 전체 삭제 요청 - seq:', seq);
    
    const pool = await getConnection();
    
    // 제공된 쿼리를 사용하여 전체 삭제 요청 추가
    const insertQuery = `
      INSERT INTO tb_del_request (user_id, gu_seq, biz_idx, market_type, del_reason, del_type, dr_seq) 
      SELECT 
           user_id 
         , seq
         , biz_idx 
         , (SELECT market_type FROM tb_del_request WHERE seq = @seq)
         , N'판매금지상품'
         , N'일괄삭제'
         , @seq
      FROM tb_good_user 
      WHERE gm_seq IN 
      (
        SELECT gm_seq
        FROM tb_del_request a 
        INNER JOIN tb_good_user b
                ON a.gu_seq = b.seq 
        WHERE a.seq = @seq
      )
      AND seq NOT IN (
        SELECT gu_seq 
        FROM tb_del_request 
        WHERE del_yn = 'N'
      )
    `;
    
    const result = await pool.request()
      .input('seq', sql.Int, seq)
      .query(insertQuery);
    
    console.log('🗑️ 전체 삭제 요청 완료 - 추가된 레코드 수:', result.rowsAffected[0]);

    // 전체삭제 요청 시 해당 항목의 삭제확인도 함께 처리
    await pool.request()
      .input('seq', sql.Int, seq)
      .query(`
        UPDATE tb_del_request
        SET del_confirm = 'Y'
        WHERE seq = @seq
      `);

    console.log('🗑️ 삭제확인 처리 완료 - seq:', seq);
    
    // tb_good_master 테이블 업데이트
    const updateMasterQuery = `
      UPDATE tb_good_master
      SET use_yn = 'N'
        , del_yn = 'Y'
      WHERE seq IN 
      (
        SELECT gm_seq
        FROM tb_del_request a 
        INNER JOIN tb_good_user b
                ON a.gu_seq = b.seq 
        WHERE a.seq = @seq
      )
    `;
    
    const updateResult = await pool.request()
      .input('seq', sql.Int, seq)
      .query(updateMasterQuery);
    
    console.log('🗑️ tb_good_master 업데이트 완료 - 영향받은 레코드 수:', updateResult.rowsAffected[0]);
    
    res.json({
      success: true,
      message: `전체 삭제 요청이 처리되었습니다. (${result.rowsAffected[0]}개 추가)`,
      count: result.rowsAffected[0]
    });
  } catch (error) {
    console.error('🗑️ 전체 삭제 요청 오류:', error);
    res.status(500).json({
      success: false,
      message: '전체 삭제 요청 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

module.exports = router;
