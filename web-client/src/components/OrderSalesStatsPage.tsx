// 매출통계 페이지 컴포넌트
import React, { useState, useEffect } from 'react'
import { useUser } from '../contexts/UserContext'
import { useAlert } from '../contexts/AlertContext'
import DatePicker from 'react-datepicker'
import { ko } from 'date-fns/locale'
import 'react-datepicker/dist/react-datepicker.css'
import * as XLSX from 'xlsx'
import './DailySalesStatsPage.css'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'
const API_URL = `${API_BASE}/api/stats`

interface DailySalesStats {
  pay_date: string
  market: string
  store: string
  biz_idx: number
  order_cnt: number
  pay_anmt: number
  pre_amt: number
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

function OrderSalesStatsPage() {
  const { userInfo } = useUser()
  const { showAlert } = useAlert()
  
  // 필터 상태
  const [dateFilter, setDateFilter] = useState('thisMonth')
  const [useCustomDate, setUseCustomDate] = useState(false)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  
  // 날짜 선택 모달
  const [showDateModal, setShowDateModal] = useState(false)
  const [tempStartDate, setTempStartDate] = useState<Date | null>(null)
  const [tempEndDate, setTempEndDate] = useState<Date | null>(null)
  
  // 데이터 상태
  const [stats, setStats] = useState<DailySalesStats[]>([])
  const [groupedData, setGroupedData] = useState<GroupedData[]>([])
  const [loading, setLoading] = useState(false)

  // 데이터 로드
  useEffect(() => {
    if (userInfo?.userId) {
      loadStats()
    }
  }, [dateFilter, useCustomDate, startDate, endDate, userInfo?.userId])

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

  // 선택된 기간의 시작일과 종료일 계산
  const getDateRange = (): { start: Date, end: Date } => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    if (useCustomDate && startDate && endDate) {
      return {
        start: new Date(startDate),
        end: new Date(endDate)
      }
    }

    let start = new Date(today)
    let end = new Date(today)

    switch(dateFilter) {
      case 'today':
        break
      case 'yesterday':
        start.setDate(start.getDate() - 1)
        end.setDate(end.getDate() - 1)
        break
      case 'thisWeek':
        const dayOfWeek = today.getDay()
        const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
        start.setDate(today.getDate() + diff)
        break
      case 'lastWeek':
        const lastWeekStart = new Date(today)
        const lastWeekDayOfWeek = today.getDay()
        const lastWeekDiff = lastWeekDayOfWeek === 0 ? -13 : -6 - lastWeekDayOfWeek
        lastWeekStart.setDate(today.getDate() + lastWeekDiff)
        const lastWeekEnd = new Date(lastWeekStart)
        lastWeekEnd.setDate(lastWeekStart.getDate() + 6)
        start = lastWeekStart
        end = lastWeekEnd
        break
      case 'thisMonth':
        start = new Date(today.getFullYear(), today.getMonth(), 1)
        break
      case 'lastMonth':
        start = new Date(today.getFullYear(), today.getMonth() - 1, 1)
        end = new Date(today.getFullYear(), today.getMonth(), 0)
        break
      default:
        if (dateFilter.startsWith('month-')) {
          const parts = dateFilter.split('-')
          if (parts.length === 3) {
            const year = parseInt(parts[1])
            const month = parseInt(parts[2])
            start = new Date(year, month - 1, 1)
            end = new Date(year, month, 0)
          }
        }
    }

    return { start, end }
  }

  // 날짜 범위의 모든 날짜 생성
  const getAllDatesInRange = (start: Date, end: Date): string[] => {
    const dates: string[] = []
    const current = new Date(start)
    
    while (current <= end) {
      dates.push(formatDateToString(current))
      current.setDate(current.getDate() + 1)
    }
    
    return dates
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
    setDateFilter('custom')
    closeDateModal()
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

    // 먼저 데이터가 있는 날짜 처리
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

    // 선택된 기간의 모든 날짜 생성
    const { start, end } = getDateRange()
    const allDates = getAllDatesInRange(start, end)

    // 데이터가 없는 날짜도 추가
    allDates.forEach(dateKey => {
      if (!grouped[dateKey]) {
        grouped[dateKey] = {
          date: dateKey,
          markets: {},
          dayTotal: { order_cnt: 0, pay_anmt: 0, pre_amt: 0 }
        }
      }
    })

    // 모든 날짜에 대해 '스마트스토어'와 '쿠팡' 마켓이 반드시 존재하도록 보장
    Object.keys(grouped).forEach(dateKey => {
      const markets = ['스마트스토어', '쿠팡']
      markets.forEach(marketName => {
        if (!grouped[dateKey].markets[marketName]) {
          grouped[dateKey].markets[marketName] = {
            stores: [],
            marketTotal: { order_cnt: 0, pay_anmt: 0, pre_amt: 0 }
          }
        }
      })
    })

    setGroupedData(Object.values(grouped).sort((a, b) => a.date.localeCompare(b.date)))
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

    // 모든 마켓에 대해 '스마트스토어'와 '쿠팡'이 반드시 존재하도록 보장
    const markets = ['스마트스토어', '쿠팡']
    markets.forEach(marketName => {
      if (!marketGrandTotals[marketName]) {
        marketGrandTotals[marketName] = { order_cnt: 0, pay_anmt: 0, pre_amt: 0 }
      }
      if (!marketTotals[marketName]) {
        marketTotals[marketName] = {}
      }
    })

    return { marketTotals, marketGrandTotals, grandTotal }
  }

