// 상품관리 페이지 컴포넌트 - 상품 목록 및 관리 기능
import { useState, useEffect } from 'react'
import { useUser } from '../contexts/UserContext'
import { useAlert } from '../contexts/AlertContext'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import './ProductPage.css'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'
const API_URL = `${API_BASE}/api/products`

/** 상품 썸네일 CDN: https://c1b.co.kr/CDN/{base_folder}/{item_id}/{main_img_url} */
const PRODUCT_CDN_BASE = 'https://c1b.co.kr/CDN'

interface Product {
  seq: number
  user_id: string
  good_name_ss: string
  seller_cd: string
  display_id_ss: string | null
  display_id_cp: string | null
  t_url: string | null
  t_img_url: string | null
  main_img_url: string | null
  base_folder: string | null
  item_id: string | null
  mp_delv_Price: number | null
  sale_cnt: number | null
  sale_cnt_ss: number | null
  sale_cnt_cp: number | null
  store_id: string | null
  biz_idx: string | null
  get_date: string | null
}

function ProductPage() {
  const { userInfo } = useUser()
  const { showAlert } = useAlert()
  
  // 검색 필터 상태
  const [productCode, setProductCode] = useState('')
  const [productName, setProductName] = useState('')
  const [soldOnly, setSoldOnly] = useState(false)
  const [soldMarket, setSoldMarket] = useState<'all' | 'ss' | 'cp'>('all')
  const [excludeReturnCancel, setExcludeReturnCancel] = useState(false)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [sortBy, setSortBy] = useState<'recent' | 'oldest' | 'sales'>('recent')
  const [showDateModal, setShowDateModal] = useState(false)
  const [tempDateFrom, setTempDateFrom] = useState<Date | null>(null)
  const [tempDateTo, setTempDateTo] = useState<Date | null>(null)
  // 이미지 확대 상태
  const [enlargedImage, setEnlargedImage] = useState<string | null>(null)
  // 상품 목록
  const [products, setProducts] = useState<Product[]>([])
  // 로딩 상태
  const [loading, setLoading] = useState(false)
  // 초기 로딩 상태 (첫 로드만 전체 화면 로딩 표시)
  const [initialLoading, setInitialLoading] = useState(true)
  // 페이징 상태
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [totalCount, setTotalCount] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  // 삭제요청 모달 상태
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [deleteReason, setDeleteReason] = useState('')
  const [customReason, setCustomReason] = useState('')
  // 이미지 로드 오류 상태
  const [imageErrors, setImageErrors] = useState<Set<number>>(new Set())

  // 컴포넌트 마운트 시 상품 목록 로드
  useEffect(() => {
    loadProducts()
  }, [currentPage, pageSize, soldOnly, soldMarket, excludeReturnCancel, dateFrom, dateTo, sortBy])

  // 상품 목록 로드
  const loadProducts = async (options?: { page?: number; limit?: number; soldOnly?: boolean; soldMarket?: 'all' | 'ss' | 'cp'; excludeReturnCancel?: boolean; dateFrom?: string; dateTo?: string; sortBy?: 'recent' | 'oldest' | 'sales' }) => {
    try {
      setLoading(true)
      const effectivePage = options?.page ?? currentPage
      const effectiveLimit = options?.limit ?? pageSize
      const effectiveSoldOnly = options?.soldOnly ?? soldOnly
      const effectiveSoldMarket = options?.soldMarket ?? soldMarket
      const effectiveExcludeReturnCancel = options?.excludeReturnCancel ?? excludeReturnCancel
      const effectiveDateFrom = options?.dateFrom ?? dateFrom
      const effectiveDateTo = options?.dateTo ?? dateTo
      const effectiveSortBy = options?.sortBy ?? sortBy

      let url = `${API_URL}/products/${userInfo.userId}?page=${effectivePage}&limit=${effectiveLimit}`
      
      if (productCode) {
        url += `&productCode=${encodeURIComponent(productCode)}`
      }
      
      if (productName) {
        url += `&productName=${encodeURIComponent(productName)}`
      }

      if (effectiveSoldOnly) {
        url += `&soldOnly=1`
        url += `&soldMarket=${effectiveSoldMarket}`
        if (effectiveExcludeReturnCancel) {
          url += `&excludeReturnCancel=1`
        }
      }

      if (effectiveDateFrom) {
        url += `&dateFrom=${encodeURIComponent(effectiveDateFrom)}`
      }

      if (effectiveDateTo) {
        url += `&dateTo=${encodeURIComponent(effectiveDateTo)}`
      }

      url += `&sortBy=${encodeURIComponent(effectiveSortBy)}`
      
      const response = await fetch(url)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const result = await response.json()
      
      console.log('상품 목록 응답:', result)
      
      if (result.success) {
        console.log('첫 번째 상품:', result.data[0])
        if (result.data[0]) {
          console.log('판매건수 데이터:', {
            sale_cnt: result.data[0].sale_cnt,
            sale_cnt_ss: result.data[0].sale_cnt_ss,
            sale_cnt_cp: result.data[0].sale_cnt_cp
          })
        }
        setProducts(result.data)
        setTotalCount(result.pagination.totalCount)
        setTotalPages(result.pagination.totalPages)
      } else {
        await showAlert(result.message || '상품 목록을 불러오는데 실패했습니다.')
      }
    } catch (error) {
      console.error('상품 목록 로드 오류:', error)
      await showAlert('상품 목록을 불러오는 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
      setInitialLoading(false)
    }
  }

  // 검색 기능
  const handleSearch = () => {
    // 검색 시 첫 페이지로
    if (currentPage === 1) {
      loadProducts({ page: 1 })
      return
    }
    setCurrentPage(1)
  }

  // 상품코드 엔터키 검색
  const handleProductCodeKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      setCurrentPage(1)
      loadProducts()
    }
  }

  // 상품명 엔터키 검색
  const handleProductNameKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      setCurrentPage(1)
      loadProducts()
    }
  }

  // 페이지 변경
  const handlePageChange = (page: number) => {
    setCurrentPage(page)
  }

  // 페이지 크기 변경
  const handlePageSizeChange = (size: number) => {
    setPageSize(size)
    setCurrentPage(1)
  }

  const handleSoldOnlyChange = (checked: boolean) => {
    setSoldOnly(checked)
    if (!checked) {
      setExcludeReturnCancel(false)
    }
    if (currentPage === 1) {
      loadProducts({
        page: 1,
        soldOnly: checked,
        excludeReturnCancel: checked ? undefined : false
      })
      return
    }
    setCurrentPage(1)
  }

  const formatDateToString = (date: Date): string => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const openDateModal = () => {
    const today = new Date()
    if (dateFrom && dateTo) {
      setTempDateFrom(new Date(dateFrom))
      setTempDateTo(new Date(dateTo))
    } else {
      // 기본값은 비어있지만, 모달 UX를 위해 열 때는 오늘로 프리셋
      setTempDateFrom(today)
      setTempDateTo(today)
    }
    setShowDateModal(true)
  }

  const closeDateModal = () => {
    setShowDateModal(false)
    setTempDateFrom(null)
    setTempDateTo(null)
  }

  const applyDateRange = async () => {
    if (!tempDateFrom || !tempDateTo) {
      await showAlert('시작일과 종료일을 모두 선택해주세요.')
      return
    }
    if (tempDateFrom > tempDateTo) {
      await showAlert('시작일은 종료일보다 이전이어야 합니다.')
      return
    }
    const fromStr = formatDateToString(tempDateFrom)
    const toStr = formatDateToString(tempDateTo)
    setDateFrom(fromStr)
    setDateTo(toStr)
    setShowDateModal(false)
    if (currentPage === 1) {
      loadProducts({ page: 1, dateFrom: fromStr, dateTo: toStr })
      return
    }
    setCurrentPage(1)
  }

  const clearDateRange = () => {
    setDateFrom('')
    setDateTo('')
    if (currentPage === 1) {
      loadProducts({ page: 1, dateFrom: '', dateTo: '' })
      return
    }
    setCurrentPage(1)
  }

  const handleSortChange = (value: 'recent' | 'oldest' | 'sales') => {
    setSortBy(value)
    if (currentPage === 1) {
      loadProducts({ page: 1, sortBy: value })
      return
    }
    setCurrentPage(1)
  }

  // 페이지 번호 생성
  const getPageNumbers = () => {
    const pages = []
    const maxVisible = 5
    let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2))
    let endPage = Math.min(totalPages, startPage + maxVisible - 1)
    
    if (endPage - startPage < maxVisible - 1) {
      startPage = Math.max(1, endPage - maxVisible + 1)
    }
    
    for (let i = startPage; i <= endPage; i++) {
      pages.push(i)
    }
    
    return pages
  }

  // 마켓 링크 열기 (팝업)
  const openMarketLink = async (url: string | null, marketName: string) => {
    if (!url) {
      await showAlert(`${marketName} 링크가 없습니다.`)
      return
    }
    
    // 팝업 창 열기 (가로 1000px, 세로 800px)
    window.open(
      url,
      `${marketName}_popup`,
      'width=1000,height=800,scrollbars=yes,resizable=yes'
    )
  }

  // 스마트스토어 링크 생성
  const getSmartStoreUrl = (storeId: string | null, displayId: string | null) => {
    if (!storeId || !displayId) return null
    return `https://smartstore.naver.com/${storeId}/products/${displayId}`
  }

  // 쿠팡 링크 생성
  const getCoupangUrl = (displayId: string | null) => {
    if (!displayId) return null
    return `http://www.coupang.com/vp/products/${displayId}`
  }

  // 삭제요청 모달 열기
  const openDeleteModal = (product: Product) => {
    setSelectedProduct(product)
    setDeleteReason('')
    setCustomReason('')
    setShowDeleteModal(true)
  }

  // 삭제요청 모달 닫기
  const closeDeleteModal = () => {
    setShowDeleteModal(false)
    setSelectedProduct(null)
    setDeleteReason('')
    setCustomReason('')
  }

  // 삭제요청 제출
  const handleDeleteRequest = async () => {
    if (!selectedProduct) return

    if (!deleteReason) {
      await showAlert('삭제사유를 선택해주세요.')
      return
    }

    // 기타 선택 시 직접 입력 확인
    if (deleteReason === '기타' && !customReason.trim()) {
      await showAlert('삭제사유를 입력해주세요.')
      return
    }

    try {
      const finalReason = deleteReason === '기타' ? customReason.trim() : deleteReason

      const response = await fetch(`${API_URL}/delete-request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          user_id: userInfo.userId,
          gu_seq: selectedProduct.seq,
          biz_idx: selectedProduct.biz_idx,
          del_reason: finalReason,
          del_type: '즉시삭제'
        })
      })

      const result = await response.json()

      if (result.success) {
        await showAlert('삭제요청이 완료되었습니다.')
        closeDeleteModal()
        loadProducts()
      } else {
        await showAlert(result.message || '삭제요청 중 오류가 발생했습니다.')
      }
    } catch (error) {
      console.error('삭제요청 오류:', error)
      await showAlert('삭제요청 중 오류가 발생했습니다.')
    }
  }

  // 이미지 로드 오류 처리
  const handleImageError = (productSeq: number) => {
    setImageErrors(prev => new Set(prev).add(productSeq))
  }

  // 이미지 URL을 프록시를 통해 안전하게 처리
  const getSafeImageUrl = (url: string | null): string | null => {
    if (!url) return null
    // 백엔드 프록시를 통해 이미지 로드 (CORS 및 SSL 문제 해결)
    return `${API_BASE}/api/image/proxy?url=${encodeURIComponent(url)}`
  }

  const trimPathSegment = (s: string) => String(s).replace(/^\/+/u, '').replace(/\/+$/u, '')

  /** CDN 경로가 있으면 우선 사용, 없으면 기존 t_img_url(프록시) */
  const getProductImageDisplayUrl = (product: Product): string | null => {
    const { base_folder, item_id, main_img_url, t_img_url } = product
    if (base_folder && item_id && main_img_url) {
      return `${PRODUCT_CDN_BASE}/${trimPathSegment(base_folder)}/${trimPathSegment(item_id)}/${trimPathSegment(main_img_url)}`
    }
    return getSafeImageUrl(t_img_url)
  }

  if (initialLoading) {
    return (
      <div className="product-page">
        <div className="product-page-header">
          <h1 className="page-title">📦 상품관리</h1>
        </div>
        <div style={{ textAlign: 'center', padding: '40px' }}>
          데이터를 불러오는 중입니다...
        </div>
      </div>
    )
  }

  return (
    <div className="product-page">
      {/* 페이지 헤더 */}
      <div className="product-page-header">
        <h1 className="page-title">📦 상품관리</h1>
      </div>

      {/* 검색 필터 */}
      <div className="search-filter">
        <div className="filter-row">
          <div className="filter-group">
            <label className="filter-label">상품코드:</label>
            <input 
              type="text"
              className="filter-input"
              value={productCode}
              onChange={(e) => setProductCode(e.target.value)}
              onKeyPress={handleProductCodeKeyPress}
              placeholder="상품코드 입력 (접두사 자동 제거)"
            />
          </div>
          <div className="filter-group">
            <label className="filter-label">상품명:</label>
            <input 
              type="text"
              className="filter-input"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              onKeyPress={handleProductNameKeyPress}
              placeholder="상품명 입력"
            />
          </div>
          <button className="search-btn" onClick={handleSearch}>
            상품검색
          </button>
        </div>
      </div>

      {/* 상품 개수 및 페이지 크기 선택 */}
      <div className="product-header">
        <div className="product-count">
          <span className="product-count-summary">
            전체 <strong>{totalCount.toLocaleString()}</strong>개 상품
          </span>
          <label className="product-count-sold-only" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700 }}>
            <input
              type="checkbox"
              checked={soldOnly}
              onChange={(e) => handleSoldOnlyChange(e.target.checked)}
            />
            판매상품만 보기
          </label>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              marginLeft: 8,
              fontWeight: 700,
              color: '#555'
            }}
            title="「판매상품만 보기」와 함께 사용하는 옵션입니다."
          >
            <span aria-hidden="true" style={{ color: '#888', userSelect: 'none' }}>
              (
            </span>
            <select
              value={soldMarket}
              onChange={(e) => {
                setSoldMarket(e.target.value as 'all' | 'ss' | 'cp')
                setCurrentPage(1)
              }}
              disabled={!soldOnly}
              title={soldOnly ? undefined : '「판매상품만 보기」를 켜면 선택할 수 있습니다.'}
              style={{
                padding: '4px 8px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '13px',
                cursor: soldOnly ? 'pointer' : 'not-allowed',
                opacity: soldOnly ? 1 : 0.55,
                background: soldOnly ? '#fff' : '#f5f5f5'
              }}
            >
              <option value="all">전체</option>
              <option value="ss">스마트스토어</option>
              <option value="cp">쿠팡</option>
            </select>
            <label
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontWeight: 700,
                opacity: soldOnly ? 1 : 0.55,
                cursor: soldOnly ? 'pointer' : 'not-allowed',
                color: '#333'
              }}
              title={soldOnly ? undefined : '「판매상품만 보기」를 켜면 선택할 수 있습니다.'}
            >
              <input
                type="checkbox"
                checked={excludeReturnCancel}
                disabled={!soldOnly}
                onChange={(e) => {
                  setExcludeReturnCancel(e.target.checked)
                  setCurrentPage(1)
                }}
              />
              반품·취소제외
            </label>
            <span aria-hidden="true" style={{ color: '#888', userSelect: 'none' }}>
              )
            </span>
          </span>
          <span style={{ marginLeft: 24, fontWeight: 700, color: '#555' }}>
            - 등록일자 :
            <span style={{ marginLeft: 10, fontWeight: 600, color: '#333' }}>
              {dateFrom && dateTo ? `${dateFrom} ~ ${dateTo}` : '전체'}
            </span>
          </span>
          <button
            className={`date-picker-btn ${dateFrom && dateTo ? 'active' : ''}`}
            style={{ marginLeft: 10 }}
            onClick={openDateModal}
          >
            📅 기간선택
          </button>
          {(dateFrom || dateTo) && (
            <button
              className="date-picker-btn"
              style={{ marginLeft: 6 }}
              onClick={clearDateRange}
            >
              초기화
            </button>
          )}
          <span style={{ marginLeft: 16, fontWeight: 700, color: '#555' }}>- 정렬기준</span>
          <select
            className="sort-select"
            value={sortBy}
            onChange={(e) => handleSortChange(e.target.value as 'recent' | 'oldest' | 'sales')}
            style={{ marginLeft: 8 }}
          >
            <option value="recent">최근 등록 순</option>
            <option value="oldest">오래된 등록 순</option>
            <option value="sales">판매 많은 순</option>
          </select>
        </div>
        <div className="page-size-selector">
          <label>페이지당 표시:</label>
          <select value={pageSize} onChange={(e) => handlePageSizeChange(Number(e.target.value))}>
            <option value={20}>20개</option>
            <option value={30}>30개</option>
            <option value={50}>50개</option>
          </select>
        </div>
      </div>

      {/* 상품 목록 */}
      <div className="product-list-container" style={{ position: 'relative' }}>
        {loading && (
          <div className="table-loading-overlay">
            <div className="loading-spinner"></div>
          </div>
        )}

        {products.length === 0 ? (
          <div className="no-products-message">
            등록된 상품이 없습니다.
          </div>
        ) : (
          <div className="product-list">
            {products.map((product) => {
              const displayUrl = getProductImageDisplayUrl(product)
              return (
              <div key={product.seq} className="product-card">
              {/* 상품 이미지 */}
              <div 
                className="product-image"
                onClick={() => {
                  if (displayUrl) setEnlargedImage(displayUrl)
                }}
              >
                {displayUrl && !imageErrors.has(product.seq) ? (
                  <img 
                    src={displayUrl} 
                    alt={product.good_name_ss}
                    onError={() => handleImageError(product.seq)}
                  />
                ) : (
                  <div className="image-placeholder">
                    {imageErrors.has(product.seq) ? '🚫' : '📦'}
                  </div>
                )}
                {displayUrl && !imageErrors.has(product.seq) && (
                  <div className="image-overlay">🔍</div>
                )}
              </div>

              {/* 상품 정보 및 마켓 버튼 */}
              <div className="product-info">
                <div className="product-details">
                  <div className="product-name">{product.good_name_ss || '상품명 없음'}</div>
                  <div className="product-meta-row">
                    <div className="product-code">
                      <span className="meta-label">C1B 코드:</span>
                      <span className="meta-value">{product.seller_cd || '-'}</span>
                    </div>
                    <div className="product-price">
                      <span className="meta-label">예상배송비:</span>
                      <span className="meta-value">{product.mp_delv_Price ? product.mp_delv_Price.toLocaleString() : '0'}원</span>
                    </div>
                    <div className="product-sales">
                      <span className="meta-label">판매건수:</span>
                      <span className="meta-value">
                        {(product.sale_cnt ?? 0).toLocaleString()}건
                        {(product.sale_cnt ?? 0) > 0 && (
                          <span style={{ fontSize: '12px', color: '#666', marginLeft: '4px' }}>
                            (스스: {(product.sale_cnt_ss ?? 0).toLocaleString()}, 쿠팡: {(product.sale_cnt_cp ?? 0).toLocaleString()})
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="product-date">
                      <span className="meta-label">등록일자:</span>
                      <span className="meta-value">{product.get_date ? product.get_date.substring(0, 16) : '-'}</span>
                    </div>
                  </div>
                </div>
                
                {/* 마켓 버튼 */}
                <div className="market-buttons">
                  <button 
                    className="action-btn smartstore"
                    onClick={() => openMarketLink(
                      getSmartStoreUrl(product.store_id, product.display_id_ss),
                      '스마트스토어'
                    )}
                    disabled={!product.display_id_ss || !product.store_id}
                  >
                    스마트스토어
                  </button>
                  <button 
                    className="action-btn coupang"
                    onClick={() => openMarketLink(
                      getCoupangUrl(product.display_id_cp),
                      '쿠팡'
                    )}
                    disabled={!product.display_id_cp}
                  >
                    쿠 팡
                  </button>
                </div>
              </div>

              {/* 액션 버튼 */}
              <div className="product-actions">
                <button 
                  className="action-btn delete"
                  onClick={() => openDeleteModal(product)}
                >
                  삭제요청
                </button>
                <button 
                  className="action-btn taobao"
                  onClick={() => openMarketLink(product.t_url, '타오바오')}
                  disabled={!product.t_url}
                >
                  타오바오
                </button>
              </div>
            </div>
            )
          })}
          </div>
        )}
      </div>

      {/* 페이징 */}
      {totalPages > 1 && (
        <div className="pagination">
          <button 
            className="page-btn"
            onClick={() => handlePageChange(1)}
            disabled={currentPage === 1}
          >
            처음
          </button>
          <button 
            className="page-btn"
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
          >
            이전
          </button>
          
          {getPageNumbers().map(page => (
            <button
              key={page}
              className={`page-btn ${currentPage === page ? 'active' : ''}`}
              onClick={() => handlePageChange(page)}
            >
              {page}
            </button>
          ))}
          
          <button 
            className="page-btn"
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
          >
            다음
          </button>
          <button 
            className="page-btn"
            onClick={() => handlePageChange(totalPages)}
            disabled={currentPage === totalPages}
          >
            마지막
          </button>
        </div>
      )}

      {/* 이미지 확대 모달 */}
      {enlargedImage && (
        <div className="image-modal-overlay">
          <div className="image-modal-content">
            <button 
              className="image-modal-close"
              onClick={() => setEnlargedImage(null)}
            >
              ✕
            </button>
            <div className="enlarged-image">
              <img src={enlargedImage} alt="확대 이미지" />
            </div>
            <p className="image-modal-hint">클릭하여 닫기</p>
          </div>
        </div>
      )}

      {/* 날짜 선택 모달 (주문관리 '기간선택'과 동일한 달력 UI) */}
      {showDateModal && (
        <div className="date-modal-overlay">
          <div className="date-modal-content">
            <div className="date-modal-header">
              <h3>기간 선택</h3>
              <button className="date-modal-close" onClick={closeDateModal}>
                ✕
              </button>
            </div>
            <div className="date-modal-body">
              <div className="date-input-group">
                <label className="date-label">시작일</label>
                <DatePicker
                  selected={tempDateFrom}
                  onChange={(date: Date | null) => setTempDateFrom(date)}
                  dateFormat="yyyy-MM-dd"
                  dateFormatCalendar="yyyy년 M월"
                  className="date-input-modal"
                  placeholderText="시작일을 선택하세요"
                  showMonthDropdown
                  showYearDropdown
                  dropdownMode="select"
                />
              </div>
              <div className="date-input-group">
                <label className="date-label">종료일</label>
                <DatePicker
                  selected={tempDateTo}
                  onChange={(date: Date | null) => setTempDateTo(date)}
                  dateFormat="yyyy-MM-dd"
                  dateFormatCalendar="yyyy년 M월"
                  className="date-input-modal"
                  placeholderText="종료일을 선택하세요"
                  showMonthDropdown
                  showYearDropdown
                  dropdownMode="select"
                  minDate={tempDateFrom || undefined}
                />
              </div>
            </div>
            <div className="date-modal-footer">
              <button className="date-modal-cancel" onClick={closeDateModal}>
                취소
              </button>
              <button className="date-modal-apply" onClick={applyDateRange}>
                적용
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 삭제요청 모달 */}
      {showDeleteModal && selectedProduct && (
        <div className="delete-modal-overlay">
          <div className="delete-modal-content">
            <div className="delete-modal-header">
              <h2>삭제요청</h2>
              <button className="delete-modal-close" onClick={closeDeleteModal}>✕</button>
            </div>

            <div className="delete-modal-body">
              {/* 상품 정보 표시 */}
              <div className="delete-product-info">
                <p><strong>상품명:</strong> {selectedProduct.good_name_ss}</p>
                <p><strong>C1B 코드:</strong> {selectedProduct.seller_cd}</p>
                <p>
                  <strong>판매건수:</strong> {(selectedProduct.sale_cnt ?? 0).toLocaleString()}건
                  {(selectedProduct.sale_cnt ?? 0) > 0 && (
                    <span style={{ fontSize: '13px', color: '#666', marginLeft: '6px' }}>
                      (스스: {(selectedProduct.sale_cnt_ss ?? 0).toLocaleString()}, 쿠팡: {(selectedProduct.sale_cnt_cp ?? 0).toLocaleString()})
                    </span>
                  )}
                </p>
              </div>

              <div className="delete-modal-warning" role="note">
                <p className="delete-modal-warning-title">주의</p>
                <p className="delete-modal-warning-text">
                  스마트스토어와 쿠팡에 해당 상품이 바로 삭제 됩니다.
                </p>
              </div>

              {/* 삭제사유 */}
              <div className="delete-form-group">
                <label className="delete-form-label">삭제사유</label>
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
                  <option value="브랜드 상품">브랜드 상품</option>
                  <option value="판매금지 상품">판매금지 상품</option>
                  <option value="상품명 수정">상품명 수정</option>
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
              <button className="delete-modal-btn cancel" onClick={closeDeleteModal}>
                취소
              </button>
              <button className="delete-modal-btn submit" onClick={handleDeleteRequest}>
                요청
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ProductPage
