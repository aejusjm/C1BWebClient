// 일자별 매출 통계 페이지 컴포넌트
import React, { useState, useEffect } from 'react'
import { useUser } from '../contexts/UserContext'
import { useAlert } from '../contexts/AlertContext'
import DatePicker from 'react-datepicker'
import { ko } from 'date-fns/locale'
import 'react-datepicker/dist/react-datepicker.css'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js'
import ChartDataLabels from 'chartjs-plugin-datalabels'
import { Bar } from 'react-chartjs-2'
import './DailySalesStatsPage.css'

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
)

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'
const API_URL = `${API_BASE}/api/stats`
const COHORT_API_URL = `${API_BASE}/api/cohorts`

interface CohortOption {
  seq: number
  cohort_name: string
}

interface DailySalesStats {
  pay_date: string
  market: string
  store: string
  biz_idx: number
  order_cnt: number
  pay_anmt: number
  pre_amt: number
}

interface UserDailySales {
  user_id: string
  user_name: string
  pay_date: string
  total_sales: number
}

interface UserChartData {
  user_id: string
  user_name: string
  dates: string[]
  sales: number[]
}

interface GroupedData {
  date: string
  markets: {
    [marketName: string]: {
      stores: DailySalesStats[]
      marketTotal: {
        order_cnt: number
        pay_anmt: number
        pre_amt: number
      }
    }
  }
  dayTotal: {
    order_cnt: number
    pay_anmt: number
    pre_amt: number
  }
}

const DAY_NAMES = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일']

const TOTAL_CHART_BG_COLORS = [
  'rgba(244, 67, 54, 0.4)',
  'rgba(255, 152, 0, 0.9)',
  'rgba(233, 30, 99, 0.4)',
  'rgba(76, 175, 80, 0.4)',
  'rgba(255, 193, 7, 0.4)',
  'rgba(33, 150, 243, 0.4)',
  'rgba(156, 39, 176, 0.4)'
]

const TOTAL_CHART_BG_SELECTED = [
  'rgba(244, 67, 54, 0.95)',
  'rgba(255, 152, 0, 1)',
  'rgba(233, 30, 99, 0.95)',
  'rgba(76, 175, 80, 0.95)',
  'rgba(255, 193, 7, 0.95)',
  'rgba(33, 150, 243, 0.95)',
  'rgba(156, 39, 176, 0.95)'
]

const TOTAL_CHART_BORDER_COLORS = [
  'rgba(244, 67, 54, 0.8)',
  'rgba(255, 152, 0, 1)',
  'rgba(233, 30, 99, 0.8)',
  'rgba(76, 175, 80, 0.8)',
  'rgba(255, 193, 7, 0.8)',
  'rgba(33, 150, 243, 0.8)',
  'rgba(156, 39, 176, 0.8)'
]

const TOTAL_CHART_BORDER_SELECTED = [
  'rgba(244, 67, 54, 1)',
  'rgba(255, 87, 34, 1)',
  'rgba(233, 30, 99, 1)',
  'rgba(56, 142, 60, 1)',
  'rgba(255, 160, 0, 1)',
  'rgba(25, 118, 210, 1)',
  'rgba(123, 31, 162, 1)'
]

function parseDateFromLabel(dateStr: string): Date {
  if (dateStr.includes('(주)')) {
    return new Date(dateStr.split(' ')[0])
  }
  if (dateStr.length === 7) {
    return new Date(`${dateStr}-01`)
  }
  return new Date(dateStr)
}

function getDayOfWeekFromLabel(dateStr: string): number {
  return parseDateFromLabel(dateStr).getDay()
}

function getTotalChartBackgroundColors(dates: string[], selectedWeekday: number | null): string[] {
  return dates.map(dateStr => {
    const dayOfWeek = getDayOfWeekFromLabel(dateStr)
    const isSelected = selectedWeekday !== null && dayOfWeek === selectedWeekday
    const isDimmed = selectedWeekday !== null && dayOfWeek !== selectedWeekday
    if (isSelected) return TOTAL_CHART_BG_SELECTED[dayOfWeek]
    if (isDimmed) return 'rgba(200, 200, 200, 0.25)'
    return TOTAL_CHART_BG_COLORS[dayOfWeek]
  })
}

