// 사용자별 매출 통계 페이지 컴포넌트
import { useState, useEffect } from 'react'
import { useUser } from '../contexts/UserContext'
import { useAlert } from '../contexts/AlertContext'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import './UserSalesStatsPage.css'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'
const API_URL = `${API_BASE}/api/stats`

/** 테스트계정 제외 시 제외할 user_id (체크 시 목록에서 숨김) */
const EXCLUDED_TEST_USER_IDS = new Set(['user1', 'user2', 'user3', 'ybin583', 'admin', 'payuser'])

interface UserSalesStats {
  user_id: string
  user_name: string
  ss_store_count: number
  ss_order_count: number
  ss_sales: number
  cp_store_count: number
  cp_order_count: number
  cp_sales: number
  total_order_count: number
  total_sales: number
  end_date?: string | null
  user_type?: string
}

type SortField = 'user_name' | 'total_order_count' | 'total_sales'
type SortOrder = 'asc' | 'desc'

interface UserSalesStatsPageProps {
  onNavigate?: (menu: string) => void
}

function UserSalesStatsPage({ onNavigate }: UserSalesStatsPageProps) {
  const { userInfo, setUserInfo } = useUser()
  const { showAlert, showConfirm } = useAlert()
  
  // 필터 상태
  const [dateFilter, setDateFilter] = useState('today')
  const [userName, setUserName] = useState('')
  const [useCustomDate, setUseCustomDate] = useState(false)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [hasSales, setHasSales] = useState(false)
  const [excludeTestAccounts, setExcludeTestAccounts] = useState(true)
  
  // 날짜 선택 모달
  const [showDateModal, setShowDateModal] = useState(false)
  const [tempStartDate, setTempStartDate] = useState<Date | null>(null)
  const [tempEndDate, setTempEndDate] = useState<Date | null>(null)
  
  // 정렬 상태
  const [sortField, setSortField] = useState<SortField>('total_sales')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
  
  // 데이터 상태
  const [stats, setStats] = useState<UserSalesStats[]>([])
  const [loading, setLoading] = useState(false)

  // 데이터 로드
  useEffect(() => {
    if (userInfo?.userId) {
      loadStats()
    }
  }, [dateFilter, userName, useCustomDate, startDate, endDate, sortField, sortOrder, hasSales, excludeTestAccounts, userInfo?.userId])

  // 날짜를 YYYY-MM-DD 형식으로 변환
  const formatDateToString = (date: Date): string => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  // 날짜 선택 모달 열기
  const openDateModal = () => {
    const today = new Date()
    
    if (startDate && endDate) {
      setTempStartDate(new Date(startDate))
      setTempEndDate(new Date(endDate))
    } else {
      setTempStartDate(today)
      setTempEndDate(today)
    }
    setShowDateModal(true)
  }

  // 날짜 선택 모달 닫기
  const closeDateModal = () => {
    setShowDateModal(false)
    setTempStartDate(null)
    setTempEndDate(null)
  }

  // 사용자 정의 날짜 적용
  const handleCustomDateApply = async () => {
    if (!tempStartDate || !tempEndDate) {
      await showAlert('시작일과 종료일을 모두 선택해주세요.')
      return
    }
    if (tempStartDate > tempEndDate) {
      await showAlert('시작일은 종료일보다 이전이어야 합니다.')
      return
    }
    setStartDate(formatDateToString(tempStartDate))
    setEndDate(formatDateToString(tempEndDate))
    setUseCustomDate(true)
    setShowDateModal(false)
  }

  // 날짜 필터 변경
  const handleDateFilterChange = (filter: string) => {
    setDateFilter(filter)
    setUseCustomDate(false)
  }

  // 통계 데이터 로드
  const loadStats = async () => {
    setLoading(true)
    try {
      let url = `${API_URL}/user-sales?dateFilter=${dateFilter}&sortField=${sortField}&sortOrder=${sortOrder}`
      
      if (userName.trim()) {
        url += `&userName=${encodeURIComponent(userName.trim())}`
      }
      
      if (useCustomDate && startDate && endDate) {
        url += `&startDate=${startDate}&endDate=${endDate}`
      }
      
      const response = await fetch(url)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const result = await response.json()
      
      if (result.success) {
        let filteredData = result.data || []
        
        // 매출유 필터 적용
        if (hasSales) {
          filteredData = filteredData.filter((stat: UserSalesStats) => stat.total_sales > 0)
        }

        if (excludeTestAccounts) {
          filteredData = filteredData.filter(
            (stat: UserSalesStats) => !EXCLUDED_TEST_USER_IDS.has(stat.user_id)
          )
        }

        setStats(filteredData)
      }
    } catch (error) {
      console.error('사용자별 매출 통계 로드 오류:', error)
      await showAlert('데이터를 불러오는 중 오류가 발생했습니다.')
      setStats([])
    } finally {
      setLoading(false)
    }
  }

  // 검색 버튼 클릭
  const handleSearch = () => {
    loadStats()
  }

  // 정렬 변경
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortOrder('desc')
    }
  }

  // 금액 포맷 (만원 단위)
  const formatAmount = (amount: number) => {
    return Math.floor(amount / 10000).toLocaleString()
  }

  // 정렬 아이콘 표시
  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return '↕️'
    return sortOrder === 'asc' ? '↑' : '↓'
  }

  // 해당 사용자로 로그인
  const handleLoginAs = async (stat: UserSalesStats) => {
    const confirmed = await showConfirm(`${stat.user_name}(${stat.user_id}) 계정으로 로그인하시겠습니까?`)
    if (!confirmed) {
      return
    }

    // 종료일 체크
    if (stat.end_date) {
      const endDate = new Date(stat.end_date)
      const today = new Date()
      if (endDate < today) {
        await showAlert('사용기한이 지난 계정입니다.')
        return
      }
    }

    // 로컬스토리지에 사용자 정보 저장
    const newUserInfo = {
      userId: stat.user_id,
      userName: stat.user_name,
      userType: stat.user_type || '',
      endDate: stat.end_date || null
    }
    localStorage.setItem('userInfo', JSON.stringify(newUserInfo))
    
    // 로그인 성공 메시지 표시
    await showAlert(`${stat.user_name} 계정으로 로그인되었습니다.`)
    
    // UserContext 업데이트 (메시지 확인 후)
    setUserInfo(newUserInfo)
    
    // 대시보드로 이동
    if (onNavigate) {
      onNavigate('dashboard')
    } else {
      window.location.reload()
    }
  }

  return (
    <div className="user-sales-stats-page">
      {/* 페이지 헤더 */}
      <div className="page-header">
        <h1 className="page-title">💰 사용자별 매출</h1>
      </div>

      {/* 검색 조건 */}
      <div className="search-section">
        {/* 날짜 필터 */}
        <div className="date-filters">
          <button 
            className={dateFilter === 'today' && !useCustomDate ? 'active' : ''}
            onClick={() => handleDateFilterChange('today')}
          >
            오늘
          </button>
          <button 
            className={dateFilter === 'yesterday' && !useCustomDate ? 'active' : ''}
            onClick={() => handleDateFilterChange('yesterday')}
          >
            어제
          </button>
          <button 
            className={dateFilter === 'thisWeek' && !useCustomDate ? 'active' : ''}
            onClick={() => handleDateFilterChange('thisWeek')}
          >
            이번주
          </button>
          <button 
            className={dateFilter === 'lastWeek' && !useCustomDate ? 'active' : ''}
            onClick={() => handleDateFilterChange('lastWeek')}
          >
            지난주
          </button>
          <button 
            className={dateFilter === 'thisMonth' && !useCustomDate ? 'active' : ''}
            onClick={() => handleDateFilterChange('thisMonth')}
          >
            이번달
          </button>
          <button 
            className={dateFilter === 'lastMonth' && !useCustomDate ? 'active' : ''}
            onClick={() => handleDateFilterChange('lastMonth')}
          >
            지난달
          </button>
          <button 
            className={`date-picker-btn ${useCustomDate ? 'active' : ''}`}
            onClick={openDateModal}
          >
            📅 기간선택
          </button>
          {useCustomDate && startDate && endDate && (
            <span className="selected-date-range">
              {startDate} ~ {endDate}
            </span>
          )}
        </div>

        <div className="filter-divider"></div>

        {/* 매출 / 테스트계정 제외 */}
        <div className="filter-section">
          <span className="filter-label">매출:</span>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={hasSales}
              onChange={(e) => setHasSales(e.target.checked)}
            />
            <span className="checkbox-text">매출 있음</span>
          </label>
          <span className="filter-label filter-label-exclude">제외:</span>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={excludeTestAccounts}
              onChange={(e) => setExcludeTestAccounts(e.target.checked)}
            />
            <span className="checkbox-text">테스트계정</span>
          </label>
        </div>

        <div className="filter-divider"></div>

        {/* 사용자 검색 + 검색 버튼 */}
        <div className="search-group">
          <span className="filter-label">사용자:</span>
          <input 
            type="text"
            className="user-search-input"
            placeholder="이름 입력"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
          />
          <button className="search-btn" onClick={handleSearch}>
            🔍 검색
          </button>
        </div>
      </div>

      {/* 통계 테이블 */}
      <div className="stats-table-container">
        {loading ? (
          <div className="loading-message">데이터를 불러오는 중입니다...</div>
        ) : stats.length === 0 ? (
          <div className="no-data-message">조회된 데이터가 없습니다.</div>
        ) : (
          <table className="stats-table">
            <thead>
              <tr className="header-row-1">
                <th rowSpan={2} className="header-basic">순번</th>
                <th rowSpan={2} className="header-basic">사용자ID</th>
                <th 
                  rowSpan={2} 
                  className="sortable header-basic"
                  onClick={() => handleSort('user_name')}
                >
                  사용자명 {getSortIcon('user_name')}
                </th>
                <th colSpan={2} className="header-store-count">스토어수</th>
                <th colSpan={2} className="header-order-count">주문수</th>
                <th colSpan={2} className="header-sales">매출</th>
                <th 
                  rowSpan={2}
                  className="sortable header-total"
                  onClick={() => handleSort('total_order_count')}
                >
                  총주문수 {getSortIcon('total_order_count')}
                </th>
                <th 
                  rowSpan={2}
                  className="sortable header-total"
                  onClick={() => handleSort('total_sales')}
                >
                  총매출 {getSortIcon('total_sales')}
                </th>
              </tr>
              <tr className="header-row-2">
                <th className="header-smartstore">스스</th>
                <th className="header-coupang">쿠팡</th>
                <th className="header-smartstore">스스</th>
                <th className="header-coupang">쿠팡</th>
                <th className="header-smartstore">스스</th>
                <th className="header-coupang">쿠팡</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((stat, index) => (
                <tr key={stat.user_id}>
                  <td className="center">{index + 1}</td>
                  <td className="center">{stat.user_id}</td>
                  <td 
                    className="center clickable-username"
                    onClick={() => handleLoginAs(stat)}
                  >
                    {stat.user_name}
                  </td>
                  <td className="center cell-store-count">{stat.ss_store_count}</td>
                  <td className="center cell-store-count">{stat.cp_store_count}</td>
                  <td className="right cell-order-count">{stat.ss_order_count.toLocaleString()}</td>
                  <td className="right cell-order-count">{stat.cp_order_count.toLocaleString()}</td>
                  <td className="right cell-sales">{formatAmount(stat.ss_sales)} 만원</td>
                  <td className="right cell-sales">{formatAmount(stat.cp_sales)} 만원</td>
                  <td className="right highlight">{stat.total_order_count.toLocaleString()}</td>
                  <td className="right highlight">{formatAmount(stat.total_sales)} 만원</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* 날짜 선택 모달 */}
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
                  selected={tempStartDate}
                  onChange={(date: Date | null) => setTempStartDate(date)}
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
                  selected={tempEndDate}
                  onChange={(date: Date | null) => setTempEndDate(date)}
                  dateFormat="yyyy-MM-dd"
                  dateFormatCalendar="yyyy년 M월"
                  className="date-input-modal"
                  placeholderText="종료일을 선택하세요"
                  showMonthDropdown
                  showYearDropdown
                  dropdownMode="select"
                  minDate={tempStartDate || undefined}
                />
              </div>
            </div>
            <div className="date-modal-footer">
              <button className="date-modal-cancel" onClick={closeDateModal}>
                취소
              </button>
              <button className="date-modal-apply" onClick={handleCustomDateApply}>
                적용
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default UserSalesStatsPage
