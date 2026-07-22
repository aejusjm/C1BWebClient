// 관리자 상품전체관리 API
const express = require('express');
const router = express.Router();
const { getConnection, sql } = require('../config/database');

const parseBoolean = (value) =>
  String(value) === '1' || String(value).toLowerCase() === 'true';

const cleanProductCode = (value) => {
  let code = String(value || '').trim();
  const prefix = ['C1-', 'C2-', 'C3-', 'P1-', 'P2-', 'P3-'].find((item) =>
    code.toUpperCase().startsWith(item)
  );

  if (prefix) code = code.substring(prefix.length);
  if (/^C\d/i.test(code)) code = code.substring(1);
  return code;
};

// 사용자와 관계없이 tb_good_master의 모든 상품 조회
router.get('/', async (req, res) => {
  try {
    const {
      productCode,
      productName,
      soldOnly,
      excludeReturnCancel,
      dateFrom,
      dateTo,
      sortBy = 'recent',
      page = 1,
      limit = 20
    } = req.query;

    const pageNum = Math.max(1, Number.parseInt(String(page), 10) || 1);
    const requestedLimit = Number.parseInt(String(limit), 10) || 20;
    const limitNum = [20, 30, 50].includes(requestedLimit) ? requestedLimit : 20;
    const offset = (pageNum - 1) * limitNum;
    const excludeRC = parseBoolean(excludeReturnCancel);

    const pool = await getConnection();
    const countRequest = pool.request();
    const dataRequest = pool.request();
    const conditions = ['M.seq < 262250'];

    const code = cleanProductCode(productCode);
    if (code) {
      conditions.push(`(
        CONVERT(NVARCHAR(20), M.seq) LIKE @productCode
        OR EXISTS (
          SELECT 1
          FROM tb_good_user GU_CODE
          WHERE GU_CODE.gm_seq = M.seq
            AND GU_CODE.seller_cd LIKE @productCode
        )
      )`);
      countRequest.input('productCode', sql.NVarChar, `%${code}%`);
      dataRequest.input('productCode', sql.NVarChar, `%${code}%`);
    }

    const name = String(productName || '').trim();
    if (name) {
      conditions.push('M.good_name LIKE @productName');
      countRequest.input('productName', sql.NVarChar, `%${name}%`);
      dataRequest.input('productName', sql.NVarChar, `%${name}%`);
    }

    const from = String(dateFrom || '').trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(from)) {
      conditions.push('M.input_date >= @dateFrom');
      countRequest.input('dateFrom', sql.Date, from);
      dataRequest.input('dateFrom', sql.Date, from);
    }

    const to = String(dateTo || '').trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      conditions.push('M.input_date < DATEADD(DAY, 1, @dateTo)');
      countRequest.input('dateTo', sql.Date, to);
      dataRequest.input('dateTo', sql.Date, to);
    }

    const orderStatusCondition = excludeRC
      ? `AND O.order_status NOT IN ('RETURNED', 'CANCELED')`
      : '';

    if (parseBoolean(soldOnly)) {
      conditions.push(`EXISTS (
        SELECT 1
        FROM tb_order_info O
        WHERE TRY_CAST(RIGHT(O.seller_cd, 7) AS INT) = M.seq
          ${orderStatusCondition}
      )`);
    }

    const whereClause = conditions.join('\n        AND ');
    const countResult = await countRequest.query(`
      SELECT COUNT(*) AS total
      FROM tb_good_master M
      WHERE ${whereClause}
    `);

    // 판매/업로드 순 정렬은 행 단위 상관 서브쿼리로 정렬하면 대량 데이터에서
    // 타임아웃이 발생하므로, GROUP BY 사전 집계와 LEFT JOIN 후 정렬한다.
    let aggJoin = '';
    let orderBy = 'M.input_date DESC, M.seq DESC';
    if (sortBy === 'oldest') {
      orderBy = 'M.input_date ASC, M.seq ASC';
    } else if (sortBy === 'uploads') {
      aggJoin = `
        LEFT JOIN (
          SELECT gm_seq, COUNT(*) AS agg_cnt
          FROM tb_good_user
          GROUP BY gm_seq
        ) AGG ON AGG.gm_seq = M.seq
      `;
      orderBy = 'COALESCE(AGG.agg_cnt, 0) DESC, M.seq DESC';
    } else if (sortBy === 'sales') {
      aggJoin = `
        LEFT JOIN (
          SELECT TRY_CAST(RIGHT(seller_cd, 7) AS INT) AS gm_seq, COUNT(*) AS agg_cnt
          FROM tb_order_info
          WHERE 1 = 1 ${orderStatusCondition.replace(/O\./g, '')}
          GROUP BY TRY_CAST(RIGHT(seller_cd, 7) AS INT)
        ) AGG ON AGG.gm_seq = M.seq
      `;
      orderBy = 'COALESCE(AGG.agg_cnt, 0) DESC, M.seq DESC';
    }

    dataRequest.input('offset', sql.Int, offset);
    dataRequest.input('limit', sql.Int, limitNum);
    const dataResult = await dataRequest.query(`
      WITH PAGE_KEYS AS (
        SELECT M.seq
        FROM tb_good_master M
        ${aggJoin}
        WHERE ${whereClause}
        ORDER BY ${orderBy}
        OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
      )
      SELECT
        M.seq,
        M.good_name,
        M.t_url,
        M.t_img_url,
        M.main_img_url,
        M.base_folder,
        M.item_id,
        M.mp_delv_Price,
        CONVERT(VARCHAR(19), M.input_date, 120) AS input_date,
        COALESCE(CODE.seller_cd, CONCAT('C', RIGHT(CONCAT('0000000', M.seq), 7))) AS seller_cd,
        COALESCE(UPLOADS.upload_cnt, 0) AS upload_cnt,
        COALESCE(SALES.sale_cnt, 0) AS sale_cnt
      FROM PAGE_KEYS K
      INNER JOIN tb_good_master M
        ON M.seq = K.seq
      OUTER APPLY (
        SELECT TOP 1 GU.seller_cd
        FROM tb_good_user GU
        WHERE GU.gm_seq = M.seq
          AND NULLIF(LTRIM(RTRIM(GU.seller_cd)), '') IS NOT NULL
        ORDER BY GU.seq DESC
      ) CODE
      OUTER APPLY (
        SELECT COUNT(*) AS upload_cnt
        FROM tb_good_user GU
        WHERE GU.gm_seq = M.seq
      ) UPLOADS
      OUTER APPLY (
        SELECT COUNT(*) AS sale_cnt
        FROM tb_order_info O
        WHERE TRY_CAST(RIGHT(O.seller_cd, 7) AS INT) = M.seq
          ${orderStatusCondition}
      ) SALES
      ORDER BY ${sortBy === 'uploads' ? 'upload_cnt DESC, M.seq DESC'
        : sortBy === 'sales' ? 'sale_cnt DESC, M.seq DESC'
        : orderBy}
    `);

    const totalCount = Number(countResult.recordset[0]?.total || 0);
    res.json({
      success: true,
      data: dataResult.recordset,
      pagination: {
        currentPage: pageNum,
        pageSize: limitNum,
        totalCount,
        totalPages: Math.ceil(totalCount / limitNum)
      }
    });
  } catch (error) {
    console.error('상품전체관리 목록 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '전체 상품 목록을 불러오는 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 특정 마스터 상품의 업로드(tb_good_user) 내역 조회
router.get('/:gmSeq/uploads', async (req, res) => {
  try {
    const gmSeq = Number.parseInt(String(req.params.gmSeq), 10);
    if (!Number.isFinite(gmSeq)) {
      return res.status(400).json({
        success: false,
        message: '상품 번호가 올바르지 않습니다.'
      });
    }

    const pool = await getConnection();
    const result = await pool.request()
      .input('gmSeq', sql.Int, gmSeq)
      .query(`
        SELECT
          A.seq,
          A.user_id,
          D.user_name,
          A.biz_idx,
          A.seller_cd,
          A.good_name_ss,
          A.result_ss,
          A.result_cp,
          A.display_id_ss,
          A.display_id_cp,
          C.store_id,
          A.use_yn,
          CONVERT(VARCHAR(19), A.get_date, 120) AS get_date,
          CONVERT(VARCHAR(19), A.del_date, 120) AS del_date
        FROM tb_good_user A
        LEFT OUTER JOIN tb_user D
          ON A.user_id = D.user_id
        LEFT OUTER JOIN tb_user_market_ss C
          ON A.user_id = C.user_id
          AND A.biz_idx = C.biz_idx
        WHERE A.gm_seq = @gmSeq
        ORDER BY A.seq DESC
      `);

    res.json({
      success: true,
      data: result.recordset
    });
  } catch (error) {
    console.error('상품전체관리 업로드 내역 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '업로드 내역을 불러오는 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

module.exports = router;
