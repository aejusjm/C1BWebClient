// 가구매 사용자관리 페이지 컴포넌트
import { useState, useEffect } from 'react'
import { useAlert } from '../contexts/AlertContext'
import './FakePurchaseUserPage.css'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'
const API_URL = `${API_BASE}/api/fake-purchase-users`

interface FakePurchaseUser {
  user_id: string
  user_name: string
  user_type: string
  biz_idx: number
  store_name: string
  ga_buy_cnt: number
  prod_cnt: number
  grp_name: string | null
}

type SortField = 'user_id' | 'user_name' | 'user_type' | 'store_name' | 'prod_cnt' | 'ga_buy_cnt' | 'grp_name'
type SortOrder = 'asc' | 'desc'

function FakePurchaseUserPage() {
  const { showAlert } = useAlert()
  const [users, setUsers] = useState<FakePurchaseUser[]>([])
  const [loading, setLoading] = useState(false)
  
  // 정렬 상태
  const [sortField, setSortField] = useState<SortField>('user_name')
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc')
  
  // 페이징 상태
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(20)

  // 컴포넌트 마운트 시 목록 조회
  useEffect(() => {
    loadUsers()
  }, [])

  // 가구매 사용자 목록 조회
  const loadUsers = async () => {
    try {
      setLoading(true)
      console.log('🛍️ 가구매 사용자 목록 조회 시작, API URL:', API_URL)
      const response = await fetch(API_URL)
      
      console.log('🛍️ 응답 상태:', response.status, response.statusText)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const result = await response.json()
      console.log('🛍️ 응답 데이터:', result)
      
      if (result.success) {
        console.log('🛍️ 가구매 사용자 개수:', result.data.length)
        setUsers(result.data)
      } else {
        console.error('🛍️ API 호출 실패:', result.message)
      }
    } catch (error) {
      console.error('🛍️ 가구매 사용자 목록 조회 오류:', error)
      await showAlert('가구매 사용자 목록을 불러오는 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  // 정렬 처리
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      // 같은 필드를 클릭하면 정렬 순서 변경
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      // 다른 필드를 클릭하면 해당 필드로 오름차순 정렬
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
  const sortedUsers = [...users].sort((a, b) => {
    let aValue = a[sortField]
    let bValue = b[sortField]
    
    // null 값 처리 (null은 항상 뒤로)
    if (aValue === null && bValue === null) return 0
    if (aValue === null) return 1
    if (bValue === null) return -1
    
    // 문자열 비교
    if (typeof aValue === 'string' && typeof bValue === 'string') {
      return sortOrder === 'asc' 
        ? aValue.localeCompare(bValue) 
        : bValue.localeCompare(aValue)
    }
    
    // 숫자 비교
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
  const currentUsers = sortedUsers.slice(indexOfFirstItem, indexOfLastItem)
  const totalPages = Math.ceil(sortedUsers.length / itemsPerPage)

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

  // 가구매그룹 배지 스타일
  const getGroupBadge = (grpName: string | null) => {
    if (!grpName) {
      return <span className="group-badge no-group">미지정</span>
    }
    
    const groupColors: { [key: string]: string } = {
      '그룹1': 'group-1',
      '그룹2': 'group-2',
      '그룹3': 'group-3',
      '그룹4': 'group-4',
      '그룹5': 'group-5',
    }
    
    const colorClass = groupColors[grpName] || 'group-default'
    return <span className={`group-badge ${colorClass}`}>{grpName}</span>
  }

  // 사용자 유형 배지 스타일
  const getUserTypeBadge = (userType: string) => {
    if (userType === '가구매') {
      return <span className="user-type-badge fake-purchase">가구매</span>
    } else if (userType === '일반') {
      return <span className="user-type-badge normal">일반</span>
    }
    return <span className="user-type-badge">{userType}</span>
  }

  return (
    <div className="fake-purchase-user-page">
      {/* 페이지 헤더 */}
      <div className="fake-purchase-user-page-header">
        <h1 className="page-title">🛍️ 가구매 사용자관리</h1>
      </div>

      {/* 목록 테이블 */}
      <div className="fake-purchase-table-container">
        <div className="table-header">
          <h3>가구매 사용자 목록 ({sortedUsers.length}개)</h3>
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
                <th className="sortable" onClick={() => handleSort('grp_name')}>
                  가구매그룹 {getSortIcon('grp_name')}
                </th>
                <th className="sortable" onClick={() => handleSort('user_id')}>
                  사용자ID {getSortIcon('user_id')}
                </th>
                <th className="sortable" onClick={() => handleSort('user_type')}>
                  사용자유형 {getSortIcon('user_type')}
                </th>
                <th className="sortable" onClick={() => handleSort('user_name')}>
                  사용자명 {getSortIcon('user_name')}
                </th>
                <th className="sortable" onClick={() => handleSort('store_name')}>
                  마켓명 {getSortIcon('store_name')}
                </th>
                <th className="sortable" onClick={() => handleSort('prod_cnt')}>
                  업로드상품수 {getSortIcon('prod_cnt')}
                </th>
                <th className="sortable" onClick={() => handleSort('ga_buy_cnt')}>
                  가구매수 {getSortIcon('ga_buy_cnt')}
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedUsers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="no-data">
                    {loading ? '로딩 중...' : '가구매 사용자가 없습니다.'}
                  </td>
                </tr>
              ) : (
                currentUsers.map((user, index) => (
                  <tr key={`${user.user_id}-${user.biz_idx}`}>
                    <td>{indexOfFirstItem + index + 1}</td>
                    <td>{getGroupBadge(user.grp_name)}</td>
                    <td>{user.user_id}</td>
                    <td>{getUserTypeBadge(user.user_type)}</td>
                    <td>{user.user_name}</td>
                    <td>{user.store_name}</td>
                    <td className="number-cell">{user.prod_cnt.toLocaleString()}</td>
                    <td className="number-cell">{user.ga_buy_cnt.toLocaleString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* 페이징 */}
        {sortedUsers.length > 0 && (
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
              {currentPage} / {totalPages} 페이지 (총 {sortedUsers.length}개)
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

export default FakePurchaseUserPage
