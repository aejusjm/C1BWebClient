// 일자별 매출 통계 페이지 컴포넌트
import React, { useState, useEffect } from 'react'
import { useUser } from '../contexts/UserContext'
import { useAlert } from '../contexts/AlertContext'
import DatePicker from 'react-datepicker'
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

function DailySalesStatsPage() {
  const { userInfo } = useUser()
  const { showAlert } = useAlert()
  
  // 필터 상태
  const [dateFilter, setDateFilter] = useState('today')
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
    XLSX.utils.book_append_sheet(wb, ws, '일자별 매출통계')

    const fileName = `일자별_매출통계_${formatDateToString(new Date())}.xlsx`
    XLSX.writeFile(wb, fileName)
  }

  const { marketTotals, marketGrandTotals, grandTotal } = calculateGrandTotal()

  return (
    <div className="daily-sales-stats-page">
      {/* 페이지 헤더 */}
      <div className="daily-stats-page-header">
        <h1 className="page-title">💰 매출통계</h1>
      </div>

      {/* 필터 영역 */}
      <div className="daily-stats-filters">
        <div className="daily-filter-group">
          <div className="daily-date-filters">
            <button 
              className={`daily-date-filter-btn ${dateFilter === 'today' && !useCustomDate ? 'active' : ''}`}
              onClick={() => { setDateFilter('today'); setUseCustomDate(false); }}
            >
              오늘
            </button>
            <button 
              className={`daily-date-filter-btn ${dateFilter === 'yesterday' && !useCustomDate ? 'active' : ''}`}
              onClick={() => { setDateFilter('yesterday'); setUseCustomDate(false); }}
            >
              어제
            </button>
            <button 
              className={`daily-date-filter-btn ${dateFilter === 'thisWeek' && !useCustomDate ? 'active' : ''}`}
              onClick={() => { setDateFilter('thisWeek'); setUseCustomDate(false); }}
            >
              이번주
            </button>
            <button 
              className={`daily-date-filter-btn ${dateFilter === 'lastWeek' && !useCustomDate ? 'active' : ''}`}
              onClick={() => { setDateFilter('lastWeek'); setUseCustomDate(false); }}
            >
              지난주
            </button>
            <button 
              className={`daily-date-filter-btn ${dateFilter === 'thisMonth' && !useCustomDate ? 'active' : ''}`}
              onClick={() => { setDateFilter('thisMonth'); setUseCustomDate(false); }}
            >
              이번달
            </button>
            <button 
              className={`daily-date-filter-btn ${dateFilter === 'lastMonth' && !useCustomDate ? 'active' : ''}`}
              onClick={() => { setDateFilter('lastMonth'); setUseCustomDate(false); }}
            >
              지난달
            </button>
            <button 
              className={`daily-date-filter-btn ${useCustomDate ? 'active' : ''}`}
              onClick={openDateModal}
            >
              {useCustomDate && startDate && endDate 
                ? `${startDate} ~ ${endDate}` 
                : '기간 선택'}
            </button>
          </div>
        </div>

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
        ) : stats.length === 0 ? (
          <div className="daily-no-data-message">조회된 데이터가 없습니다.</div>
        ) : (
          <table className="daily-stats-table">
            <thead>
              <tr>
                <th rowSpan={2} className="daily-header-date">일자</th>
                <th rowSpan={2} className="daily-header-market">마켓</th>
                <th colSpan={3} className="daily-header-store">스토어 별</th>
                <th colSpan={3} className="daily-header-market-total">마켓 별</th>
                <th colSpan={3} className="daily-header-day-total">일 합계</th>
              </tr>
              <tr>
                <th className="daily-header-store">주문수</th>
                <th className="daily-header-store">매출</th>
                <th className="daily-header-store">예상수익</th>
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
                      return marketData.stores.map((store, storeIndex) => {
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
                            <td className="daily-number-cell">{formatNumber(store.order_cnt)}</td>
                            <td className="daily-number-cell">{formatNumber(store.pay_anmt)}</td>
                            <td className="daily-number-cell">{formatNumber(store.pre_amt)}</td>
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
                    {storeEntries.map(([_storeName, storeTotal], storeIndex) => {
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
                          <td className="daily-number-cell">{formatNumber(storeTotal.order_cnt)}</td>
                          <td className="daily-number-cell">{formatNumber(storeTotal.pay_anmt)}</td>
                          <td className="daily-number-cell">{formatNumber(storeTotal.pre_amt)}</td>
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
                  dateFormatCalendar="yyyy년 M월"
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
                  dateFormatCalendar="yyyy년 M월"
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
