// 대시보드 메인 컴포넌트 - 주문현황, 차트, 공지사항 등을 표시
import { useState, useEffect } from 'react'
import { useUser } from '../contexts/UserContext'
import { useFilter } from '../contexts/FilterContext'
import { useAlert } from '../contexts/AlertContext'
import DatePicker from 'react-datepicker'
import { ko } from 'date-fns/locale'
import 'react-datepicker/dist/react-datepicker.css'
import './Dashboard.css'
import OrderStatusCards from './OrderStatusCards'
import ChartSection from './ChartSection'
import OrderSalesSummary from './OrderSalesSummary'
import NoticeList from './NoticeList'
import ProductStats from './ProductStats'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'
const API_URL = `${API_BASE}/api/orders`

interface DashboardProps {
  onNavigate?: (menu: string) => void
}

function Dashboard({ onNavigate }: DashboardProps) {
  const { userInfo } = useUser()
  const { showAlert } = useAlert()
  const { 
    dateFilter, 
    setDateFilter,
    smartStore, 
    setSmartStore,
    coupang, 
    setCoupang,
    selectedStores, 
    setSelectedStores,
    useCustomDate,
    setUseCustomDate,
    startDate,
    setStartDate,
    endDate,
    setEndDate
  } = useFilter()
  
  // 스토어 목록
  const [stores, setStores] = useState<Array<{user_id: string, biz_idx: number, store_name: string, market_type: string}>>([])
  // 스토어 드롭다운 상태
  const [showStoreDropdown, setShowStoreDropdown] = useState(false)
  // 구독기준 선택 여부
  const [subscriptionBasis, setSubscriptionBasis] = useState(false)
  // 날짜 선택 모달
  const [showDateModal, setShowDateModal] = useState(false)
  // 모달 내 임시 날짜
  const [tempStartDate, setTempStartDate] = useState<Date | null>(null)
  const [tempEndDate, setTempEndDate] = useState<Date | null>(null)
  // 팝업 공지
  const [popupNotices, setPopupNotices] = useState<Array<any>>([])
  const [showPopupNotice, setShowPopupNotice] = useState(false)
  const [currentPopupIndex, setCurrentPopupIndex] = useState(0)


  // 스토어 목록 및 팝업 공지 로드
  useEffect(() => {
    if (userInfo?.userId) {
      loadStores()
      loadPopupNotices()
    }
  }, [userInfo?.userId])

  // 스토어 드롭다운 외부 클릭 시 닫기
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (!target.closest('.store-dropdown-container')) {
        setShowStoreDropdown(false)
      }
    }

    if (showStoreDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showStoreDropdown])

  // 스토어 목록 로드
  const loadStores = async () => {
    try {
      const url = `${API_URL}/stores/${userInfo.userId}`
      
      const response = await fetch(url)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const result = await response.json()
      
      if (result.success) {
        setStores(result.data)
        // FilterContext의 selectedStores가 비어있을 때만 초기화
        if (selectedStores.length === 0) {
          setSelectedStores(result.data.map((s: any) => `${s.market_type}-${s.biz_idx}`))
        }
      }
    } catch (error) {
      console.error('스토어 목록 로드 오류:', error)
    }
  }

  // 팝업 공지 로드
  const loadPopupNotices = async () => {
    try {
      console.log('🔔 팝업 공지 로드 시작...')
      const url = `${API_BASE}/api/notices/popup`
      console.log('🔔 API URL:', url)
      
      const response = await fetch(url)
      console.log('🔔 API 응답 상태:', response.status)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const result = await response.json()
      console.log('🔔 API 응답 데이터:', result)
      
      if (result.success && result.data.length > 0) {
        console.log('🔔 팝업 공지 개수:', result.data.length)
        
        // 오늘 보지 않기로 설정한 공지 필터링
        const today = new Date().toDateString()
        const hiddenNotices = JSON.parse(localStorage.getItem('hiddenPopupNotices') || '{}')
        console.log('🔔 오늘 날짜:', today)
        console.log('🔔 숨김 공지 목록:', hiddenNotices)
        
        const visibleNotices = result.data.filter((notice: any) => {
          const isHidden = hiddenNotices[notice.seq] === today
          console.log(`🔔 공지 ${notice.seq} (${notice.title}) - 숨김 여부:`, isHidden)
          return !isHidden
        })
        
        console.log('🔔 표시할 공지 개수:', visibleNotices.length)
        
        if (visibleNotices.length > 0) {
          setPopupNotices(visibleNotices)
          setCurrentPopupIndex(0)
          setShowPopupNotice(true)
          console.log('🔔 팝업 공지 표시 설정 완료')
        } else {
          console.log('🔔 표시할 공지가 없습니다 (모두 오늘 숨김 처리됨)')
        }
      } else {
        console.log('🔔 팝업 공지가 없습니다')
      }
    } catch (error) {
      console.error('🔔 팝업 공지 로드 오류:', error)
    }
  }

  // 팝업 공지 닫기
  const closePopupNotice = (dontShowToday: boolean = false) => {
    if (dontShowToday && popupNotices[currentPopupIndex]) {
      const today = new Date().toDateString()
      const hiddenNotices = JSON.parse(localStorage.getItem('hiddenPopupNotices') || '{}')
      hiddenNotices[popupNotices[currentPopupIndex].seq] = today
      localStorage.setItem('hiddenPopupNotices', JSON.stringify(hiddenNotices))
    }
    
    // 다음 팝업이 있으면 표시
    if (currentPopupIndex < popupNotices.length - 1) {
      setCurrentPopupIndex(currentPopupIndex + 1)
    } else {
      setShowPopupNotice(false)
    }
  }

  // 스토어 선택 변경
  const handleStoreChange = (storeId: string, checked: boolean) => {
    if (checked) {
      setSelectedStores([...selectedStores, storeId])
    } else {
      setSelectedStores(selectedStores.filter(id => id !== storeId))
    }
  }

  // 마켓 선택 변경
  const handleMarketChange = (market: 'smartStore' | 'coupang', checked: boolean) => {
    if (market === 'smartStore') {
      setSmartStore(checked)
      // 스마트스토어를 체크하면 스마트스토어의 모든 스토어 선택, 해제하면 모두 해제
      const ssStoreIds = stores.filter(s => s.market_type === 'SS').map(s => `SS-${s.biz_idx}`)
      if (checked) {
        // 기존 선택된 스토어에 스마트스토어 스토어들 추가 (중복 제거)
        const newSelected = [...selectedStores, ...ssStoreIds.filter(id => !selectedStores.includes(id))]
        setSelectedStores(newSelected)
      } else {
        // 스마트스토어 스토어들만 제거
        setSelectedStores(selectedStores.filter(id => !ssStoreIds.includes(id)))
      }
    } else {
      setCoupang(checked)
      // 쿠팡을 체크하면 쿠팡의 모든 스토어 선택, 해제하면 모두 해제
      const cpStoreIds = stores.filter(s => s.market_type === 'CP').map(s => `CP-${s.biz_idx}`)
      if (checked) {
        // 기존 선택된 스토어에 쿠팡 스토어들 추가 (중복 제거)
        const newSelected = [...selectedStores, ...cpStoreIds.filter(id => !selectedStores.includes(id))]
        setSelectedStores(newSelected)
      } else {
        // 쿠팡 스토어들만 제거
        setSelectedStores(selectedStores.filter(id => !cpStoreIds.includes(id)))
      }
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
    setShowDateModal(false)
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
  }

  // 날짜 필터 변경
  const handleDateFilterChange = (filter: string) => {
    setDateFilter(filter)
    setUseCustomDate(false)
    setSubscriptionBasis(false)
  }

  return (
    <div className="dashboard">
      {/* 상단 필터 - 날짜 + 마켓 + 스토어 */}
      <div className="dashboard-header">
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
        </div>

        <div className="filter-divider"></div>

        {/* 마켓 선택 */}
        <div className="filter-section">
          <span className="filter-label">마켓:</span>
          <div className="market-checkboxes">
            <label className="checkbox-label">
              <input 
                type="checkbox" 
                checked={smartStore}
                onChange={(e) => handleMarketChange('smartStore', e.target.checked)}
              />
              <span className="checkbox-text">스마트스토어</span>
            </label>
            <label className="checkbox-label">
              <input 
                type="checkbox" 
                checked={coupang}
                onChange={(e) => handleMarketChange('coupang', e.target.checked)}
              />
              <span className="checkbox-text">쿠팡</span>
            </label>
          </div>
        </div>
        
        <div className="filter-divider"></div>
        
        {/* 스토어 선택 */}
        <div className="filter-section" style={{ paddingTop: '2px', paddingBottom: '2px' }}>
          <span className="filter-label">스토어:</span>
          <div className="store-dropdown-container">
            {stores.length > 0 ? (
              <>
                <button 
                  className="store-dropdown-button"
                  onClick={() => setShowStoreDropdown(!showStoreDropdown)}
                  type="button"
                >
                  <span className="store-dropdown-text">
                    {selectedStores.length > 0 
                      ? `${selectedStores.length}개 선택됨` 
                      : '스토어 선택'}
                  </span>
                  <span className={`store-dropdown-arrow ${showStoreDropdown ? 'open' : ''}`}>
                    ▼
                  </span>
                </button>
                
                {showStoreDropdown && (
                  <div className="store-dropdown-menu">
                    {stores
                      .filter(store => {
                        // 마켓 필터에 따라 스토어 필터링
                        if (store.market_type === 'SS' && !smartStore) return false
                        if (store.market_type === 'CP' && !coupang) return false
                        return true
                      })
                      .sort((a, b) => {
                        // 먼저 market_type으로 정렬 (SS가 먼저)
                        if (a.market_type !== b.market_type) {
                          return a.market_type === 'SS' ? -1 : 1
                        }
                        // 같은 market_type 내에서는 biz_idx로 정렬
                        return a.biz_idx - b.biz_idx
                      })
                      .map((store) => {
                        const storeId = `${store.market_type}-${store.biz_idx}`
                        return (
                          <label 
                            key={storeId} 
                            className="store-dropdown-item"
                          >
                            <input
                              type="checkbox"
                              checked={selectedStores.includes(storeId)}
                              onChange={(e) => {
                                handleStoreChange(storeId, e.target.checked)
                              }}
                            />
                            <span className="store-item-text">
                              {store.store_name}
                              <span className={`store-item-badge ${store.market_type === 'SS' ? 'badge-ss' : 'badge-cp'}`}>
                                {store.market_type === 'SS' ? '스스' : '쿠팡'}
                              </span>
                            </span>
                          </label>
                        )
                      })
                    }
                  </div>
                )}
              </>
            ) : (
              <div className="no-stores-message">
                등록된 스토어가 없습니다.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 상단 섹션: 주문현황(50%) + 주문현황차트(25%) + 주문&매출현황(25%) */}
      <div className="top-section">
        <OrderStatusCards 
          dateFilter={dateFilter}
          smartStore={smartStore}
          coupang={coupang}
          selectedStores={selectedStores}
          stores={stores}
          onNavigate={onNavigate}
          useCustomDate={useCustomDate}
          startDate={startDate}
          endDate={endDate}
        />
        <ChartSection 
          showOnlyDonutCharts={true}
          dateFilter={dateFilter}
          smartStore={smartStore}
          coupang={coupang}
          selectedStores={selectedStores}
          stores={stores}
          useCustomDate={useCustomDate}
          startDate={startDate}
          endDate={endDate}
        />
        <OrderSalesSummary 
          dateFilter={dateFilter}
          smartStore={smartStore}
          coupang={coupang}
          selectedStores={selectedStores}
          stores={stores}
          useCustomDate={useCustomDate}
          startDate={startDate}
          endDate={endDate}
          subscriptionBasis={subscriptionBasis}
          onSubscriptionBasis={handleSubscriptionBasis}
        />
      </div>

      {/* 막대 차트 섹션 */}
      <ChartSection 
        showOnlyBarCharts={true}
        dateFilter={dateFilter}
        smartStore={smartStore}
        coupang={coupang}
        selectedStores={selectedStores}
        stores={stores}
        useCustomDate={useCustomDate}
        startDate={startDate}
        endDate={endDate}
      />

      {/* 하단 섹션: 공지사항 + 등록상품 수 */}
      <div className="bottom-section">
        <NoticeList onViewAll={() => onNavigate?.('notices')} />
        <ProductStats />
      </div>

      {/* 푸터 정보 - user_id 'payuser' 또는 사용자종류 '관리자'에게만 표시 */}
      {(userInfo.userId === 'payuser' || userInfo.userType === '관리자') && (
        <footer className="dashboard-footer">
          <div className="company-info">
            <p className="footer-company-name">
              <strong>(주)에스에이치에스코퍼레이션</strong>
            </p>
            <p><span className="footer-bullet">•</span><span className="footer-label">대표자명</span> 서하성</p>
            <p><span className="footer-bullet">•</span><span className="footer-label">사업장 주소</span> 18469 경기도 화성시 동탄첨단산업1로 27 (영천동)</p>
            <p><span className="footer-bullet">•</span><span className="footer-label">대표 전화</span> 1555-5696</p>
            <p><span className="footer-bullet">•</span><span className="footer-label">사업자 등록번호</span> 519-81-04227</p>
            <p>
              <span className="footer-bullet">•</span><span className="footer-label">통신판매업 신고번호</span> 제 2025-화성동탄-5248 호
              <a
                className="footer-biz-link"
                href="https://www.ftc.go.kr/bizCommPop.do?wrkr_no=5198104227"
                target="_blank"
                rel="noopener noreferrer"
              >
                [사업자정보확인]
              </a>
            </p>
          </div>
        </footer>
      )}

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
                  locale={ko}
                  dateFormatCalendar="yyyy년 MM월"
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
                  locale={ko}
                  dateFormatCalendar="yyyy년 MM월"
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

      {/* 팝업 공지 모달 */}
      {showPopupNotice && popupNotices[currentPopupIndex] && (
        <div className="popup-notice-overlay">
          <div className="popup-notice-content">
            <button className="popup-notice-close" onClick={() => closePopupNotice(false)}>
              ✕
            </button>
            <div className="popup-notice-header">
              <h2>{popupNotices[currentPopupIndex].title}</h2>
            </div>
            <div className="popup-notice-body">
              <div 
                dangerouslySetInnerHTML={{ 
                  __html: popupNotices[currentPopupIndex].contents 
                }} 
              />
            </div>
            <div className="popup-notice-footer">
              <label className="popup-notice-checkbox-label">
                <input 
                  type="checkbox" 
                  id="dontShowToday"
                  className="popup-notice-checkbox"
                />
                <span className="popup-notice-checkbox-text">오늘 더 이상 안보기</span>
              </label>
              <button 
                className="popup-notice-confirm-btn" 
                onClick={() => {
                  const checkbox = document.getElementById('dontShowToday') as HTMLInputElement
                  closePopupNotice(checkbox?.checked || false)
                }}
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Dashboard
