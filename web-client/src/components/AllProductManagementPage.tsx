import { useCallback, useEffect, useState } from 'react'
import { useAlert } from '../contexts/AlertContext'
import './AllProductManagementPage.css'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'
const API_URL = `${API_BASE}/api/all-products`
const DELETE_REQUEST_API_URL = `${API_BASE}/api/products/delete-request`
const DELETE_PRODUCT_API_URL = `${API_BASE}/api/delete-products`
const PRODUCT_CDN_BASE = 'https://c1b.co.kr/CDN'

interface AllProduct {
  seq: number
  good_name: string | null
  seller_cd: string | null
  t_url: string | null
  main_img_url: string | null
  t_img_url: string | null
  base_folder: string | null
  item_id: string | null
  mp_delv_Price: number | null
  input_date: string | null
  sale_cnt: number | null
  upload_cnt: number | null
}

interface UploadItem {
  seq: number
  user_id: string
  user_name: string | null
  biz_idx: string | null
  seller_cd: string | null
  good_name_ss: string | null
  result_ss: string | null
  result_cp: string | null
  display_id_ss: string | null
  display_id_cp: string | null
  store_id: string | null
  use_yn: string | null
  get_date: string | null
  del_date: string | null
}

interface AdminDeleteProgressItem {
  seq: number
  label: string
  status: 'waiting' | 'request' | 'smartstore' | 'coupang' | 'done' | 'warning' | 'error'
  detail?: string
}

const ADMIN_DELETE_STATUS_LABELS: Record<AdminDeleteProgressItem['status'], string> = {
  waiting: '대기',
  request: '삭제요청 저장 중',
  smartstore: '스마트스토어 판매중지 중',
  coupang: '쿠팡 판매중지 중',
  done: '완료',
  warning: '일부 실패',
  error: '실패'
}

type SortBy = 'recent' | 'oldest' | 'sales' | 'uploads'