function getTotalChartBorderColors(dates: string[], selectedWeekday: number | null): string[] {
  return dates.map(dateStr => {
    const dayOfWeek = getDayOfWeekFromLabel(dateStr)
    const isSelected = selectedWeekday !== null && dayOfWeek === selectedWeekday
    const isDimmed = selectedWeekday !== null && dayOfWeek !== selectedWeekday
    if (isSelected) return TOTAL_CHART_BORDER_SELECTED[dayOfWeek]
    if (isDimmed) return 'rgba(200, 200, 200, 0.4)'
    return TOTAL_CHART_BORDER_COLORS[dayOfWeek]
  })
}

function getTotalChartBorderWidths(dates: string[], selectedWeekday: number | null): number[] {
  return dates.map(dateStr => {
    const dayOfWeek = getDayOfWeekFromLabel(dateStr)
    const isSelected = selectedWeekday !== null && dayOfWeek === selectedWeekday
    return isSelected ? 4 : 2
  })
}

function DailySalesStatsPage() {
  const { userInfo } = useUser()
  const { showAlert } = useAlert()
  
  // 필터 상태
  const [dateFilter, setDateFilter] = useState('thisMonth')
  const [useCustomDate, setUseCustomDate] = useState(false)
  const [subscriptionBasis, setSubscriptionBasis] = useState(false)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [aggregationType, setAggregationType] = useState<'day' | 'week' | 'month'>('day')
  const [cohorts, setCohorts] = useState<CohortOption[]>([])
  const [cohortSeq, setCohortSeq] = useState<number | ''>('')
  
  // 날짜 선택 모달
  const [showDateModal, setShowDateModal] = useState(false)
  const [tempStartDate, setTempStartDate] = useState<Date | null>(null)
  const [tempEndDate, setTempEndDate] = useState<Date | null>(null)
  
  // 데이터 상태
  const [stats, setStats] = useState<DailySalesStats[]>([])
  const [groupedData, setGroupedData] = useState<GroupedData[]>([])
  const [userChartData, setUserChartData] = useState<UserChartData[]>([])
  const [totalChartData, setTotalChartData] = useState<{ dates: string[], sales: number[] }>({ dates: [], sales: [] })
  const [selectedWeekday, setSelectedWeekday] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadCohorts()
  }, [])

  // 데이터 로드
  useEffect(() => {
    if (userInfo?.userId) {
      loadStats()
      loadUserChartData()
    }
  }, [dateFilter, useCustomDate, startDate, endDate, aggregationType, cohortSeq, userInfo?.userId])

  useEffect(() => {
    setSelectedWeekday(null)
  }, [totalChartData.dates, dateFilter, useCustomDate, startDate, endDate, aggregationType, cohortSeq])

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

  // 최근 3개월 동적 생성 (-2, -3, -4개월)
  const getRecentMonths = () => {
    const today = new Date()
    const months = []

    for (let i = 2; i <= 4; i++) {
      const targetDate = new Date(today.getFullYear(), today.getMonth() - i, 1)
      const month = targetDate.getMonth() + 1
      const year = targetDate.getFullYear()
      months.push({
        key: `month-${year}-${month}`,
        label: `${month}월`,
        year: year,
        month: month
      })
    }

    return months
  }

  const recentMonths = getRecentMonths()

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
    setSubscriptionBasis(false)
    setDateFilter('custom')
    closeDateModal()
  }

  // 구독기준 날짜 선택 (16일 기준)
  const handleSubscriptionBasis = () => {
    const today = new Date()
    const day = today.getDate()

    let start: Date
    if (day >= 16) {
      // 이번달 16일 ~ 오늘
      start = new Date(today.getFullYear(), today.getMonth(), 16)
    } else {
      // 전월 16일 ~ 오늘
      start = new Date(today.getFullYear(), today.getMonth() - 1, 16)
    }

    setStartDate(formatDateToString(start))
    setEndDate(formatDateToString(today))
    setUseCustomDate(true)
    setSubscriptionBasis(true)
    setDateFilter('custom')
  }

  // 통계 데이터 로드
  const loadStats = async () => {
    try {
      setLoading(true)
      
      const params = new URLSearchParams({
        dateFilter: useCustomDate ? 'custom' : dateFilter
      })
      
      if (useCustomDate && startDate && endDate) {
        params.append('startDate', startDate)
        params.append('endDate', endDate)
      }
      
      const url = `${API_URL}/daily-sales/${userInfo.userId}?${params.toString()}`
      
      const response = await fetch(url)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const result = await response.json()
      
      if (result.success) {
        setStats(result.data)
        processGroupedData(result.data)
      }
    } catch (error) {
      console.error('통계 조회 오류:', error)
      await showAlert('통계 조회 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  // 데이터 그룹화 처리
  const processGroupedData = (data: DailySalesStats[]) => {
    const grouped: { [date: string]: GroupedData } = {}

    data.forEach(item => {
      const dateKey = item.pay_date.split('T')[0]
      
      // 숫자로 변환 (문자열인 경우 대비)
      const orderCnt = Number(item.order_cnt) || 0
      const payAnmt = Number(item.pay_anmt) || 0
      const preAmt = Number(item.pre_amt) || 0
      
      if (!grouped[dateKey]) {
        grouped[dateKey] = {
          date: dateKey,
          markets: {},
          dayTotal: { order_cnt: 0, pay_anmt: 0, pre_amt: 0 }
        }
      }

      if (!grouped[dateKey].markets[item.market]) {
        grouped[dateKey].markets[item.market] = {
          stores: [],
          marketTotal: { order_cnt: 0, pay_anmt: 0, pre_amt: 0 }
        }
      }

      // 숫자로 변환된 값을 사용하여 저장
      const storeData = {
        ...item,
        order_cnt: orderCnt,
        pay_anmt: payAnmt,
        pre_amt: preAmt
      }

      grouped[dateKey].markets[item.market].stores.push(storeData)
      grouped[dateKey].markets[item.market].marketTotal.order_cnt += orderCnt
      grouped[dateKey].markets[item.market].marketTotal.pay_anmt += payAnmt
      grouped[dateKey].markets[item.market].marketTotal.pre_amt += preAmt

      grouped[dateKey].dayTotal.order_cnt += orderCnt
      grouped[dateKey].dayTotal.pay_anmt += payAnmt
      grouped[dateKey].dayTotal.pre_amt += preAmt
    })

    setGroupedData(Object.values(grouped).sort((a, b) => a.date.localeCompare(b.date)))
  }

  // 사용자별 차트 데이터 로드
  const loadUserChartData = async () => {
    try {
      const params = new URLSearchParams({
        dateFilter: useCustomDate ? 'custom' : dateFilter
      })
      
      if (useCustomDate && startDate && endDate) {
        params.append('startDate', startDate)
        params.append('endDate', endDate)
      }
      if (cohortSeq) {
        params.append('cohortSeq', String(cohortSeq))
      }
      
      const url = `${API_URL}/daily-sales-by-user?${params.toString()}`
      
      const response = await fetch(url)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const result = await response.json()
      
      if (result.success) {
        processUserChartData(result.data)
      }
    } catch (error) {
      console.error('사용자별 차트 데이터 조회 오류:', error)
    }
  }

  // 사용자별 차트 데이터 처리
  const processUserChartData = (data: UserDailySales[]) => {
    // 날짜를 집계 기준에 따라 변환하는 함수
    const getAggregatedDateKey = (dateStr: string): string => {
      const date = new Date(dateStr.split('T')[0])
      
      if (aggregationType === 'day') {
        return dateStr.split('T')[0]
      } else if (aggregationType === 'week') {
        // 주 단위: 해당 주의 월요일 날짜
        const day = date.getDay()
        const diff = date.getDate() - day + (day === 0 ? -6 : 1) // 월요일로 조정
        const monday = new Date(date.setDate(diff))
        const year = monday.getFullYear()
        const month = String(monday.getMonth() + 1).padStart(2, '0')
        const dayNum = String(monday.getDate()).padStart(2, '0')
        return `${year}-${month}-${dayNum}`
      } else { // month
        // 월 단위: YYYY-MM
        const year = date.getFullYear()
        const month = String(date.getMonth() + 1).padStart(2, '0')
        return `${year}-${month}`
      }
    }

    // 날짜 레이블 형식 지정
    const formatDateLabel = (dateKey: string): string => {
      if (aggregationType === 'day') {
        return dateKey
      } else if (aggregationType === 'week') {
        // 주 단위: MM/DD~ 형식
        const date = new Date(dateKey)
        const endDate = new Date(date)
        endDate.setDate(endDate.getDate() + 6)
        return `${dateKey} (주)`
      } else { // month
        // 월 단위: YYYY-MM 형식
        return dateKey
      }
    }
    
    // 사용자별로 데이터 그룹화
    const userMap: { [userId: string]: UserChartData } = {}
    const allDates = new Set<string>()
    const totalSalesByDate: { [date: string]: number } = {}
    const rawDataByUserAndDate: { [userId: string]: { [date: string]: number } } = {}

    data.forEach(item => {
      const aggregatedDateKey = getAggregatedDateKey(item.pay_date)
      allDates.add(aggregatedDateKey)
      
      // 사용자별 데이터 추가
      if (!userMap[item.user_id]) {
        userMap[item.user_id] = {
          user_id: item.user_id,
          user_name: item.user_name,
          dates: [],
          sales: []
        }
      }

      // 사용자별 날짜별 매출 합산
      if (!rawDataByUserAndDate[item.user_id]) {
        rawDataByUserAndDate[item.user_id] = {}
      }
      if (!rawDataByUserAndDate[item.user_id][aggregatedDateKey]) {
        rawDataByUserAndDate[item.user_id][aggregatedDateKey] = 0
      }
      rawDataByUserAndDate[item.user_id][aggregatedDateKey] += Number(item.total_sales) || 0
      
      // 전체 합계 계산
      if (!totalSalesByDate[aggregatedDateKey]) {
        totalSalesByDate[aggregatedDateKey] = 0
      }
      totalSalesByDate[aggregatedDateKey] += Number(item.total_sales) || 0
    })

    // 날짜 정렬
    const sortedDates = Array.from(allDates).sort()

    // 각 사용자별로 날짜별 데이터 채우기
    Object.values(userMap).forEach(user => {
      const salesMap = rawDataByUserAndDate[user.user_id] || {}
      
      // 모든 날짜에 대해 데이터 채우기 (없는 날짜는 0)
      user.dates = sortedDates.map(date => formatDateLabel(date))
      user.sales = sortedDates.map(date => salesMap[date] || 0)
    })

    // 전체 합계 차트 데이터
    const totalSales = sortedDates.map(date => totalSalesByDate[date] || 0)
    const formattedDates = sortedDates.map(date => formatDateLabel(date))
    
    // 총 매출액 순으로 정렬 (내림차순)
    const sortedUserChartData = Object.values(userMap).sort((a, b) => {
      const totalSalesA = a.sales.reduce((sum, sale) => sum + sale, 0)
      const totalSalesB = b.sales.reduce((sum, sale) => sum + sale, 0)
      return totalSalesB - totalSalesA
    })
    
    setUserChartData(sortedUserChartData)
    setTotalChartData({ dates: formattedDates, sales: totalSales })
  }

  // 숫자 포맷팅
  const formatNumber = (num: number): string => {
    return num.toLocaleString('ko-KR')
  }

  // 전체 합계 계산 (마켓별, 스토어별)
  const calculateGrandTotal = () => {
    const marketTotals: { [market: string]: { [store: string]: { order_cnt: number, pay_anmt: number, pre_amt: number } } } = {}
    const marketGrandTotals: { [market: string]: { order_cnt: number, pay_anmt: number, pre_amt: number } } = {}
    let grandTotal = { order_cnt: 0, pay_anmt: 0, pre_amt: 0 }

    stats.forEach(item => {
      const orderCnt = Number(item.order_cnt) || 0
      const payAnmt = Number(item.pay_anmt) || 0
      const preAmt = Number(item.pre_amt) || 0

      // 마켓별 스토어별 합계
      if (!marketTotals[item.market]) {
        marketTotals[item.market] = {}
      }
      if (!marketTotals[item.market][item.store]) {
        marketTotals[item.market][item.store] = { order_cnt: 0, pay_anmt: 0, pre_amt: 0 }
      }
      marketTotals[item.market][item.store].order_cnt += orderCnt
      marketTotals[item.market][item.store].pay_anmt += payAnmt
      marketTotals[item.market][item.store].pre_amt += preAmt

      // 마켓별 합계
      if (!marketGrandTotals[item.market]) {
        marketGrandTotals[item.market] = { order_cnt: 0, pay_anmt: 0, pre_amt: 0 }
      }
      marketGrandTotals[item.market].order_cnt += orderCnt
      marketGrandTotals[item.market].pay_anmt += payAnmt
      marketGrandTotals[item.market].pre_amt += preAmt

      // 전체 합계
      grandTotal.order_cnt += orderCnt
      grandTotal.pay_anmt += payAnmt
      grandTotal.pre_amt += preAmt
    })

    return { marketTotals, marketGrandTotals, grandTotal }
  }

  const { marketTotals, marketGrandTotals, grandTotal } = calculateGrandTotal()

  return (
    <div className="daily-sales-stats-page">
      {/* 페이지 헤더 */}
      <div className="page-header">
        <h1 className="page-title">📊 사용자별 매출 추이</h1>
      </div>

      {/* 검색 조건 */}
      <div className="search-section">
        {/* 날짜 필터 */}
        <div className="date-filters">
          <button 
            className={dateFilter === 'today' && !useCustomDate ? 'active' : ''}
            onClick={() => { setDateFilter('today'); setUseCustomDate(false); setSubscriptionBasis(false); }}
          >
            오늘
          </button>
          <button 
            className={dateFilter === 'yesterday' && !useCustomDate ? 'active' : ''}
            onClick={() => { setDateFilter('yesterday'); setUseCustomDate(false); setSubscriptionBasis(false); }}
          >
            어제
          </button>
          <button 
            className={dateFilter === 'thisWeek' && !useCustomDate ? 'active' : ''}
            onClick={() => { setDateFilter('thisWeek'); setUseCustomDate(false); setSubscriptionBasis(false); }}
          >
            이번주
          </button>
          <button 
            className={dateFilter === 'lastWeek' && !useCustomDate ? 'active' : ''}
            onClick={() => { setDateFilter('lastWeek'); setUseCustomDate(false); setSubscriptionBasis(false); }}
          >
            지난주
          </button>
          <button 
            className={dateFilter === 'thisMonth' && !useCustomDate ? 'active' : ''}
            onClick={() => { setDateFilter('thisMonth'); setUseCustomDate(false); setSubscriptionBasis(false); }}
          >
            이번달
          </button>
          <button 
            className={dateFilter === 'lastMonth' && !useCustomDate ? 'active' : ''}
            onClick={() => { setDateFilter('lastMonth'); setUseCustomDate(false); setSubscriptionBasis(false); }}
          >
            지난달
          </button>
          {recentMonths.map((monthInfo) => (
            <button 
              key={monthInfo.key}
              className={dateFilter === monthInfo.key && !useCustomDate ? 'active' : ''}
              onClick={() => { setDateFilter(monthInfo.key); setUseCustomDate(false); setSubscriptionBasis(false); }}
            >
              {monthInfo.label}
            </button>
          ))}
          <button 
            className={`date-picker-btn ${useCustomDate && !subscriptionBasis ? 'active' : ''}`}
            onClick={openDateModal}
          >
            📅 기간선택
          </button>
          <button 
            className={`date-picker-btn ${subscriptionBasis ? 'active' : ''}`}
            onClick={handleSubscriptionBasis}
          >
            📌 구독기준
          </button>
          {useCustomDate && startDate && endDate && (
            <span className="selected-date-range">
              {startDate} ~ {endDate}
            </span>
          )}
        </div>

        <div className="filter-divider"></div>

        {/* 합계 기준 선택 */}
        <div className="aggregation-section">
          <span className="filter-label">기수:</span>
          <select
            value={cohortSeq}
            onChange={(e) => setCohortSeq(e.target.value ? Number(e.target.value) : '')}
            style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #ddd', marginRight: '12px' }}
          >
            <option value="">전체</option>
            {cohorts.map((c) => (
              <option key={c.seq} value={c.seq}>{c.cohort_name}</option>
            ))}
          </select>
          <span className="filter-label">합계기준:</span>
          <div className="aggregation-buttons">
            <button 
              className={aggregationType === 'day' ? 'active' : ''}
              onClick={() => setAggregationType('day')}
            >
              일
            </button>
            <button 
              className={aggregationType === 'week' ? 'active' : ''}
              onClick={() => setAggregationType('week')}
            >
              주
            </button>
            <button 
              className={aggregationType === 'month' ? 'active' : ''}
              onClick={() => setAggregationType('month')}
            >
              월
            </button>
          </div>
        </div>
      </div>

      {/* 사용자별 매출 Bar Chart */}
      {!loading && userChartData.length > 0 && (
        <div className="chart-section">
          {/* 사용자별 차트 */}
          <div className="user-charts-container">
            {userChartData.map((userData) => {
              // 총 매출액 계산 (만원 단위)
              const totalSales = userData.sales.reduce((sum, sale) => sum + sale, 0)
              const totalSalesInManwon = Math.floor(totalSales / 10000)
              
              return (
              <div key={userData.user_id} className="user-chart-row">
                <div className="user-chart-label">
                  <span className="user-name">{userData.user_name}</span>
                  <span className="user-total-sales">({totalSalesInManwon.toLocaleString('ko-KR')}만원)</span>
                </div>
                <div className="user-chart-wrapper">
                  <Bar
                    data={{
                      labels: userData.dates,
                      datasets: [
                        {
                          label: '매출 (만원)',
                          data: userData.sales.map(s => Math.floor(s / 10000)),
                          backgroundColor: userData.sales.map(s => {
                            const valueInManwon = Math.floor(s / 10000)
                            return valueInManwon >= 30 ? 'rgba(186, 104, 200, 0.7)' : 'rgba(54, 162, 235, 0.7)'
                          }),
                          borderColor: userData.sales.map(s => {
                            const valueInManwon = Math.floor(s / 10000)
                            return valueInManwon >= 30 ? 'rgba(186, 104, 200, 1)' : 'rgba(54, 162, 235, 1)'
                          }),
                          borderWidth: 1
                        }
                      ]
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: {
                          display: false
                        },
                        tooltip: {
                          callbacks: {
                            label: (context) => {
                              const valueInWon = (context.parsed.y || 0) * 10000
                              return `매출: ${Math.floor(valueInWon / 10000).toLocaleString('ko-KR')} 만원`
                            }
                          }
                        }
                      },
                      scales: {
                        y: {
                          beginAtZero: true,
                          ticks: {
                            callback: (value) => {
                              return `${Number(value).toLocaleString('ko-KR')} 만원`
                            }
                          }
                        }
                      }
                    }}
                  />
                </div>
              </div>
            )
            })}
          </div>

          {/* 전체 합계 차트 */}
          <div className="total-chart-container">
            <h3 className="total-chart-title">
              전체 합계 ({Math.floor(totalChartData.sales.reduce((sum, sale) => sum + sale, 0) / 10000).toLocaleString('ko-KR')}만원)
            </h3>
            <div className="total-chart-wrapper">
              <Bar
                plugins={[ChartDataLabels]}
                data={{
                  labels: totalChartData.dates,
                  datasets: [
                    {
                      label: '전체 매출 (만원)',
                      data: totalChartData.sales.map(s => Math.floor(s / 10000)),
                      backgroundColor: getTotalChartBackgroundColors(totalChartData.dates, selectedWeekday),
                      borderColor: getTotalChartBorderColors(totalChartData.dates, selectedWeekday),
                      borderWidth: getTotalChartBorderWidths(totalChartData.dates, selectedWeekday)
                    }
                  ]
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  onClick: (_event, elements) => {
                    if (elements.length === 0) return
                    const index = elements[0].index
                    const dateStr = totalChartData.dates[index]
                    if (!dateStr) return
                    const dayOfWeek = getDayOfWeekFromLabel(dateStr)
                    setSelectedWeekday(prev => (prev === dayOfWeek ? null : dayOfWeek))
                  },
                  plugins: {
                    legend: {
                      display: false
                    },
                    tooltip: {
                      callbacks: {
                        title: (context) => {
                          const dateStr = context[0].label
                          const dayOfWeek = getDayOfWeekFromLabel(dateStr)
                          return `${dateStr} (${DAY_NAMES[dayOfWeek]})`
                        },
                        label: (context) => {
                          const valueInWon = (context.parsed.y || 0) * 10000
                          return `전체 매출: ${Math.floor(valueInWon / 10000).toLocaleString('ko-KR')} 만원`
                        }
                      }
                    },
                    datalabels: {
                      display: (context) => {
                        const value = context.dataset.data[context.dataIndex] as number
                        if (!value) return false
                        if (selectedWeekday === null) return true
                        const dateStr = totalChartData.dates[context.dataIndex]
                        if (!dateStr) return false
                        return getDayOfWeekFromLabel(dateStr) === selectedWeekday
                      },
                      color: '#333333',
                      backgroundColor: 'transparent',
                      font: {
                        size: 11,
                        weight: 'normal'
                      },
                      anchor: 'center',
                      align: 'center',
                      offset: 0,
                      formatter: (value: number) => {
                        if (!value) return ''
                        return Number(value).toLocaleString('ko-KR')
                      }
                    }
                  },
                  scales: {
                    y: {
                      beginAtZero: true,
                      ticks: {
                        callback: (value) => {
                          return `${Number(value).toLocaleString('ko-KR')} 만원`
                        }
                      }
                    }
                  }
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* 통계 테이블 */}
      <div className="daily-stats-table-container">
        {loading ? (
          <div className="daily-loading-message">데이터를 불러오는 중입니다...</div>
        ) : stats.length > 0 && (
          <table className="daily-stats-table">
            <thead>
              <tr>
                <th rowSpan={2} className="daily-header-date">일자</th>
                <th rowSpan={2} className="daily-header-market">마켓</th>
                <th colSpan={3} className="daily-header-market-total">마켓 별</th>
                <th colSpan={3} className="daily-header-day-total">일 합계</th>
              </tr>
              <tr>
                <th className="daily-header-market-total">주문수</th>
                <th className="daily-header-market-total">매출</th>
                <th className="daily-header-market-total">예상수익</th>
                <th className="daily-header-day-total">주문수</th>
                <th className="daily-header-day-total">매출</th>
                <th className="daily-header-day-total">예상수익</th>
              </tr>
            </thead>
            <tbody>
              {groupedData.map((dayData, dayIndex) => {
                const marketEntries = Object.entries(dayData.markets)
                const dayRowSpan = marketEntries.reduce((sum, [, m]) => sum + m.stores.length, 0)
                let rowIndex = 0

                return (
                  <React.Fragment key={dayIndex}>
                    {marketEntries.map(([marketName, marketData], marketIndex) => {
                      return marketData.stores.map((_store, storeIndex) => {
                        const isFirstRowOfDay = rowIndex === 0
                        const isFirstRowOfMarket = storeIndex === 0
                        const marketRowSpan = marketData.stores.length
                        const isLastRowOfDay = rowIndex === dayRowSpan - 1

                        rowIndex++

                        return (
                          <tr 
                            key={`${dayIndex}-${marketIndex}-${storeIndex}`}
                            className={isLastRowOfDay ? 'daily-last-row-of-day' : ''}
                          >
                            {isFirstRowOfDay && (
                              <td 
                                rowSpan={dayRowSpan} 
                                className="daily-date-cell has-bottom-border"
                              >
                                {dayData.date}
                              </td>
                            )}
                            {isFirstRowOfMarket && (
                              <td rowSpan={marketRowSpan} className="daily-market-cell">
                                {marketName}
                              </td>
                            )}
                            {isFirstRowOfMarket && (
                              <>
                                <td rowSpan={marketRowSpan} className="daily-number-cell daily-market-total">
                                  {formatNumber(marketData.marketTotal.order_cnt)}
                                </td>
                                <td rowSpan={marketRowSpan} className="daily-number-cell daily-market-total">
                                  {formatNumber(marketData.marketTotal.pay_anmt)}
                                </td>
                                <td rowSpan={marketRowSpan} className="daily-number-cell daily-market-total">
                                  {formatNumber(marketData.marketTotal.pre_amt)}
                                </td>
                              </>
                            )}
                            {isFirstRowOfDay && (
                              <>
                                <td 
                                  rowSpan={dayRowSpan} 
                                  className="daily-number-cell daily-day-total has-bottom-border"
                                >
                                  {formatNumber(dayData.dayTotal.order_cnt)}
                                </td>
                                <td 
                                  rowSpan={dayRowSpan} 
                                  className="daily-number-cell daily-day-total has-bottom-border"
                                >
                                  {formatNumber(dayData.dayTotal.pay_anmt)}
                                </td>
                                <td 
                                  rowSpan={dayRowSpan} 
                                  className="daily-number-cell daily-day-total has-bottom-border"
                                >
                                  {formatNumber(dayData.dayTotal.pre_amt)}
                                </td>
                              </>
                            )}
                          </tr>
                        )
                      })
                    })}
                  </React.Fragment>
                )
              })}
              {/* 전체 합계 - 마켓별, 스토어별 */}
              {Object.entries(marketTotals).map(([marketName, stores], marketIndex) => {
                const marketTotal = marketGrandTotals[marketName]
                const storeEntries = Object.entries(stores)
                
                return (
                  <React.Fragment key={`total-${marketIndex}`}>
                    {storeEntries.map(([_storeName, _storeTotal], storeIndex) => {
                      const isFirstStoreOfMarket = storeIndex === 0
                      const marketRowSpan = storeEntries.length

                      return (
                        <tr key={`total-${marketIndex}-${storeIndex}`} className="daily-total-row">
                          {marketIndex === 0 && storeIndex === 0 && (
                            <td rowSpan={Object.values(marketTotals).reduce((sum, s) => sum + Object.keys(s).length, 0)} className="daily-total-label">
                              합계
                            </td>
                          )}
                          {isFirstStoreOfMarket && (
                            <td rowSpan={marketRowSpan} className="daily-market-cell">
                              {marketName}
                            </td>
                          )}
                          {isFirstStoreOfMarket && (
                            <>
                              <td rowSpan={marketRowSpan} className="daily-number-cell daily-market-total">
                                {formatNumber(marketTotal.order_cnt)}
                              </td>
                              <td rowSpan={marketRowSpan} className="daily-number-cell daily-market-total">
                                {formatNumber(marketTotal.pay_anmt)}
                              </td>
                              <td rowSpan={marketRowSpan} className="daily-number-cell daily-market-total">
                                {formatNumber(marketTotal.pre_amt)}
                              </td>
                            </>
                          )}
                          {marketIndex === 0 && storeIndex === 0 && (
                            <>
                              <td rowSpan={Object.values(marketTotals).reduce((sum, s) => sum + Object.keys(s).length, 0)} className="daily-number-cell daily-grand-total-cell">
                                {formatNumber(grandTotal.order_cnt)}
                              </td>
                              <td rowSpan={Object.values(marketTotals).reduce((sum, s) => sum + Object.keys(s).length, 0)} className="daily-number-cell daily-grand-total-cell">
                                {formatNumber(grandTotal.pay_anmt)}
                              </td>
                              <td rowSpan={Object.values(marketTotals).reduce((sum, s) => sum + Object.keys(s).length, 0)} className="daily-number-cell daily-grand-total-cell">
                                {formatNumber(grandTotal.pre_amt)}
                              </td>
                            </>
                          )}
                        </tr>
                      )
                    })}
                  </React.Fragment>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* 날짜 선택 모달 */}
      {showDateModal && (
        <div className="daily-date-modal-overlay">
          <div className="daily-date-modal-content">
            <h3 className="daily-date-modal-title">기간 선택</h3>
            <div className="daily-date-modal-body">
              <div className="daily-date-picker-group">
                <label>시작일</label>
                <DatePicker
                  selected={tempStartDate}
                  onChange={(date: Date | null) => setTempStartDate(date)}
                  dateFormat="yyyy-MM-dd"
                  locale={ko}
                  dateFormatCalendar="yyyy년 MM월"
                  className="daily-date-input-modal"
                  placeholderText="시작일을 선택하세요"
                  showMonthDropdown
                  showYearDropdown
                  dropdownMode="select"
                  maxDate={tempEndDate || undefined}
                />
              </div>
              <div className="daily-date-picker-group">
                <label>종료일</label>
                <DatePicker
                  selected={tempEndDate}
                  onChange={(date: Date | null) => setTempEndDate(date)}
                  dateFormat="yyyy-MM-dd"
                  locale={ko}
                  dateFormatCalendar="yyyy년 MM월"
                  className="daily-date-input-modal"
                  placeholderText="종료일을 선택하세요"
                  showMonthDropdown
                  showYearDropdown
                  dropdownMode="select"
                  minDate={tempStartDate || undefined}
                />
              </div>
            </div>
            <div className="daily-date-modal-footer">
              <button className="daily-date-modal-cancel" onClick={closeDateModal}>
                취소
              </button>
              <button className="daily-date-modal-apply" onClick={handleCustomDateApply}>
                적용
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default DailySalesStatsPage
