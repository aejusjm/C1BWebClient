// 심플 모바일 버전 사용자별 매출 페이지
import { useState, useEffect } from 'react'
import './SimpleMobileSalesPage.css'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'
const API_URL = `${API_BASE}/api/stats`
const COHORT_API_URL = `${API_BASE}/api/cohorts`

/** 테스트계정 제외 시 제외할 user_id */
const EXCLUDED_TEST_USER_IDS = new Set(['user1', 'user2', 'user3', 'ybin583', 'admin', 'payuser'])

interface CohortOption {
  seq: number
  cohort_name: string
}

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
}

interface SimpleMobileSalesPageProps {
  onNavigate?: (menu: string) => void
}

function SimpleMobileSalesPage({ onNavigate }: SimpleMobileSalesPageProps) {
  // 필터 상태
  const [dateFilter, setDateFilter] = useState('today')
  const [cohorts, setCohorts] = useState<CohortOption[]>([])
  const [cohortSeq, setCohortSeq] = useState<number | ''>('')
  
  // 데이터 상태
  const [stats, setStats] = useState<UserSalesStats[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadCohorts()
  }, [])

  // 데이터 로드
  useEffect(() => {
    loadStats()
  }, [dateFilter, cohortSeq])

  const loadCohorts = async () => {
    try {
      const response = await fetch(COHORT_API_URL)
      const result = await response.json()
      if (result.success) {
        setCohorts(
          (result.data || []).map((row: { seq: number; cohort_name: string }) => ({
            seq: row.seq,
            cohort_name: row.cohort_name
          }))
        )
      }
    } catch (error) {
      console.error('기수 목록 조회 오류:', error)
    }
  }

  // 통계 데이터 로드
  const loadStats = async () => {
    setLoading(true)
    try {
      // 총매출 내림차순 고정
      let url = `${API_URL}/user-sales?dateFilter=${dateFilter}&sortField=total_sales&sortOrder=desc`
      if (cohortSeq) {
        url += `&cohortSeq=${cohortSeq}`
      }
      
      const response = await fetch(url)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const result = await response.json()
      
      if (result.success) {
        let filteredData = result.data || []
        
        // 테스트계정 제외 (기본값)
        filteredData = filteredData.filter(
          (stat: UserSalesStats) => !EXCLUDED_TEST_USER_IDS.has(stat.user_id)
        )

        setStats(filteredData)
      }
    } catch (error) {
      console.error('사용자별 매출 통계 로드 오류:', error)
      alert('데이터를 불러오는 중 오류가 발생했습니다.')
      setStats([])
    } finally {
      setLoading(false)
    }
  }

  // 금액 포맷 (만원 단위)
  const formatAmount = (amount: number) => {
    return Math.floor(amount / 10000).toLocaleString()
  }

  // 메인으로 이동
  const handleGoToMain = () => {
    if (onNavigate) {
      onNavigate('user-sales-stats')
    }
  }

  return (
    <div className="simple-mobile-sales-page">
      {/* 헤더 */}
      <div className="simple-header">
        <h1>💰 사용자별 매출</h1>
        <button className="main-btn" onClick={handleGoToMain}>
          🏠 메인으로
        </button>
      </div>

      {/* 날짜 필터 */}
      <div className="simple-filter-section">
        <div className="cohort-filter-row" style={{ marginBottom: '10px' }}>
          <select
            value={cohortSeq}
            onChange={(e) => setCohortSeq(e.target.value ? Number(e.target.value) : '')}
            style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px' }}
          >
            <option value="">기수: 전체</option>
            {cohorts.map((c) => (
              <option key={c.seq} value={c.seq}>{c.cohort_name}</option>
            ))}
          </select>
        </div>
        <div className="date-filters">
          <button 
            className={dateFilter === 'today' ? 'active' : ''}
            onClick={() => setDateFilter('today')}
          >
            오늘
          </button>
          <button 
            className={dateFilter === 'yesterday' ? 'active' : ''}
            onClick={() => setDateFilter('yesterday')}
          >
            어제
          </button>
          <button 
            className={dateFilter === 'thisWeek' ? 'active' : ''}
            onClick={() => setDateFilter('thisWeek')}
          >
            이번주
          </button>
          <button 
            className={dateFilter === 'lastWeek' ? 'active' : ''}
            onClick={() => setDateFilter('lastWeek')}
          >
            지난주
          </button>
          <button 
            className={dateFilter === 'thisMonth' ? 'active' : ''}
            onClick={() => setDateFilter('thisMonth')}
          >
            이번달
          </button>
          <button 
            className={dateFilter === 'lastMonth' ? 'active' : ''}
            onClick={() => setDateFilter('lastMonth')}
          >
            지난달
          </button>
        </div>
      </div>

      {/* 통계 테이블 */}
      <div className="simple-stats-container">
        {loading ? (
          <div className="loading-message">데이터를 불러오는 중입니다...</div>
        ) : stats.length === 0 ? (
          <div className="no-data-message">조회된 데이터가 없습니다.</div>
        ) : (
          <table className="simple-stats-table">
            <thead>
              <tr>
                <th rowSpan={2}>순번</th>
                <th rowSpan={2}>사용자명</th>
                <th colSpan={2}>주문수</th>
                <th colSpan={2}>매출</th>
                <th rowSpan={2} className="highlight-header">총주문수</th>
                <th rowSpan={2} className="highlight-header">총매출</th>
              </tr>
              <tr>
                <th className="sub-header-ss">스스</th>
                <th className="sub-header-cp">쿠팡</th>
                <th className="sub-header-ss">스스</th>
                <th className="sub-header-cp">쿠팡</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((stat, index) => (
                <tr key={stat.user_id}>
                  <td className="center">{index + 1}</td>
                  <td className="center username">{stat.user_name}</td>
                  <td className="right cell-ss">{stat.ss_order_count.toLocaleString()}</td>
                  <td className="right cell-cp">{stat.cp_order_count.toLocaleString()}</td>
                  <td className="right cell-ss">{formatAmount(stat.ss_sales)} 만원</td>
                  <td className="right cell-cp">{formatAmount(stat.cp_sales)} 만원</td>
                  <td className="right highlight">{stat.total_order_count.toLocaleString()}</td>
                  <td className="right highlight">{formatAmount(stat.total_sales)} 만원</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* 메인으로 버튼 (하단) */}
      <div className="simple-footer">
        <button className="main-btn-footer" onClick={handleGoToMain}>
          🏠 메인으로
        </button>
      </div>
    </div>
  )
}

export default SimpleMobileSalesPage