function AllProductManagementPage() {
  const { showAlert } = useAlert()
  const [productCodeInput, setProductCodeInput] = useState('')
  const [productNameInput, setProductNameInput] = useState('')
  const [productCode, setProductCode] = useState('')
  const [productName, setProductName] = useState('')
  const [soldOnly, setSoldOnly] = useState(false)
  const [excludeReturnCancel, setExcludeReturnCancel] = useState(false)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [sortBy, setSortBy] = useState<SortBy>('recent')
  const [products, setProducts] = useState<AllProduct[]>([])
  const [loading, setLoading] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [totalCount, setTotalCount] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [enlargedImage, setEnlargedImage] = useState<string | null>(null)
  const [imageErrors, setImageErrors] = useState<Set<number>>(new Set())
  const [uploadPopupProduct, setUploadPopupProduct] = useState<AllProduct | null>(null)
  const [uploadItems, setUploadItems] = useState<UploadItem[]>([])
  const [uploadLoading, setUploadLoading] = useState(false)
  const [checkedUploadSeqs, setCheckedUploadSeqs] = useState<Set<number>>(new Set())
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteMarket, setDeleteMarket] = useState('')
  const [deleteReason, setDeleteReason] = useState('')
  const [customReason, setCustomReason] = useState('')
  const [deleteSubmitting, setDeleteSubmitting] = useState(false)
  const [adminDeleteProgress, setAdminDeleteProgress] = useState<AdminDeleteProgressItem[] | null>(
    null
  )

  const loadProducts = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: String(currentPage),
        limit: String(pageSize),
        sortBy
      })

      if (productCode) params.set('productCode', productCode)
      if (productName) params.set('productName', productName)
      if (soldOnly) params.set('soldOnly', '1')
      if (excludeReturnCancel) params.set('excludeReturnCancel', '1')
      if (dateFrom) params.set('dateFrom', dateFrom)
      if (dateTo) params.set('dateTo', dateTo)

      const response = await fetch(`${API_URL}?${params.toString()}`)
      const result = await response.json().catch(() => null)

      if (!response.ok || !result?.success) {
        throw new Error(result?.message || `HTTP ${response.status}`)
      }

      setProducts(result.data || [])
      setTotalCount(Number(result.pagination?.totalCount || 0))
      setTotalPages(Number(result.pagination?.totalPages || 0))
    } catch (error) {
      console.error('상품전체관리 조회 오류:', error)
      await showAlert(
        error instanceof Error ? error.message : '전체 상품 목록을 불러오는 중 오류가 발생했습니다.'
      )
    } finally {
      setLoading(false)
    }
  }, [
    currentPage,
    dateFrom,
    dateTo,
    excludeReturnCancel,
    pageSize,
    productCode,
    productName,
    showAlert,
    soldOnly,
    sortBy
  ])

  useEffect(() => {
    void loadProducts()
  }, [loadProducts])

  const handleSearch = () => {
    const nextCode = productCodeInput.trim()
    const nextName = productNameInput.trim()
    if (currentPage === 1 && nextCode === productCode && nextName === productName) {
      void loadProducts()
      return
    }
    setProductCode(nextCode)
    setProductName(nextName)
    setCurrentPage(1)
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') handleSearch()
  }

  const openUploadPopup = async (product: AllProduct) => {
    setUploadPopupProduct(product)
    setUploadItems([])
    setCheckedUploadSeqs(new Set())
    setUploadLoading(true)
    try {
      const response = await fetch(`${API_URL}/${product.seq}/uploads`)
      const result = await response.json().catch(() => null)
      if (!response.ok || !result?.success) {
        throw new Error(result?.message || `HTTP ${response.status}`)
      }
      setUploadItems(result.data || [])
    } catch (error) {
      console.error('업로드 내역 조회 오류:', error)
      setUploadPopupProduct(null)
      await showAlert(
        error instanceof Error ? error.message : '업로드 내역을 불러오는 중 오류가 발생했습니다.'
      )
    } finally {
      setUploadLoading(false)
    }
  }

  const closeUploadPopup = () => {
    setUploadPopupProduct(null)
    setUploadItems([])
    setCheckedUploadSeqs(new Set())
  }

  // 마켓 상품 페이지 열기 (상품관리와 동일한 팝업 방식)
  const openMarketPage = (url: string, marketName: string) => {
    window.open(url, `${marketName}_popup`, 'width=1000,height=800,scrollbars=yes,resizable=yes')
  }

  const getUploadSmartStoreUrl = (item: UploadItem) => {
    if (!item.store_id || !item.display_id_ss) return null
    return `https://smartstore.naver.com/${item.store_id}/products/${item.display_id_ss}`
  }

  const getUploadCoupangUrl = (item: UploadItem) => {
    if (!item.display_id_cp) return null
    return `http://www.coupang.com/vp/products/${item.display_id_cp}`
  }

  const toggleUploadCheck = (seq: number) => {
    setCheckedUploadSeqs((current) => {
      const next = new Set(current)
      if (next.has(seq)) next.delete(seq)
      else next.add(seq)
      return next
    })
  }

  // 삭제요청 가능한 행: 아직 삭제되지 않은 업로드만
  const deletableUploadItems = uploadItems.filter((item) => !item.del_date)

  const toggleUploadCheckAll = () => {
    setCheckedUploadSeqs((current) => {
      if (deletableUploadItems.length > 0 && current.size === deletableUploadItems.length) {
        return new Set()
      }
      return new Set(deletableUploadItems.map((item) => item.seq))
    })
  }

  // 삭제요청 모달 열기
  const openDeleteModal = async () => {
    if (checkedUploadSeqs.size === 0) {
      await showAlert('삭제요청할 상품을 선택해주세요.')
      return
    }
    setDeleteMarket('')
    setDeleteReason('')
    setCustomReason('')
    setShowDeleteModal(true)
  }

  // 삭제요청 모달 닫기
  const closeDeleteModal = () => {
    setShowDeleteModal(false)
    setDeleteMarket('')
    setDeleteReason('')
    setCustomReason('')
  }

  const updateAdminDeleteProgress = (
    seq: number,
    status: AdminDeleteProgressItem['status'],
    detail?: string
  ) => {
    setAdminDeleteProgress((current) =>
      current?.map((item) => (item.seq === seq ? { ...item, status, detail } : item)) || null
    )
  }

  // 선택된 업로드 행 전체 삭제요청 (상품관리 삭제요청과 동일한 API 사용)
  const handleDeleteRequest = async () => {
    if (!deleteMarket) {
      await showAlert('마켓을 선택해주세요.')
      return
    }

    if (!deleteReason) {
      await showAlert('삭제사유를 선택해주세요.')
      return
    }

    if (deleteReason === '기타' && !customReason.trim()) {
      await showAlert('삭제사유를 입력해주세요.')
      return
    }

    const targets = uploadItems.filter((item) => checkedUploadSeqs.has(item.seq))
    if (targets.length === 0) {
      await showAlert('삭제요청할 상품을 선택해주세요.')
      return
    }

    try {
      setDeleteSubmitting(true)
      const finalReason = deleteReason === '기타' ? customReason.trim() : deleteReason
      const failed: string[] = []

      setAdminDeleteProgress(
        targets.map((item) => ({
          seq: item.seq,
          label: `${item.user_name || item.user_id} / ${item.seller_cd || item.seq}`,
          status: 'waiting'
        }))
      )

      for (const item of targets) {
        try {
          updateAdminDeleteProgress(item.seq, 'request', '삭제요청 저장 중')
          const response = await fetch(DELETE_REQUEST_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              user_id: item.user_id,
              gu_seq: item.seq,
              biz_idx: item.biz_idx,
              market_type: deleteMarket,
              del_reason: finalReason,
              del_type: '관리자삭제'
            })
          })
          const result = await response.json().catch(() => null)
          if (!response.ok || !result?.success) {
            throw new Error(result?.message || `삭제요청 실패 (HTTP ${response.status})`)
          }

          const deleteRequestSeq = Number(result.data?.deleteRequestSeq)
          if (!Number.isFinite(deleteRequestSeq)) {
            throw new Error('삭제요청 번호를 확인할 수 없습니다.')
          }

          const callStopSale = async (market: 'smartstore' | 'coupang') => {
            const stopResponse = await fetch(
              `${DELETE_PRODUCT_API_URL}/${deleteRequestSeq}/stop-sale/${market}`,
              {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' }
              }
            )
            const stopResult = await stopResponse.json().catch(() => null)
            if (!stopResponse.ok || !stopResult?.success) {
              return stopResult?.message || `HTTP ${stopResponse.status}`
            }
            return null
          }

          updateAdminDeleteProgress(item.seq, 'smartstore', '스마트스토어 판매중지 중')
          const ssError = await callStopSale('smartstore')

          updateAdminDeleteProgress(
            item.seq,
            'coupang',
            `쿠팡 판매중지 중 / 스마트스토어: ${ssError ? '실패' : '완료'}`
          )
          const cpError = await callStopSale('coupang')

          if (ssError || cpError) {
            const detail = [
              `스스: ${ssError ? `실패(${ssError})` : '완료'}`,
              `쿠팡: ${cpError ? `실패(${cpError})` : '완료'}`
            ].join(', ')
            updateAdminDeleteProgress(item.seq, 'warning', detail)
            failed.push(`${item.seller_cd || item.seq}: ${detail}`)
          } else {
            updateAdminDeleteProgress(item.seq, 'done', '삭제요청 및 판매중지 완료')
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : '처리 중 오류'
          updateAdminDeleteProgress(item.seq, 'error', message)
          failed.push(`${item.seller_cd || item.seq}: ${message}`)
        }
      }

      // 완료 결과를 잠시 확인할 수 있도록 한 렌더링 사이클을 보장한다.
      await new Promise((resolve) => setTimeout(resolve, 500))
      setAdminDeleteProgress(null)

      if (failed.length === 0) {
        await showAlert(
          `선택한 ${targets.length}건의 삭제요청 및 스마트스토어/쿠팡 판매중지가 완료되었습니다.`
        )
      } else {
        await showAlert(
          `${targets.length}건 처리가 완료되었습니다.\n오류 또는 일부 실패:\n${failed.join('\n')}`
        )
      }

      closeDeleteModal()
      if (uploadPopupProduct) {
        await openUploadPopup(uploadPopupProduct)
      }
    } finally {
      setDeleteSubmitting(false)
      setAdminDeleteProgress(null)
    }
  }

  const getImageUrl = (product: AllProduct) => {
    if (product.base_folder && product.item_id && product.main_img_url) {
      return `${PRODUCT_CDN_BASE}/${product.base_folder}/${product.item_id}/${product.main_img_url}`
    }
    return product.t_img_url || null
  }

  const getPageNumbers = () => {
    const maxVisible = 5
    let start = Math.max(1, currentPage - Math.floor(maxVisible / 2))
    const end = Math.min(totalPages, start + maxVisible - 1)
    start = Math.max(1, end - maxVisible + 1)
    return Array.from({ length: Math.max(0, end - start + 1) }, (_, index) => start + index)
  }

  return (
    <div className="all-product-page">
      <div className="all-product-page-header">
        <h1>📦 상품전체관리</h1>
      </div>

      <div className="all-product-search">
        <div className="all-product-filter-row">
          <label>
            <span>상품코드</span>
            <input
              value={productCodeInput}
              onChange={(event) => setProductCodeInput(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="C1B 코드 검색"
            />
          </label>
          <label>
            <span>상품명</span>
            <input
              value={productNameInput}
              onChange={(event) => setProductNameInput(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="마스터 상품명 검색"
            />
          </label>
          <button className="all-product-search-btn" onClick={handleSearch}>
            검색
          </button>
        </div>
      </div>

      <div className="all-product-toolbar">
        <div className="all-product-toolbar-main">
          <strong>전체 {totalCount.toLocaleString()}개</strong>
          <label className="all-product-check">
            <input
              type="checkbox"
              checked={soldOnly}
              onChange={(event) => {
                setSoldOnly(event.target.checked)
                if (!event.target.checked) setExcludeReturnCancel(false)
                setCurrentPage(1)
              }}
            />
            판매상품만 보기
          </label>
          <label className={`all-product-check ${soldOnly ? '' : 'disabled'}`}>
            <input
              type="checkbox"
              checked={excludeReturnCancel}
              disabled={!soldOnly}
              onChange={(event) => {
                setExcludeReturnCancel(event.target.checked)
                setCurrentPage(1)
              }}
            />
            반품·취소 제외
          </label>
          <span className="all-product-date-label">등록일자</span>
          <input
            className="all-product-date"
            type="date"
            value={dateFrom}
            onChange={(event) => {
              setDateFrom(event.target.value)
              setCurrentPage(1)
            }}
          />
          <span>~</span>
          <input
            className="all-product-date"
            type="date"
            value={dateTo}
            onChange={(event) => {
              setDateTo(event.target.value)
              setCurrentPage(1)
            }}
          />
          {(dateFrom || dateTo) && (
            <button
              className="all-product-reset-btn"
              onClick={() => {
                setDateFrom('')
                setDateTo('')
                setCurrentPage(1)
              }}
            >
              초기화
            </button>
          )}
          <select
            className="all-product-sort"
            value={sortBy}
            onChange={(event) => {
              setSortBy(event.target.value as SortBy)
              setCurrentPage(1)
            }}
          >
            <option value="recent">최근 등록 순</option>
            <option value="oldest">오래된 등록 순</option>
            <option value="sales">판매 많은 순</option>
            <option value="uploads">업로드 많은 순</option>
          </select>
        </div>
        <label className="all-product-page-size">
          페이지당 표시:
          <select
            value={pageSize}
            onChange={(event) => {
              setPageSize(Number(event.target.value))
              setCurrentPage(1)
            }}
          >
            <option value={20}>20개</option>
            <option value={30}>30개</option>
            <option value={50}>50개</option>
          </select>
        </label>
      </div>

      <div className="all-product-list-wrap">
        {loading && (
          <div className="all-product-loading">
            <div className="all-product-spinner" />
          </div>
        )}

        {products.length === 0 ? (
          <div className="all-product-empty">조회된 상품이 없습니다.</div>
        ) : (
          <div className="all-product-list">
            {products.map((product) => {
              const imageUrl = getImageUrl(product)
              return (
                <article className="all-product-card" key={product.seq}>
                  <button
                    type="button"
                    className="all-product-image"
                    disabled={!imageUrl || imageErrors.has(product.seq)}
                    onClick={() => imageUrl && setEnlargedImage(imageUrl)}
                  >
                    {imageUrl && !imageErrors.has(product.seq) ? (
                      <img
                        src={imageUrl}
                        alt={product.good_name || '상품 이미지'}
                        onError={() =>
                          setImageErrors((current) => new Set(current).add(product.seq))
                        }
                      />
                    ) : (
                      <span>📦</span>
                    )}
                  </button>

                  <div className="all-product-info">
                    <div className="all-product-name">{product.good_name || '상품명 없음'}</div>
                    <div className="all-product-meta">
                      <div>
                        <span>🏷️ C1B 코드:</span>
                        <strong>{product.seller_cd || '-'}</strong>
                      </div>
                      <div>
                        <span>💰 예상배송비:</span>
                        <strong>{Number(product.mp_delv_Price || 0).toLocaleString()}원</strong>
                      </div>
                      <div>
                        <span>📊 판매건수:</span>
                        <strong>{Number(product.sale_cnt || 0).toLocaleString()}건</strong>
                      </div>
                      <div>
                        <span>⬆️ 업로드 건수:</span>
                        {Number(product.upload_cnt || 0) > 0 ? (
                          <button
                            type="button"
                            className="all-product-upload-link"
                            onClick={() => void openUploadPopup(product)}
                            title="클릭하면 업로드된 상품 리스트가 표시됩니다."
                          >
                            {Number(product.upload_cnt || 0).toLocaleString()}건
                          </button>
                        ) : (
                          <strong>0건</strong>
                        )}
                      </div>
                      <div>
                        <span>📅 등록일자:</span>
                        <strong>{product.input_date ? product.input_date.substring(0, 16) : '-'}</strong>
                      </div>
                    </div>
                  </div>

                  <div className="all-product-actions">
                    <button
                      type="button"
                      disabled={!product.t_url}
                      onClick={() =>
                        product.t_url &&
                        window.open(
                          product.t_url,
                          'taobao_product_popup',
                          'width=1000,height=800,scrollbars=yes,resizable=yes'
                        )
                      }
                    >
                      타오바오
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="all-product-pagination">
          <button onClick={() => setCurrentPage(1)} disabled={currentPage === 1}>처음</button>
          <button onClick={() => setCurrentPage(currentPage - 1)} disabled={currentPage === 1}>이전</button>
          {getPageNumbers().map((page) => (
            <button
              key={page}
              className={currentPage === page ? 'active' : ''}
              onClick={() => setCurrentPage(page)}
            >
              {page}
            </button>
          ))}
          <button onClick={() => setCurrentPage(currentPage + 1)} disabled={currentPage === totalPages}>다음</button>
          <button onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages}>마지막</button>
        </div>
      )}

      {enlargedImage && (
        <div className="all-product-image-modal" onClick={() => setEnlargedImage(null)}>
          <button type="button" aria-label="닫기">×</button>
          <img src={enlargedImage} alt="확대 상품 이미지" />
        </div>
      )}

      {uploadPopupProduct && (
        <div className="all-product-upload-modal-overlay" onClick={closeUploadPopup}>
          <div
            className="all-product-upload-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="all-product-upload-modal-header">
              <h3>업로드된 상품 리스트 ({uploadItems.length.toLocaleString()}건)</h3>
              <button type="button" onClick={closeUploadPopup} aria-label="닫기">✕</button>
            </div>
            <p className="all-product-upload-modal-product" title={uploadPopupProduct.good_name || ''}>
              {uploadPopupProduct.good_name || '상품명 없음'}
            </p>
            {!uploadLoading && uploadItems.length > 0 && (
              <div className="all-product-upload-modal-toolbar">
                <span>선택 {checkedUploadSeqs.size.toLocaleString()}건</span>
                <button
                  type="button"
                  className="all-product-upload-delete-btn"
                  onClick={() => void openDeleteModal()}
                  disabled={checkedUploadSeqs.size === 0}
                >
                  삭제요청
                </button>
              </div>
            )}
            <div className="all-product-upload-modal-body">
              {uploadLoading ? (
                <div className="all-product-loading" style={{ position: 'static' }}>
                  <div className="all-product-spinner" />
                </div>
              ) : uploadItems.length === 0 ? (
                <div className="all-product-empty" style={{ border: 'none' }}>
                  업로드된 상품이 없습니다.
                </div>
              ) : (
                <table className="all-product-upload-table">
                  <thead>
                    <tr>
                      <th>순번</th>
                      <th>
                        <input
                          type="checkbox"
                          checked={
                            deletableUploadItems.length > 0 &&
                            checkedUploadSeqs.size === deletableUploadItems.length
                          }
                          disabled={deletableUploadItems.length === 0}
                          onChange={toggleUploadCheckAll}
                          title="전체 선택/해제"
                        />
                      </th>
                      <th>사용자</th>
                      <th>C1B 코드</th>
                      <th>상품명</th>
                      <th>스스</th>
                      <th>쿠팡</th>
                      <th>업로드일</th>
                      <th>삭제일</th>
                    </tr>
                  </thead>
                  <tbody>
                    {uploadItems.map((item, index) => (
                      <tr key={item.seq}>
                        <td>{index + 1}</td>
                        <td>
                          <input
                            type="checkbox"
                            checked={checkedUploadSeqs.has(item.seq)}
                            disabled={!!item.del_date}
                            title={item.del_date ? '이미 삭제된 상품입니다.' : undefined}
                            onChange={() => toggleUploadCheck(item.seq)}
                          />
                        </td>
                        <td>
                          {item.user_name ? `${item.user_name}(${item.user_id})` : item.user_id}
                        </td>
                        <td>{item.seller_cd || '-'}</td>
                        <td className="upload-name-cell" title={item.good_name_ss || ''}>
                          {item.good_name_ss || '-'}
                        </td>
                        <td>
                          {item.result_ss === '성공' && getUploadSmartStoreUrl(item) ? (
                            <button
                              type="button"
                              className="all-product-market-link"
                              title="스마트스토어 상품 페이지 열기"
                              onClick={() => openMarketPage(getUploadSmartStoreUrl(item)!, '스마트스토어')}
                            >
                              성공
                            </button>
                          ) : (
                            item.result_ss || '-'
                          )}
                        </td>
                        <td>
                          {item.result_cp === '성공' && getUploadCoupangUrl(item) ? (
                            <button
                              type="button"
                              className="all-product-market-link"
                              title="쿠팡 상품 페이지 열기"
                              onClick={() => openMarketPage(getUploadCoupangUrl(item)!, '쿠팡')}
                            >
                              성공
                            </button>
                          ) : (
                            item.result_cp || '-'
                          )}
                        </td>
                        <td>{item.get_date ? item.get_date.substring(0, 16) : '-'}</td>
                        <td>{item.del_date ? item.del_date.substring(0, 16) : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div className="all-product-upload-modal-footer">
              <button type="button" onClick={closeUploadPopup}>닫기</button>
            </div>
          </div>
        </div>
      )}

      {/* 삭제요청 모달 (상품관리 삭제요청 팝업과 동일) */}
      {showDeleteModal && uploadPopupProduct && (
        <div className="delete-modal-overlay" style={{ zIndex: 10000 }}>
          <div className="delete-modal-content">
            <div className="delete-modal-header">
              <h2>삭제요청</h2>
              <button className="delete-modal-close" onClick={closeDeleteModal}>✕</button>
            </div>

            <div className="delete-modal-body">
              {/* 선택 상품 정보 표시 */}
              <div className="delete-product-info">
                <p><strong>상품명:</strong> {uploadPopupProduct.good_name || '상품명 없음'}</p>
                <p><strong>C1B 코드:</strong> {uploadPopupProduct.seller_cd || '-'}</p>
                <p><strong>선택 건수:</strong> {checkedUploadSeqs.size.toLocaleString()}건</p>
              </div>

              <div className="delete-modal-warning" role="note">
                <p className="delete-modal-warning-title">주의</p>
                <p className="delete-modal-warning-text">
                  스마트스토어와 쿠팡에 상품 모두 삭제 됩니다.
                  <br />
                  단.소명 요청 관련 상품은 관리자가 검토 후 삭제 됩니다.
                </p>
              </div>

              {/* 마켓 */}
              <div className="delete-form-group">
                <label className="delete-form-label emphasis">마켓 (소명 요청 받은 마켓 선택)</label>
                <select
                  className="delete-select"
                  value={deleteMarket}
                  onChange={(e) => setDeleteMarket(e.target.value)}
                >
                  <option value="">선택하기</option>
                  <option value="SS">스마트스토어</option>
                  <option value="CP">쿠팡</option>
                  <option value="NONE">없음</option>
                </select>
              </div>

              {/* 삭제사유 */}
              <div className="delete-form-group">
                <label className="delete-form-label emphasis">삭제사유</label>
                <select
                  className="delete-select"
                  value={deleteReason}
                  onChange={(e) => {
                    setDeleteReason(e.target.value)
                    if (e.target.value !== '기타') {
                      setCustomReason('')
                    }
                  }}
                >
                  <option value="">선택하기</option>
                  <option value="지재권 신고 상품">지재권 신고 상품</option>
                  <option value="유통경로 요청 상품">유통경로 요청 상품</option>
                  <option value="불법(통관불가) 상품">불법(통관불가) 상품</option>
                  <option value="역마진 상품">역마진 상품</option>
                  <option value="품절 상품">품절 상품</option>
                  <option value="상품명과 상품내용 다른 상품">상품명과 상품내용 다른 상품</option>
                  <option value="KC인증 요청 상품">KC인증 요청 상품</option>
                  <option value="기타">기타</option>
                </select>
              </div>

              {/* 기타 사유 직접 입력 */}
              {deleteReason === '기타' && (
                <div className="delete-form-group">
                  <label className="delete-form-label">사유 입력</label>
                  <textarea
                    className="delete-textarea"
                    placeholder="삭제 사유를 입력해주세요"
                    value={customReason}
                    onChange={(e) => setCustomReason(e.target.value)}
                    rows={3}
                  />
                </div>
              )}
            </div>

            <div className="delete-modal-footer">
              <button className="delete-modal-btn cancel" onClick={closeDeleteModal} disabled={deleteSubmitting}>
                취소
              </button>
              <button className="delete-modal-btn submit" onClick={() => void handleDeleteRequest()} disabled={deleteSubmitting}>
                {deleteSubmitting ? '요청 중...' : '요청'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 선택 상품 순차 삭제요청/판매중지 진행상태 */}
      {adminDeleteProgress && (
        <div className="admin-delete-progress-overlay" role="status" aria-live="polite">
          <div className="admin-delete-progress-modal">
            <div className="admin-delete-progress-header">
              <div className="admin-delete-progress-spinner" />
              <div>
                <strong>선택 상품 판매중지 처리 중</strong>
                <p>
                  완료 {adminDeleteProgress.filter((item) =>
                    ['done', 'warning', 'error'].includes(item.status)
                  ).length}
                  {' / '}
                  {adminDeleteProgress.length}건
                </p>
              </div>
            </div>
            <div className="admin-delete-progress-list">
              {adminDeleteProgress.map((item, index) => (
                <div
                  key={item.seq}
                  className={`admin-delete-progress-row ${item.status}`}
                >
                  <span className="admin-delete-progress-number">{index + 1}</span>
                  <div className="admin-delete-progress-info">
                    <strong title={item.label}>{item.label}</strong>
                    <small title={item.detail}>{item.detail || ADMIN_DELETE_STATUS_LABELS[item.status]}</small>
                  </div>
                  <span className="admin-delete-progress-status">
                    {ADMIN_DELETE_STATUS_LABELS[item.status]}
                  </span>
                </div>
              ))}
            </div>
            <small className="admin-delete-progress-notice">
              목록 순서대로 처리하고 있습니다. 완료될 때까지 창을 닫지 마세요.
            </small>
          </div>
        </div>
      )}
    </div>
  )
}

export default AllProductManagementPage
