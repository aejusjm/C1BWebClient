// 삭제상품관리 페이지 컴포넌트
import { useState, useEffect } from 'react'
import { useAlert } from '../contexts/AlertContext'
import './DeleteProductManagementPage.css'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'
const API_URL = `${API_BASE}/api/delete-products`

interface DeleteProduct {
  seq: number
  user_id: string
  user_name: string
  gu_seq: number
  del_reason: string
  del_yn: string
  del_type: string
  input_date: string | null
  del_date: string | null
  gm_seq: number
  good_name: string
  img_url: string
}

/** DB del_type → 화면 라벨 + 뱃지 클래스 (즉시삭제 / 일괄삭제 구분) */
function getDelTypeBadge(delType: string | null | undefined): { label: string; className: string } {
  const t = (delType || '').trim()
  if (t === '즉시삭제') {
    return { label: '즉시삭제', className: 'del-type-immediate' }
  }
  if (t === '일괄삭제' || t === '전체삭제') {
    return { label: '일괄삭제', className: 'del-type-batch' }
  }
  if (!t) {
    return { label: '-', className: 'del-type-unknown' }
  }
  return { label: t, className: 'del-type-unknown' }
}

function DeleteProductManagementPage() {
  const { showAlert, showConfirm } = useAlert()
  const [products, setProducts] = useState<DeleteProduct[]>([])
  const [loading, setLoading] = useState(false)
  
  // 페이징 상태
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(20)
  
  // 이미지 확대 상태
  const [zoomImage, setZoomImage] = useState<string | null>(null)

  // 컴포넌트 마운트 시 목록 조회
  useEffect(() => {
    loadProducts()
  }, [])

  // 삭제상품 목록 조회
  const loadProducts = async () => {
    try {
      setLoading(true)
      console.log('🗑️ 삭제상품 목록 조회 시작, API URL:', API_URL)
      const response = await fetch(API_URL)
      
      console.log('🗑️ 응답 상태:', response.status, response.statusText)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const result = await response.json()
      console.log('🗑️ 응답 데이터:', result)
      
      if (result.success) {
        console.log('🗑️ 삭제상품 개수:', result.data.length)
        setProducts(result.data)
      } else {
        console.error('🗑️ API 호출 실패:', result.message)
      }
    } catch (error) {
      console.error('🗑️ 삭제상품 목록 조회 오류:', error)
      await showAlert('삭제상품 목록을 불러오는 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  // 이미지 확대
  const handleImageZoom = (imageUrl: string) => {
    setZoomImage(imageUrl)
  }

  // 이미지 확대 닫기
  const handleZoomClose = () => {
    setZoomImage(null)
  }

  // 날짜 포맷팅 (YYYY-MM-DD HH:mm)
  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-'
    
    // SQL Server에서 온 날짜는 한국시간이지만 'Z'가 붙어 UTC로 파싱됨
    // 'Z'를 제거하고 로컬 시간으로 파싱
    const dateStr = dateString.replace('Z', '')
    const date = new Date(dateStr)
    
    if (Number.isNaN(date.getTime())) return '-'
    
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    
    return `${year}-${month}-${day} ${hours}:${minutes}`
  }

  // 전체 삭제 요청
  const handleDeleteAll = async (seq: number) => {
    const confirmed = await showConfirm('이 상품을 사용하는 모든 스토어의 상품을 삭제하시겠습니까?')
    if (!confirmed) return

    try {
      setLoading(true)
      const response = await fetch(`${API_URL}/delete-all`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ seq })
      })
      
      const result = await response.json()
      
      if (result.success) {
        await showAlert('전체 삭제 요청이 처리되었습니다.')
        loadProducts()
      } else {
        await showAlert(result.message || '전체 삭제 요청 중 오류가 발생했습니다.')
      }
    } catch (error) {
      console.error('전체 삭제 요청 오류:', error)
      await showAlert('전체 삭제 요청 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  // 페이징 계산
  const indexOfLastItem = currentPage * itemsPerPage
  const indexOfFirstItem = indexOfLastItem - itemsPerPage
  const currentProducts = products.slice(indexOfFirstItem, indexOfLastItem)
  const totalPages = Math.ceil(products.length / itemsPerPage)

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

  return (
    <div className="delete-product-management-page">
      {/* 페이지 헤더 */}
      <div className="delete-product-management-page-header">
        <h1 className="page-title">🗑️ 삭제상품관리</h1>
      </div>

      {/* 목록 테이블 */}
      <div className="delete-product-table-container">
        <div className="table-header">
          <h3>삭제 요청 목록 ({products.length}개)</h3>
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
          <table className="delete-product-table">
            <thead>
              <tr>
                <th>순번</th>
                <th>사용자</th>
                <th>삭제유형</th>
                <th>삭제사유</th>
                <th>상품이미지</th>
                <th>상품명</th>
                <th>삭제여부</th>
                <th>삭제요청일</th>
                <th>삭제일자</th>
                <th>전체삭제요청</th>
              </tr>
            </thead>
            <tbody>
              {products.length === 0 ? (
                <tr>
                  <td colSpan={10} className="no-data">
                    {loading ? '로딩 중...' : '삭제 요청된 상품이 없습니다.'}
                  </td>
                </tr>
              ) : (
                currentProducts.map((product, index) => {
                  const delBadge = getDelTypeBadge(product.del_type)
                  return (
                  <tr key={product.seq}>
                    <td>{indexOfFirstItem + index + 1}</td>
                    <td>{product.user_name}</td>
                    <td>
                      <span
                        className={`del-type-badge ${delBadge.className}`}
                        title={product.del_type ? `DB: ${product.del_type}` : ''}
                      >
                        {delBadge.label}
                      </span>
                    </td>
                    <td className="reason-cell">{product.del_reason}</td>
                    <td>
                      <img 
                        src={product.img_url} 
                        alt={product.good_name}
                        className="product-thumbnail"
                        onClick={() => handleImageZoom(product.img_url)}
                        style={{ cursor: 'pointer' }}
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="50" height="50"%3E%3Crect width="50" height="50" fill="%23ddd"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" fill="%23999"%3ENO IMAGE%3C/text%3E%3C/svg%3E'
                        }}
                      />
                    </td>
                    <td className="product-name-cell">{product.good_name}</td>
                    <td>
                      <span className={`status-badge ${product.del_yn === 'Y' ? 'deleted' : 'pending'}`}>
                        {product.del_yn === 'Y' ? '삭제완료' : '대기중'}
                      </span>
                    </td>
                    <td>{formatDate(product.input_date)}</td>
                    <td>{formatDate(product.del_date)}</td>
                    <td>
                      <button 
                        className="delete-all-btn"
                        onClick={() => handleDeleteAll(product.seq)}
                      >
                        전체삭제
                      </button>
                    </td>
                  </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* 페이징 */}
        {products.length > 0 && (
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
              {currentPage} / {totalPages} 페이지 (총 {products.length}개)
            </span>
          </div>
        )}
      </div>

      {/* 이미지 확대 모달 */}
      {zoomImage && (
        <div className="image-zoom-overlay" onClick={handleZoomClose}>
          <button className="image-zoom-close" onClick={handleZoomClose}>
            ✕
          </button>
          <img 
            src={zoomImage} 
            alt="확대 이미지" 
            className="image-zoom-content"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  )
}

export default DeleteProductManagementPage
