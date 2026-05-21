// 가구매 리스트 페이지
import { useState, useEffect } from 'react'
import { useAlert } from '../contexts/AlertContext'
import './FakePurchaseInfoPage.css'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'
const API_URL = `${API_BASE}/api/fake-purchase-info`

interface FakePurchaseInfo {
  order_date: string
  user_id: string
  user_name: string
  store_name: string
  ga_grp_seq: number
  grp_name: string
  main_order_id: string
  order_id: string
  product_name: string
  ordrr_name: string
  biz_idx: number
  recvr_name: string
  pay_date: string
  dispatch_date: string | null
  purch_decided_date: string | null
  ga_buy_chk_date: string | null
  invo_no: string | null
  ga_invo_no: string | null
}

type SortField = 'order_date' | 'user_name' | 'store_name' | 'grp_name' | 'main_order_id' | 'product_name' | 'ordrr_name' | 'pay_date' | ''
type SortOrder = 'asc' | 'desc'

function FakePurchaseInfoPage() {
  const { showAlert } = useAlert()
  const [orders, setOrders] = useState<FakePurchaseInfo[]>([])
  const [loading, setLoading] = useState(false)
  
  // 정렬 상태 (초기값: 정렬 없음)
  const [sortField, setSortField] = useState<SortField>('')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
  
  // 페이징 상태
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(20)

  // 필터 상태
  const [selectedOrderDate, setSelectedOrderDate] = useState<string>('')
  const [searchUserName, setSearchUserName] = useState<string>('')
  const [searchStoreName, setSearchStoreName] = useState<string>('')
  const [searchMainOrderId, setSearchMainOrderId] = useState<string>('')
  const [searchOrderId, setSearchOrderId] = useState<string>('')
  const [searchProductName, setSearchProductName] = useState<string>('')
  const [searchOrdrr_name, setSearchOrdrr_name] = useState<string>('')
  const [searchInvo_no, setSearchInvo_no] = useState<string>('')

  // 컴포넌트 마운트 시 목록 조회
  useEffect(() => {
    loadOrders()
  }, [selectedOrderDate, searchUserName, searchStoreName, searchMainOrderId, searchOrderId, searchProductName, searchOrdrr_name, searchInvo_no])

  // 가구매 리스트 조회
  const loadOrders = async () => {
    try {
      setLoading(true)
      let url = API_URL
      const params = []
      if (selectedOrderDate) {
        params.push(`orderDate=${selectedOrderDate}`)
      }
      if (searchUserName) {
        params.push(`userName=${encodeURIComponent(searchUserName)}`)
      }
      if (searchStoreName) {
        params.push(`storeName=${encodeURIComponent(searchStoreName)}`)
      }
      if (searchMainOrderId) {
        params.push(`mainOrderId=${encodeURIComponent(searchMainOrderId)}`)
      }
      if (searchOrderId) {
        params.push(`orderId=${encodeURIComponent(searchOrderId)}`)
      }
      if (searchProductName) {
        params.push(`productName=${encodeURIComponent(searchProductName)}`)
      }
      if (searchOrdrr_name) {
        params.push(`ordrr_name=${encodeURIComponent(searchOrdrr_name)}`)
      }
      if (searchInvo_no) {
        params.push(`invo_no=${encodeURIComponent(searchInvo_no)}`)
      }
      if (params.length > 0) {
        url += `?${params.join('&')}`
      }

      console.log('📋 가구매 리스트 조회 시작, API URL:', url)
      const response = await fetch(url)
      
      console.log('📋 응답 상태:', response.status, response.statusText)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const result = await response.json()
      console.log('📋 응답 데이터:', result)
      
      if (result.success) {
        console.log('📋 가구매 리스트 개수:', result.data.length)
        setOrders(result.data)
      } else {
        console.error('📋 API 호출 실패:', result.message)
      }
    } catch (error) {
      console.error('📋 가구매 리스트 조회 오류:', error)
      await showAlert('가구매 리스트를 불러오는 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  // 정렬 처리
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortOrder('asc')
    }
  }

  // 정렬 아이콘 표시
  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return '↕️'
    return sortOrder === 'asc' ? '↑' : '↓'
  }

  // 정렬된 데이터
  const sortedOrders = sortField === '' ? [...orders] : [...orders].sort((a, b) => {
    let aValue = a[sortField]
    let bValue = b[sortField]
    
    if (aValue === null && bValue === null) return 0
    if (aValue === null) return 1
    if (bValue === null) return -1
    
    if (typeof aValue === 'string' && typeof bValue === 'string') {
      return sortOrder === 'asc' 
        ? aValue.localeCompare(bValue) 
        : bValue.localeCompare(aValue)
    }
    
    if (typeof aValue === 'number' && typeof bValue === 'number') {
      return sortOrder === 'asc' 
        ? aValue - bValue 
        : bValue - aValue
    }
    
    return 0
  })

  // 페이징 계산
  const indexOfLastItem = currentPage * itemsPerPage
  const indexOfFirstItem = indexOfLastItem - itemsPerPage
  const currentOrders = sortedOrders.slice(indexOfFirstItem, indexOfLastItem)
  const totalPages = Math.ceil(sortedOrders.length / itemsPerPage)

  // 페이지 변경
  const handlePageChange = (pageNumber: number) => {
    setCurrentPage(pageNumber)
  }

  // 페이지당 항목 수 변경
  const handleItemsPerPageChange = (newItemsPerPage: number) => {
    setItemsPerPage(newItemsPerPage)
    setCurrentPage(1)
  }

  // 페이지 번호 생성
  const getPageNumbers = () => {
    const pages = []
    const maxPagesToShow = 5
    
    let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2))
    let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1)
    
    if (endPage - startPage + 1 < maxPagesToShow) {
      startPage = Math.max(1, endPage - maxPagesToShow + 1)
    }
    
    for (let i = startPage; i <= endPage; i++) {
      pages.push(i)
    }
    
    return pages
  }

  // 날짜 포맷팅 (yyyy-MM-dd 형식)
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-'
    
    // yyyy-MM-dd 형식으로 표시
    const dateOnly = dateStr.split('T')[0]
    return dateOnly
  }

  // 날짜/시간 포맷팅 (yyyy-MM-dd HH:mm:ss 형식)
  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return '-'
    
    // yyyy-MM-dd HH:mm:ss 형식으로 표시
    const datetime = dateStr.replace('T', ' ').split('.')[0]
    return datetime
  }

  return (
    <div className="fake-purchase-info-page">
      {/* 페이지 헤더 */}
      <div className="fake-purchase-info-page-header">
        <h1 className="page-title">📋 가구매 리스트</h1>
      </div>

      {/* 검색 필터 영역 */}
      <div className="search-filter-container">
        <div className="search-row">
          <div className="search-field">
            <label>주문일자:</label>
            <input
              type="date"
              value={selectedOrderDate}
              onChange={(e) => {
                setSelectedOrderDate(e.target.value)
                setCurrentPage(1)
              }}
            />
          </div>
          <div className="search-field">
            <label>사용자명:</label>
            <input
              type="text"
              placeholder="사용자명 검색"
              value={searchUserName}
              onChange={(e) => {
                setSearchUserName(e.target.value)
                setCurrentPage(1)
              }}
            />
          </div>
          <div className="search-field">
            <label>스토어명:</label>
            <input
              type="text"
              placeholder="스토어명 검색"
              value={searchStoreName}
              onChange={(e) => {
                setSearchStoreName(e.target.value)
                setCurrentPage(1)
              }}
            />
          </div>
          <div className="search-field">
            <label>주문번호:</label>
            <input
              type="text"
              placeholder="주문번호 검색"
              value={searchMainOrderId}
              onChange={(e) => {
                setSearchMainOrderId(e.target.value)
                setCurrentPage(1)
              }}
            />
          </div>
        </div>
        <div className="search-row">
          <div className="search-field">
            <label>상품주문번호:</label>
            <input
              type="text"
              placeholder="상품주문번호 검색"
              value={searchOrderId}
              onChange={(e) => {
                setSearchOrderId(e.target.value)
                setCurrentPage(1)
              }}
            />
          </div>
          <div className="search-field">
            <label>상품명:</label>
            <input
              type="text"
              placeholder="상품명 검색"
              value={searchProductName}
              onChange={(e) => {
                setSearchProductName(e.target.value)
                setCurrentPage(1)
              }}
            />
          </div>
          <div className="search-field">
            <label>구매자:</label>
            <input
              type="text"
              placeholder="구매자 검색"
              value={searchOrdrr_name}
              onChange={(e) => {
                setSearchOrdrr_name(e.target.value)
                setCurrentPage(1)
              }}
            />
          </div>
          <div className="search-field">
            <label>송장번호:</label>
            <input
              type="text"
              placeholder="송장번호 검색"
              value={searchInvo_no}
              onChange={(e) => {
                setSearchInvo_no(e.target.value)
                setCurrentPage(1)
              }}
            />
          </div>
        </div>
        <div className="search-actions">
          <button 
            className="clear-all-btn"
            onClick={() => {
              setSelectedOrderDate('')
              setSearchUserName('')
              setSearchStoreName('')
              setSearchMainOrderId('')
              setSearchOrderId('')
              setSearchProductName('')
              setSearchOrdrr_name('')
              setSearchInvo_no('')
              setCurrentPage(1)
            }}
          >
            전체 초기화
          </button>
        </div>
      </div>

      {/* 목록 테이블 */}
      <div className="fake-purchase-table-container">
        <div className="table-header">
          <h3>가구매 주문 목록 ({sortedOrders.length}개)</h3>
          <div className="items-per-page">
            <label>페이지당 항목:</label>
            <select 
              value={itemsPerPage}
              onChange={(e) => handleItemsPerPageChange(parseInt(e.target.value))}
            >
              <option value={20}>20개</option>
              <option value={30}>30개</option>
              <option value={50}>50개</option>
              <option value={100}>100개</option>
            </select>
          </div>
        </div>
        <div className="table-wrapper">
          <table className="fake-purchase-table">
            <thead>
              <tr>
                <th>No</th>
                <th className="sortable" onClick={() => handleSort('order_date')}>
                  주문일자 {getSortIcon('order_date')}
                </th>
                <th className="sortable" onClick={() => handleSort('user_name')}>
                  사용자명 {getSortIcon('user_name')}
                </th>
                <th className="sortable" onClick={() => handleSort('store_name')}>
                  스토어명 {getSortIcon('store_name')}
                </th>
                <th className="sortable" onClick={() => handleSort('grp_name')}>
                  가구매 그룹 {getSortIcon('grp_name')}
                </th>
                <th className="sortable" onClick={() => handleSort('main_order_id')}>
                  주문번호 {getSortIcon('main_order_id')}
                </th>
                <th>상품주문번호</th>
                <th className="sortable" onClick={() => handleSort('product_name')}>
                  상품명 {getSortIcon('product_name')}
                </th>
                <th className="sortable" onClick={() => handleSort('ordrr_name')}>
                  구매자 {getSortIcon('ordrr_name')}
                </th>
                <th className="sortable" onClick={() => handleSort('pay_date')}>
                  결제일자 {getSortIcon('pay_date')}
                </th>
                <th>발주확인</th>
                <th>구매확정</th>
                <th>송장번호</th>
              </tr>
            </thead>
            <tbody>
              {sortedOrders.length === 0 ? (
                <tr>
                  <td colSpan={13} className="no-data">
                    {loading ? '로딩 중...' : '가구매 주문이 없습니다.'}
                  </td>
                </tr>
              ) : (
                currentOrders.map((order, index) => {
                  // 5건마다 배경색 구분 (0-4: 그룹1, 5-9: 그룹2, 10-14: 그룹1, ...)
                  const groupClass = Math.floor(index / 5) % 2 === 0 ? '' : 'group-alternate'
                  return (
                    <tr key={`${order.order_id}-${order.biz_idx}`} className={groupClass}>
                      <td>{indexOfFirstItem + index + 1}</td>
                      <td>{formatDate(order.order_date)}</td>
                      <td>{order.user_name}</td>
                      <td>{order.store_name}</td>
                      <td>{order.grp_name}</td>
                      <td>{order.main_order_id}</td>
                      <td>{order.order_id}</td>
                      <td className="product-name-cell">{order.product_name}</td>
                      <td>{order.ordrr_name}</td>
                      <td>{formatDateTime(order.pay_date)}</td>
                      <td>{formatDateTime(order.dispatch_date)}</td>
                      <td>{formatDateTime(order.purch_decided_date)}</td>
                      <td>{order.invo_no || '-'}</td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* 페이징 */}
        {sortedOrders.length > 0 && (
          <div className="pagination">
            <button
              className="page-btn"
              onClick={() => handlePageChange(1)}
              disabled={currentPage === 1}
            >
              ≪
            </button>
            <button
              className="page-btn"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
            >
              ‹
            </button>
            
            {getPageNumbers().map((pageNum) => (
              <button
                key={pageNum}
                className={`page-btn ${currentPage === pageNum ? 'active' : ''}`}
                onClick={() => handlePageChange(pageNum)}
              >
                {pageNum}
              </button>
            ))}
            
            <button
              className="page-btn"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              ›
            </button>
            <button
              className="page-btn"
              onClick={() => handlePageChange(totalPages)}
              disabled={currentPage === totalPages}
            >
              ≫
            </button>
            
            <span className="page-info">
              {currentPage} / {totalPages} 페이지 (총 {sortedOrders.length}개)
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

export default FakePurchaseInfoPage
