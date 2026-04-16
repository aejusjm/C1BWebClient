// 차트 섹션 컴포넌트 - 도넛 차트와 막대 차트를 포함
import { useState, useEffect } from 'react'
import { useUser } from '../contexts/UserContext'
import './ChartSection.css'
import DonutChart from './DonutChart'
import BarChart from './BarChart'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'
const API_URL = `${API_BASE}/api/orders`

interface ChartSectionProps {
  showOnlyDonutCharts?: boolean
  showOnlyBarCharts?: boolean
  dateFilter?: string
  smartStore?: boolean
  coupang?: boolean
  selectedStores?: number[]
  useCustomDate?: boolean
  startDate?: string
  endDate?: string
}

function ChartSection({ 
  showOnlyDonutCharts = false, 
  showOnlyBarCharts = false,
  dateFilter = 'today',
  smartStore = true,
  coupang = true,
  selectedStores = [],
  useCustomDate = false,
  startDate = '',
  endDate = ''
}: ChartSectionProps) {
  const { userInfo } = useUser()
  
  // 마켓별 통계
  const [marketStats, setMarketStats] = useState<Array<{market_type: string, order_count: number, total_amount: number}>>([])
  // 스토어별 통계
  const [storeStats, setStoreStats] = useState<Array<{biz_idx: number, store_name: string, order_count: number, total_amount: number}>>([])
  // 주문추이 통계
  const [orderTrend, setOrderTrend] = useState<Array<{order_date: string, market_type: string, order_count: number}>>([])
  // 매출추이 통계
  const [salesTrend, setSalesTrend] = useState<Array<{order_date: string, market_type: string, total_amount: number}>>([])
  // 차트 표시 모드 (separate: 분리, total: 합계)
  const [orderChartMode, setOrderChartMode] = useState<'separate' | 'total'>('separate')
  const [salesChartMode, setSalesChartMode] = useState<'separate' | 'total'>('separate')
  // 도넛 차트 탭 (market: 마켓별, store: 스토어별)
  const [donutTab, setDonutTab] = useState<'market' | 'store'>('market')

  // 마켓별 통계 로드
  useEffect(() => {
    if (userInfo?.userId && selectedStores.length > 0) {
      loadMarketStats()
    }
  }, [dateFilter, selectedStores, useCustomDate, startDate, endDate, userInfo?.userId])

  // 스토어별 통계 로드
  useEffect(() => {
    if (userInfo?.userId && selectedStores.length > 0) {
      loadStoreStats()
    }
  }, [dateFilter, smartStore, coupang, selectedStores, useCustomDate, startDate, endDate, userInfo?.userId])

  // 주문추이 로드
  useEffect(() => {
    if (userInfo?.userId && selectedStores.length > 0) {
      loadOrderTrend()
    }
  }, [dateFilter, smartStore, coupang, selectedStores, useCustomDate, startDate, endDate, userInfo?.userId])

  // 매출추이 로드
  useEffect(() => {
    if (userInfo?.userId && selectedStores.length > 0) {
      loadSalesTrend()
    }
  }, [dateFilter, smartStore, coupang, selectedStores, useCustomDate, startDate, endDate, userInfo?.userId])

  const loadMarketStats = async () => {
    try {
      const storesParam = selectedStores.join(',')
      let url = `${API_URL}/dashboard/market-stats/${userInfo.userId}?dateFilter=${dateFilter}&stores=${storesParam}`
      
      // 사용자 정의 날짜 범위가 설정된 경우
      if (useCustomDate && startDate && endDate) {
        url += `&startDate=${startDate}&endDate=${endDate}`
      }
      
      console.log('마켓별 통계 요청 URL:', url)
      
      const response = await fetch(url)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const result = await response.json()
      
      console.log('마켓별 통계 응답:', result)
      
      if (result.success) {
        setMarketStats(result.data || [])
      }
    } catch (error) {
      console.error('마켓별 통계 로드 오류:', error)
      setMarketStats([])
    }
  }

  const loadStoreStats = async () => {
    try {
      const storesParam = selectedStores.join(',')
      let url = `${API_URL}/dashboard/store-stats/${userInfo.userId}?dateFilter=${dateFilter}&smartStore=${smartStore}&coupang=${coupang}&stores=${storesParam}`
      
      // 사용자 정의 날짜 범위가 설정된 경우
      if (useCustomDate && startDate && endDate) {
        url += `&startDate=${startDate}&endDate=${endDate}`
      }
      
      console.log('스토어별 통계 요청 URL:', url)
      
      const response = await fetch(url)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const result = await response.json()
      
      console.log('스토어별 통계 응답:', result)
      
      if (result.success) {
        setStoreStats(result.data || [])
      }
    } catch (error) {
      console.error('스토어별 통계 로드 오류:', error)
      setStoreStats([])
    }
  }

  const loadOrderTrend = async () => {
    try {
      const storesParam = selectedStores.join(',')
      let url = `${API_URL}/dashboard/order-trend/${userInfo.userId}?dateFilter=${dateFilter}&smartStore=${smartStore}&coupang=${coupang}&stores=${storesParam}`
      
      // 사용자 정의 날짜 범위가 설정된 경우
      if (useCustomDate && startDate && endDate) {
        url += `&startDate=${startDate}&endDate=${endDate}`
      }
      
      console.log('🔍 주문추이 요청 - dateFilter:', dateFilter, 'useCustomDate:', useCustomDate, 'URL:', url)
      
      const response = await fetch(url)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const result = await response.json()
      
      console.log('주문추이 응답:', result)
      
      if (result.success) {
        setOrderTrend(result.data || [])
      }
    } catch (error) {
      console.error('주문추이 로드 오류:', error)
      setOrderTrend([])
    }
  }

  const loadSalesTrend = async () => {
    try {
      const storesParam = selectedStores.join(',')
      let url = `${API_URL}/dashboard/sales-trend/${userInfo.userId}?dateFilter=${dateFilter}&smartStore=${smartStore}&coupang=${coupang}&stores=${storesParam}`
      
      // 사용자 정의 날짜 범위가 설정된 경우
      if (useCustomDate && startDate && endDate) {
        url += `&startDate=${startDate}&endDate=${endDate}`
      }
      
      console.log('🔍 매출추이 요청 - dateFilter:', dateFilter, 'useCustomDate:', useCustomDate, 'URL:', url)
      
      const response = await fetch(url)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const result = await response.json()
      
      console.log('매출추이 응답:', result)
      
      if (result.success) {
        setSalesTrend(result.data || [])
      }
    } catch (error) {
      console.error('매출추이 로드 오류:', error)
      setSalesTrend([])
    }
  }
  // 마켓별 주문 데이터 - API 데이터 기반
  const marketLabels: string[] = []
  const marketValues: number[] = []
  const marketAmounts: number[] = []
  const marketColors: string[] = []
  const marketBorderColors: string[] = []
  
  marketStats.forEach((stat) => {
    if (stat.market_type === 'SS' && smartStore) {
      marketLabels.push('스마트스토어')
      marketValues.push(stat.order_count)
      marketAmounts.push(Number(stat.total_amount) || 0)
      marketColors.push('rgba(59, 130, 246, 0.9)')
      marketBorderColors.push('rgba(59, 130, 246, 1)')
    } else if (stat.market_type === 'CP' && coupang) {
      marketLabels.push('쿠팡')
      marketValues.push(stat.order_count)
      marketAmounts.push(Number(stat.total_amount) || 0)
      marketColors.push('rgba(16, 185, 129, 0.9)')
      marketBorderColors.push('rgba(16, 185, 129, 1)')
    }
  })

  const marketData = {
    labels: marketLabels,
    datasets: [{
      data: marketValues,
      amounts: marketAmounts,
      backgroundColor: marketColors,
      borderColor: marketBorderColors,
      borderWidth: 3,
      hoverOffset: 8
    }]
  }

  console.log('마켓별 차트 데이터:', marketData)

  // 스토어별 주문 데이터 - API 데이터 기반
  const storeLabels: string[] = []
  const storeValues: number[] = []
  const storeAmounts: number[] = []
  const storeColors = ['rgba(168, 85, 247, 0.9)', 'rgba(236, 72, 153, 0.9)', 'rgba(251, 191, 36, 0.9)', 'rgba(99, 102, 241, 0.9)', 'rgba(239, 68, 68, 0.9)']
  const storeBorderColors = ['rgba(168, 85, 247, 1)', 'rgba(236, 72, 153, 1)', 'rgba(251, 191, 36, 1)', 'rgba(99, 102, 241, 1)', 'rgba(239, 68, 68, 1)']
  const storeBackgroundColors: string[] = []
  const storeBorderColorsList: string[] = []
  
  storeStats.forEach((stat, index) => {
    storeLabels.push(stat.store_name)
    storeValues.push(stat.order_count)
    storeAmounts.push(Number(stat.total_amount) || 0)
    storeBackgroundColors.push(storeColors[index % storeColors.length])
    storeBorderColorsList.push(storeBorderColors[index % storeBorderColors.length])
  })

  const storeData = {
    labels: storeLabels,
    datasets: [{
      data: storeValues,
      amounts: storeAmounts,
      backgroundColor: storeBackgroundColors,
      borderColor: storeBorderColorsList,
      borderWidth: 3,
      hoverOffset: 8
    }]
  }

  console.log('스토어별 차트 데이터:', storeData)

  // 한국 시간(KST) 기준 날짜 생성 함수
  const getKoreanDate = (offset: number = 0) => {
    const now = new Date()
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000)
    const kst = new Date(utc + (9 * 3600000)) // UTC+9
    kst.setDate(kst.getDate() + offset)
    return kst
  }

  // 날짜를 YYYY-MM-DD 형식으로 변환
  const formatDate = (date: Date) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  // 날짜 범위 생성 함수
  const getDateRange = () => {
    const dates = []
    
    // 사용자 정의 날짜 범위가 설정된 경우
    if (useCustomDate && startDate && endDate) {
      const start = new Date(startDate)
      const end = new Date(endDate)
      
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        dates.push(formatDate(d))
      }
      return dates
    }
    
    if (dateFilter === 'today') {
      // 오늘만 (한국 시간)
      const today = getKoreanDate(0)
      dates.push(formatDate(today))
    } else if (dateFilter === 'yesterday') {
      // 어제만 (한국 시간)
      const yesterday = getKoreanDate(-1)
      dates.push(formatDate(yesterday))
    } else if (dateFilter === 'thisWeek') {
      // 이번 주 일요일부터 토요일까지 (한국 시간)
      const today = getKoreanDate(0)
      const dayOfWeek = today.getDay() // 0(일요일) ~ 6(토요일)
      const sunday = new Date(today)
      sunday.setDate(today.getDate() - dayOfWeek)
      const saturday = new Date(sunday)
      saturday.setDate(sunday.getDate() + 6)
      
      for (let d = new Date(sunday); d <= saturday; d.setDate(d.getDate() + 1)) {
        dates.push(formatDate(d))
      }
    } else if (dateFilter === 'lastWeek') {
      // 지난 주 일요일부터 토요일까지 (한국 시간)
      const today = getKoreanDate(0)
      const dayOfWeek = today.getDay()
      const lastSunday = new Date(today)
      lastSunday.setDate(today.getDate() - dayOfWeek - 7)
      const lastSaturday = new Date(lastSunday)
      lastSaturday.setDate(lastSunday.getDate() + 6)
      
      for (let d = new Date(lastSunday); d <= lastSaturday; d.setDate(d.getDate() + 1)) {
        dates.push(formatDate(d))
      }
    } else if (dateFilter === 'thisMonth') {
      // 이번 달 1일부터 오늘까지 (한국 시간)
      const today = getKoreanDate(0)
      const year = today.getFullYear()
      const month = today.getMonth()
      const firstDay = new Date(year, month, 1)
      const lastDay = today
      
      for (let d = new Date(firstDay); d <= lastDay; d.setDate(d.getDate() + 1)) {
        dates.push(formatDate(d))
      }
    } else if (dateFilter === 'lastMonth') {
      // 지난 달 1일부터 마지막 날까지 (한국 시간)
      const today = getKoreanDate(0)
      const year = today.getFullYear()
      const month = today.getMonth()
      const firstDay = new Date(year, month - 1, 1)
      const lastDay = new Date(year, month, 0)
      
      for (let d = new Date(firstDay); d <= lastDay; d.setDate(d.getDate() + 1)) {
        dates.push(formatDate(d))
      }
    }
    
    return dates
  }

  // 주문추이 데이터 생성
  const dateRange = getDateRange()
  console.log('📅 생성된 날짜 범위:', dateRange)
  console.log('📊 주문추이 원본 데이터:', orderTrend)
  
  const orderTrendLabels = dateRange.map(date => {
    const d = new Date(date)
    return `${d.getMonth() + 1}/${d.getDate()}`
  })
  
  // 스마트스토어 주문 데이터
  const ssOrderData = dateRange.map(date => {
    const found = orderTrend.find(item => 
      item.order_date.split('T')[0] === date && item.market_type === 'SS'
    )
    return found ? found.order_count : 0
  })
  
  // 쿠팡 주문 데이터
  const cpOrderData = dateRange.map(date => {
    const found = orderTrend.find(item => 
      item.order_date.split('T')[0] === date && item.market_type === 'CP'
    )
    return found ? found.order_count : 0
  })
  
  console.log('📈 스마트스토어 주문 데이터:', ssOrderData)
  console.log('📈 쿠팡 주문 데이터:', cpOrderData)

  // 전체 주문 데이터 (합산)
  const totalOrderData = dateRange.map((_date, index) => {
    return ssOrderData[index] + cpOrderData[index]
  })

  const orderTrendData = {
    labels: orderTrendLabels,
    datasets: orderChartMode === 'total' ? [
      {
        label: '전체',
        data: totalOrderData,
        backgroundColor: 'rgba(99, 102, 241, 0.85)',
        borderColor: 'rgba(99, 102, 241, 1)',
        borderWidth: 2,
        borderRadius: 6,
        borderSkipped: false
      }
    ] : [
      {
        label: '스마트스토어',
        data: ssOrderData,
        backgroundColor: 'rgba(59, 130, 246, 0.85)',
        borderColor: 'rgba(59, 130, 246, 1)',
        borderWidth: 2,
        borderRadius: 6,
        borderSkipped: false
      },
      {
        label: '쿠팡',
        data: cpOrderData,
        backgroundColor: 'rgba(16, 185, 129, 0.85)',
        borderColor: 'rgba(16, 185, 129, 1)',
        borderWidth: 2,
        borderRadius: 6,
        borderSkipped: false
      }
    ]
  }

  // 매출추이 데이터 생성
  console.log('💰 매출추이 원본 데이터:', salesTrend)
  
  // 스마트스토어 매출 데이터
  const ssSalesData = dateRange.map(date => {
    const found = salesTrend.find(item => 
      item.order_date.split('T')[0] === date && item.market_type === 'SS'
    )
    return found ? Number(found.total_amount) || 0 : 0
  })
  
  // 쿠팡 매출 데이터
  const cpSalesData = dateRange.map(date => {
    const found = salesTrend.find(item => 
      item.order_date.split('T')[0] === date && item.market_type === 'CP'
    )
    return found ? Number(found.total_amount) || 0 : 0
  })

  console.log('💰 스마트스토어 매출 데이터:', ssSalesData)
  console.log('💰 쿠팡 매출 데이터:', cpSalesData)

  // 전체 매출 데이터 (합산)
  const totalSalesData = dateRange.map((_date, index) => {
    return ssSalesData[index] + cpSalesData[index]
  })

  const salesTrendData = {
    labels: orderTrendLabels,
    datasets: salesChartMode === 'total' ? [
      {
        label: '전체',
        data: totalSalesData,
        backgroundColor: 'rgba(139, 92, 246, 0.85)',
        borderColor: 'rgba(139, 92, 246, 1)',
        borderWidth: 2,
        borderRadius: 6,
        borderSkipped: false
      }
    ] : [
      {
        label: '스마트스토어',
        data: ssSalesData,
        backgroundColor: 'rgba(168, 85, 247, 0.85)',
        borderColor: 'rgba(168, 85, 247, 1)',
        borderWidth: 2,
        borderRadius: 6,
        borderSkipped: false
      },
      {
        label: '쿠팡',
        data: cpSalesData,
        backgroundColor: 'rgba(236, 72, 153, 0.85)',
        borderColor: 'rgba(236, 72, 153, 1)',
        borderWidth: 2,
        borderRadius: 6,
        borderSkipped: false
      }
    ]
  }

  return (
    <div className="chart-section">
      {/* 도넛 차트 - 탭으로 통합 */}
      {(showOnlyDonutCharts || (!showOnlyDonutCharts && !showOnlyBarCharts)) && (
        <div className="donut-chart-single">
          <div className="chart-container">
            <div className="chart-header-with-tabs">
              <h3 className="chart-title">📊 주문 현황</h3>
              <div className="chart-tabs">
                <button 
                  className={donutTab === 'market' ? 'active' : ''}
                  onClick={() => setDonutTab('market')}
                >
                  마켓별
                </button>
                <button 
                  className={donutTab === 'store' ? 'active' : ''}
                  onClick={() => setDonutTab('store')}
                >
                  스토어별
                </button>
              </div>
            </div>
            {donutTab === 'market' ? (
              marketValues.length > 0 ? (
                <DonutChart data={marketData} />
              ) : (
                <div style={{ padding: '40px', textAlign: 'center', color: '#999' }}>
                  데이터가 없습니다
                </div>
              )
            ) : (
              storeValues.length > 0 ? (
                <DonutChart data={storeData} />
              ) : (
                <div style={{ padding: '40px', textAlign: 'center', color: '#999' }}>
                  데이터가 없습니다
                </div>
              )
            )}
          </div>
        </div>
      )}

      {/* 막대 차트 2개 - showOnlyBarCharts가 true이거나 둘 다 false일 때 표시 */}
      {(showOnlyBarCharts || (!showOnlyDonutCharts && !showOnlyBarCharts)) && (
        <div className="bar-charts-row">
          <div className="chart-container">
            <div className="chart-header">
              <h3 className="chart-title">주문추이</h3>
              <div className="chart-mode-buttons">
                <button 
                  className={orderChartMode === 'separate' ? 'active' : ''}
                  onClick={() => setOrderChartMode('separate')}
                >
                  구분
                </button>
                <button 
                  className={orderChartMode === 'total' ? 'active' : ''}
                  onClick={() => setOrderChartMode('total')}
                >
                  전체
                </button>
              </div>
            </div>
            <BarChart data={orderTrendData} type="count" />
          </div>
          <div className="chart-container">
            <div className="chart-header">
              <h3 className="chart-title">매출추이</h3>
              <div className="chart-mode-buttons">
                <button 
                  className={salesChartMode === 'separate' ? 'active' : ''}
                  onClick={() => setSalesChartMode('separate')}
                >
                  구분
                </button>
                <button 
                  className={salesChartMode === 'total' ? 'active' : ''}
                  onClick={() => setSalesChartMode('total')}
                >
                  전체
                </button>
              </div>
            </div>
            <BarChart data={salesTrendData} type="amount" />
          </div>
        </div>
      )}
    </div>
  )
}

export default ChartSection