  // 엑셀 다운로드
  const handleExcelDownload = () => {
    if (stats.length === 0) {
      showAlert('다운로드할 데이터가 없습니다.')
      return
    }

    const excelData: any[] = []

    // 일자별 데이터
    groupedData.forEach(dayData => {
      Object.entries(dayData.markets).forEach(([marketName, marketData]) => {
        marketData.stores.forEach((store, storeIndex) => {
          const row: any = {
            '일자': storeIndex === 0 ? dayData.date : '',
            '마켓': storeIndex === 0 ? marketName : ''
          }
          
          // 스토어별
          row['스토어별-주문수'] = store.order_cnt
          row['스토어별-매출'] = store.pay_anmt
          row['스토어별-예상수익'] = store.pre_amt
          
          // 마켓별 (첫 번째 스토어에만)
          if (storeIndex === 0) {
            row['마켓별-주문수'] = marketData.marketTotal.order_cnt
            row['마켓별-매출'] = marketData.marketTotal.pay_anmt
            row['마켓별-예상수익'] = marketData.marketTotal.pre_amt
          } else {
            row['마켓별-주문수'] = ''
            row['마켓별-매출'] = ''
            row['마켓별-예상수익'] = ''
          }
          
          excelData.push(row)
        })
      })
      
      // 일 합계 행 추가
      const dayTotalRow: any = {
        '일자': '',
        '마켓': '',
        '스토어별-주문수': '',
        '스토어별-매출': '',
        '스토어별-예상수익': '',
        '마켓별-주문수': '',
        '마켓별-매출': '',
        '마켓별-예상수익': '',
        '일합계-주문수': dayData.dayTotal.order_cnt,
        '일합계-매출': dayData.dayTotal.pay_anmt,
        '일합계-예상수익': dayData.dayTotal.pre_amt
      }
      excelData.push(dayTotalRow)
    })

    // 빈 행
    excelData.push({})

    // 전체 합계 (마켓별, 스토어별)
    const { marketTotals: totals, marketGrandTotals: marketGT, grandTotal: gt } = calculateGrandTotal()
    
    Object.entries(totals).forEach(([marketName, stores], marketIndex) => {
      const storeEntries = Object.entries(stores)
      
      storeEntries.forEach(([_storeName, storeTotal], storeIndex) => {
        const row: any = {}
        
        // 일자 (첫 번째 마켓의 첫 번째 스토어에만)
        if (marketIndex === 0 && storeIndex === 0) {
          row['일자'] = '합계'
        } else {
          row['일자'] = ''
        }
        
        // 마켓 (각 마켓의 첫 번째 스토어에만)
        if (storeIndex === 0) {
          row['마켓'] = marketName
        } else {
          row['마켓'] = ''
        }
        
        // 스토어별
        row['스토어별-주문수'] = storeTotal.order_cnt
        row['스토어별-매출'] = storeTotal.pay_anmt
        row['스토어별-예상수익'] = storeTotal.pre_amt
        
        // 마켓별 (각 마켓의 첫 번째 스토어에만)
        if (storeIndex === 0) {
          row['마켓별-주문수'] = marketGT[marketName].order_cnt
          row['마켓별-매출'] = marketGT[marketName].pay_anmt
          row['마켓별-예상수익'] = marketGT[marketName].pre_amt
        } else {
          row['마켓별-주문수'] = ''
          row['마켓별-매출'] = ''
          row['마켓별-예상수익'] = ''
        }
        
        // 일합계 (첫 번째 마켓의 첫 번째 스토어에만)
        if (marketIndex === 0 && storeIndex === 0) {
          row['일합계-주문수'] = gt.order_cnt
          row['일합계-매출'] = gt.pay_anmt
          row['일합계-예상수익'] = gt.pre_amt
        } else {
          row['일합계-주문수'] = ''
          row['일합계-매출'] = ''
          row['일합계-예상수익'] = ''
        }
        
        excelData.push(row)
      })
    })

    const ws = XLSX.utils.json_to_sheet(excelData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '매출통계')

    const fileName = `매출통계_${formatDateToString(new Date())}.xlsx`
    XLSX.writeFile(wb, fileName)
  }

  const { marketTotals, marketGrandTotals, grandTotal } = calculateGrandTotal()

  return (
    <div className="daily-sales-stats-page">
      {/* 페이지 헤더 */}
      <div className="page-header">
        <h1 className="page-title">💰 매출통계</h1>
      </div>

      {/* 검색 조건 */}
      <div className="search-section">
        {/* 날짜 필터 */}
        <div className="date-filters">
          <button 
            className={dateFilter === 'today' && !useCustomDate ? 'active' : ''}
            onClick={() => { setDateFilter('today'); setUseCustomDate(false); }}
          >
            오늘
          </button>
          <button 
            className={dateFilter === 'yesterday' && !useCustomDate ? 'active' : ''}
            onClick={() => { setDateFilter('yesterday'); setUseCustomDate(false); }}
          >
            어제
          </button>
          <button 
            className={dateFilter === 'thisWeek' && !useCustomDate ? 'active' : ''}
            onClick={() => { setDateFilter('thisWeek'); setUseCustomDate(false); }}
          >
            이번주
          </button>
          <button 
            className={dateFilter === 'lastWeek' && !useCustomDate ? 'active' : ''}
            onClick={() => { setDateFilter('lastWeek'); setUseCustomDate(false); }}
          >
            지난주
          </button>
          <button 
            className={dateFilter === 'thisMonth' && !useCustomDate ? 'active' : ''}
            onClick={() => { setDateFilter('thisMonth'); setUseCustomDate(false); }}
          >
            이번달
          </button>
          <button 
            className={dateFilter === 'lastMonth' && !useCustomDate ? 'active' : ''}
            onClick={() => { setDateFilter('lastMonth'); setUseCustomDate(false); }}
          >
            지난달
          </button>
          {recentMonths.map((monthInfo) => (
            <button 
              key={monthInfo.key}
              className={dateFilter === monthInfo.key && !useCustomDate ? 'active' : ''}
              onClick={() => { setDateFilter(monthInfo.key); setUseCustomDate(false); }}
            >
              {monthInfo.label}
            </button>
          ))}
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

        <div className="daily-filter-actions">
          <button className="daily-excel-download-btn" onClick={handleExcelDownload}>
            📥 엑셀 다운로드
          </button>
        </div>
      </div>

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
                // 마켓 순서를 명시적으로 정렬: 스마트스토어 먼저, 쿠팡 나중에
                const marketEntries = Object.entries(dayData.markets).sort(([a], [b]) => {
                  if (a === '스마트스토어') return -1
                  if (b === '스마트스토어') return 1
                  if (a === '쿠팡') return -1
                  if (b === '쿠팡') return 1
                  return a.localeCompare(b)
                })
                
                // stores가 빈 배열인 경우에도 최소 1개의 행을 렌더링하기 위해 계산
                const dayRowSpan = marketEntries.reduce((sum, [, m]) => sum + Math.max(m.stores.length, 1), 0)
                let rowIndex = 0

                return (
                  <React.Fragment key={dayIndex}>
                    {marketEntries.map(([marketName, marketData], marketIndex) => {
                      // stores가 비어있으면 빈 데이터로 1개 행 렌더링
                      const storesToRender = marketData.stores.length > 0 ? marketData.stores : [null]
                      
                      return storesToRender.map((_store, storeIndex) => {
                        const isFirstRowOfDay = rowIndex === 0
                        const isFirstRowOfMarket = storeIndex === 0
                        const marketRowSpan = storesToRender.length
                        const isLastRowOfDay = rowIndex === dayRowSpan - 1
                        // 마켓의 마지막 행이 일자의 마지막 행인지 확인
                        const marketEndsWithDay = rowIndex + (marketRowSpan - storeIndex - 1) === dayRowSpan - 1

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
                              <td rowSpan={marketRowSpan} className={`daily-market-cell ${marketEndsWithDay ? 'has-bottom-border' : ''}`}>
                                {marketName}
                              </td>
                            )}
                            {isFirstRowOfMarket && (
                              <>
                                <td rowSpan={marketRowSpan} className={`daily-number-cell daily-market-total ${marketEndsWithDay ? 'has-bottom-border' : ''} ${marketData.marketTotal.order_cnt === 0 ? 'zero-value' : ''}`}>
                                  {formatNumber(marketData.marketTotal.order_cnt)}
                                </td>
                                <td rowSpan={marketRowSpan} className={`daily-number-cell daily-market-total ${marketEndsWithDay ? 'has-bottom-border' : ''} ${marketData.marketTotal.pay_anmt === 0 ? 'zero-value' : ''}`}>
                                  {formatNumber(marketData.marketTotal.pay_anmt)}
                                </td>
                                <td rowSpan={marketRowSpan} className={`daily-number-cell daily-market-total ${marketEndsWithDay ? 'has-bottom-border' : ''} ${marketData.marketTotal.pre_amt === 0 ? 'zero-value' : ''}`}>
                                  {formatNumber(marketData.marketTotal.pre_amt)}
                                </td>
                              </>
                            )}
                            {isFirstRowOfDay && (
                              <>
                                <td 
                                  rowSpan={dayRowSpan} 
                                  className={`daily-number-cell daily-day-total has-bottom-border ${dayData.dayTotal.order_cnt === 0 ? 'zero-value' : ''}`}
                                >
                                  {formatNumber(dayData.dayTotal.order_cnt)}
                                </td>
                                <td 
                                  rowSpan={dayRowSpan} 
                                  className={`daily-number-cell daily-day-total has-bottom-border ${dayData.dayTotal.pay_anmt === 0 ? 'zero-value' : ''}`}
                                >
                                  {formatNumber(dayData.dayTotal.pay_anmt)}
                                </td>
                                <td 
                                  rowSpan={dayRowSpan} 
                                  className={`daily-number-cell daily-day-total has-bottom-border ${dayData.dayTotal.pre_amt === 0 ? 'zero-value' : ''}`}
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
              {/* 전체 합계 - 마켓별 */}
              {Object.entries(marketTotals)
                .sort(([a], [b]) => {
                  if (a === '스마트스토어') return -1
                  if (b === '스마트스토어') return 1
                  if (a === '쿠팡') return -1
                  if (b === '쿠팡') return 1
                  return a.localeCompare(b)
                })
                .map(([marketName, stores], marketIndex) => {
                const marketTotal = marketGrandTotals[marketName]
                const storeEntries = Object.entries(stores)
                // stores가 비어있으면 최소 1개 행 렌더링
                const entriesToRender = storeEntries.length > 0 ? storeEntries : [[null, null]]
                
                return (
                  <React.Fragment key={`total-${marketIndex}`}>
                    {entriesToRender.map(([_storeName, _storeTotal], storeIndex) => {
                      const isFirstStoreOfMarket = storeIndex === 0
                      const marketRowSpan = entriesToRender.length
                      const totalRowSpan = Object.entries(marketTotals).reduce((sum, [, s]) => {
                        return sum + Math.max(Object.keys(s).length, 1)
                      }, 0)

                      return (
                        <tr key={`total-${marketIndex}-${storeIndex}`} className="daily-total-row">
                          {marketIndex === 0 && storeIndex === 0 && (
                            <td rowSpan={totalRowSpan} className="daily-total-label">
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
                              <td rowSpan={marketRowSpan} className={`daily-number-cell daily-market-total ${marketTotal.order_cnt === 0 ? 'zero-value' : ''}`}>
                                {formatNumber(marketTotal.order_cnt)}
                              </td>
                              <td rowSpan={marketRowSpan} className={`daily-number-cell daily-market-total ${marketTotal.pay_anmt === 0 ? 'zero-value' : ''}`}>
                                {formatNumber(marketTotal.pay_anmt)}
                              </td>
                              <td rowSpan={marketRowSpan} className={`daily-number-cell daily-market-total ${marketTotal.pre_amt === 0 ? 'zero-value' : ''}`}>
                                {formatNumber(marketTotal.pre_amt)}
                              </td>
                            </>
                          )}
                          {marketIndex === 0 && storeIndex === 0 && (
                            <>
                              <td rowSpan={totalRowSpan} className={`daily-number-cell daily-grand-total-cell ${grandTotal.order_cnt === 0 ? 'zero-value' : ''}`}>
                                {formatNumber(grandTotal.order_cnt)}
                              </td>
                              <td rowSpan={totalRowSpan} className={`daily-number-cell daily-grand-total-cell ${grandTotal.pay_anmt === 0 ? 'zero-value' : ''}`}>
                                {formatNumber(grandTotal.pay_anmt)}
                              </td>
                              <td rowSpan={totalRowSpan} className={`daily-number-cell daily-grand-total-cell ${grandTotal.pre_amt === 0 ? 'zero-value' : ''}`}>
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

export default OrderSalesStatsPage
