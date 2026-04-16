// 주문관리 페이지 컴포넌트 - 주문 목록 및 관리 기능
import { useState, useEffect } from 'react'
import { useUser } from '../contexts/UserContext'
import { useFilter } from '../contexts/FilterContext'
import { useAlert } from '../contexts/AlertContext'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import './OrderPage.css'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'
const API_URL = `${API_BASE}/api/orders`

/** 상품 썸네일 CDN: https://c1b.co.kr/CDN/{base_folder}/{item_id}/{main_img_url} */
const PRODUCT_CDN_BASE = 'https://c1b.co.kr/CDN'

interface Order {
  seq: number
  user_id: string
  biz_idx: number
  market_type: string
  order_id: string
  product_id: string
  product_name: string
  order_status: string
  opt_info: string
  seller_cd: string
  org_seller_cd: string
  pay_amt: number
  ordrr_name: string
  orderer_Id: string
  ordrr_tel: string
  recvr_name: string
  recvr_tel: string
  recvr_addr: string
  invo_no: string
  PCCC: string
  pay_date: string
  dispatch_date: string
  dlvy_done_date: string
  purch_decided_date: string
  cancel_date: string
  return_date: string
  pccc_req_date: string
  store_name: string
  store_id: string
  C_SEQ: number
  t_img_url: string
  main_img_url: string | null
  base_folder: string | null
  item_id: string | null
  t_url: string
  display_id_ss: string | null
  display_id_cp: string | null
  taobao_order_no: string | null
  taobao_pay_cn: number | null
  taobao_pay_kr: number | null
  delv_order_no: string | null
  delv_price: number | null
}

function OrderPage() {
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
    statusFilter,
    setStatusFilter
  } = useFilter()
  
  // 스토어 목록
  const [stores, setStores] = useState<Array<{user_id: string, biz_idx: number, store_name: string}>>([])
  /** 스토어 API 조회 완료 여부 (미완료 시 주문 로드 대기 — initialLoading 해제용) */
  const [storesFetched, setStoresFetched] = useState(false)
  // 이미지 확대 모달
  const [showImageModal, setShowImageModal] = useState(false)
  const [selectedImage, setSelectedImage] = useState<string>('')
  // 사용자 정의 날짜 범위
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [useCustomDate, setUseCustomDate] = useState(false)
  // 날짜 선택 모달
  const [showDateModal, setShowDateModal] = useState(false)
  // 모달 내 임시 날짜 (적용 전까지 실제 상태에 반영하지 않음)
  const [tempStartDate, setTempStartDate] = useState<Date | null>(null)
  const [tempEndDate, setTempEndDate] = useState<Date | null>(null)
  // 재요청 모달
  const [showRerequestModal, setShowRerequestModal] = useState(false)
  const [rerequestReason, setRerequestReason] = useState('')
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  // 매입 모달
  const [showPurchaseModal, setShowPurchaseModal] = useState(false)
  const [purchaseInfo, setPurchaseInfo] = useState({
    taobao_order_no: '',
    taobao_pay_cn: '',
    delv_order_no: '',
    delv_price: ''
  })
  const [exchangeRate, setExchangeRate] = useState<number>(0)
  const [savingPurchase, setSavingPurchase] = useState(false)
  
  // 주문 목록
  const [orders, setOrders] = useState<Order[]>([])
  // 로딩 상태
  const [loading, setLoading] = useState(false)
  // 초기 로딩 상태 (첫 로드만 전체 화면 로딩 표시)
  const [initialLoading, setInitialLoading] = useState(true)
  // 페이징 상태
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [totalCount, setTotalCount] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  
  // 주문 통계
  const [stats, setStats] = useState({
    new_orders: 0,
    preparing: 0,
    delivering: 0,
    delivered: 0,
    canceled: 0,
    returned: 0
  })

  // 스토어 목록 로드
  useEffect(() => {
    if (userInfo?.userId) {
      setStoresFetched(false)
      loadStores()
    }
  }, [userInfo?.userId])

  // 컴포넌트 마운트 시 주문 목록 및 통계 로드
  useEffect(() => {
    if (!userInfo?.userId) return
    if (!storesFetched) return

    if (selectedStores.length > 0) {
      loadOrders()
      loadStats()
      return
    }

    // 스토어 없음 또는 선택된 스토어 없음 → 주문 조회 없음, 초기 로딩 종료
    setOrders([])
    setStats({
      new_orders: 0,
      preparing: 0,
      delivering: 0,
      delivered: 0,
      canceled: 0,
      returned: 0
    })
    setTotalCount(0)
    setTotalPages(0)
    setInitialLoading(false)
  }, [currentPage, pageSize, dateFilter, smartStore, coupang, selectedStores, statusFilter, useCustomDate, startDate, endDate, userInfo?.userId, storesFetched])

  // 날짜 필터 변경 시 첫 페이지로 이동
  const handleDateFilterChange = (filter: string) => {
    setDateFilter(filter)
    setUseCustomDate(false)
    setCurrentPage(1)
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
    
    // 모달 열 때 현재 선택된 날짜가 있으면 사용, 없으면 오늘 날짜로 설정
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
    // 임시 날짜 초기화 (적용하지 않고 닫은 경우)
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
    // 임시 날짜를 실제 상태로 적용 (YYYY-MM-DD 문자열로 변환)
    setStartDate(formatDateToString(tempStartDate))
    setEndDate(formatDateToString(tempEndDate))
    setUseCustomDate(true)
    setShowDateModal(false)
    setCurrentPage(1)
  }

  // 마켓 필터 변경 시 첫 페이지로 이동
  const handleMarketChange = (market: 'smartStore' | 'coupang', checked: boolean) => {
    if (market === 'smartStore') {
      setSmartStore(checked)
    } else {
      setCoupang(checked)
    }
    setCurrentPage(1)
  }

  // 스토어 목록 로드
  const loadStores = async () => {
    try {
      const url = `${API_URL}/stores/${userInfo.userId}`
      
      console.log('스토어 목록 요청 URL:', url)
      
      const response = await fetch(url)
      
      console.log('스토어 응답 상태:', response.status)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const result = await response.json()
      
      console.log('스토어 목록 응답:', result)
      
      if (result.success) {
        console.log('받은 스토어 개수:', result.data?.length)
        setStores(result.data || [])
        // FilterContext의 selectedStores가 비어있을 때만 초기화
        if (selectedStores.length === 0) {
          const bizIdxList = (result.data || []).map((s: any) => s.biz_idx)
          console.log('선택된 스토어 biz_idx:', bizIdxList)
          setSelectedStores(bizIdxList)
        }
      } else {
        console.error('스토어 API 응답 실패:', result.message)
        setStores([])
      }
    } catch (error) {
      console.error('스토어 목록 로드 오류:', error)
      setStores([])
      setSelectedStores([])
    } finally {
      setStoresFetched(true)
    }
  }

  // 스토어 선택 변경
  const handleStoreChange = (bizIdx: number, checked: boolean) => {
    if (checked) {
      setSelectedStores([...selectedStores, bizIdx])
    } else {
      setSelectedStores(selectedStores.filter(id => id !== bizIdx))
    }
    setCurrentPage(1)
  }

  // 주문 상태 필터 변경
  const handleStatusFilter = (status: string) => {
    console.log('상태 필터 클릭:', status, '현재 필터:', statusFilter)
    // 이미 선택된 상태를 다시 클릭하면 필터 해제
    if (statusFilter === status) {
      setStatusFilter(null)
      console.log('필터 해제 - 전체 표시')
    } else {
      setStatusFilter(status)
      console.log('필터 적용:', status)
    }
    setCurrentPage(1)
  }

  // 주문 통계 로드
  const loadStats = async () => {
    try {
      const storesParam = selectedStores.join(',')
      
      // 사용자 정의 날짜 사용 여부에 따라 URL 구성
      let dateParams = `dateFilter=${dateFilter}`
      if (useCustomDate && startDate && endDate) {
        dateParams = `startDate=${startDate}&endDate=${endDate}`
      }
      
      const url = `${API_URL}/stats/${userInfo.userId}?${dateParams}&smartStore=${smartStore}&coupang=${coupang}&stores=${storesParam}`
      
      console.log('통계 요청 URL:', url)
      
      const response = await fetch(url)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const result = await response.json()
      
      console.log('통계 응답:', result)
      
      if (result.success) {
        setStats({
          new_orders: result.data?.new_orders || 0,
          preparing: result.data?.preparing || 0,
          delivering: result.data?.delivering || 0,
          delivered: result.data?.delivered || 0,
          canceled: result.data?.canceled || 0,
          returned: result.data?.returned || 0
        })
      }
    } catch (error) {
      console.error('주문 통계 로드 오류:', error)
    }
  }

  // 주문 목록 로드
  const loadOrders = async () => {
    try {
      setLoading(true)
      const storesParam = selectedStores.join(',')
      const statusParam = statusFilter ? `&status=${statusFilter}` : ''
      
      // 사용자 정의 날짜 사용 여부에 따라 URL 구성
      let dateParams = `dateFilter=${dateFilter}`
      if (useCustomDate && startDate && endDate) {
        dateParams = `startDate=${startDate}&endDate=${endDate}`
      }
      
      const url = `${API_URL}/orders/${userInfo.userId}?page=${currentPage}&limit=${pageSize}&${dateParams}&smartStore=${smartStore}&coupang=${coupang}&stores=${storesParam}${statusParam}`
      
      console.log('주문 목록 요청 URL:', url)
      
      const response = await fetch(url)
      
      console.log('응답 상태:', response.status)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const result = await response.json()
      
      console.log('주문 목록 응답:', result)
      
      if (result.success) {
        setOrders(result.data || [])
        setTotalCount(result.pagination?.totalCount || 0)
        setTotalPages(result.pagination?.totalPages || 0)
      } else {
        console.error('API 오류:', result.message)
        setOrders([])
      }
    } catch (error) {
      console.error('주문 목록 로드 오류:', error)
      setOrders([])
    } finally {
      setLoading(false)
      setInitialLoading(false)
    }
  }

  // 페이지 변경
  const handlePageChange = (page: number) => {
    setCurrentPage(page)
  }

  // 페이지 크기 변경
  const handlePageSizeChange = (size: number) => {
    setPageSize(size)
    setCurrentPage(1)
  }

  // 페이지 번호 생성
  const getPageNumbers = () => {
    const pages = []
    const maxVisible = 5
    let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2))
    let endPage = Math.min(totalPages, startPage + maxVisible - 1)
    
    if (endPage - startPage < maxVisible - 1) {
      startPage = Math.max(1, endPage - maxVisible + 1)
    }
    
    for (let i = startPage; i <= endPage; i++) {
      pages.push(i)
    }
    
    return pages
  }

  // 주문 상태 한글 변환
  const getStatusText = (status: string) => {
    const statusMap: { [key: string]: string } = {
      'ACCEPT': '신규주문',
      'PAYED': '신규주문',
      'DEPARTURE': '상품준비중',
      'INSTRUCT': '상품준비중',
      'DELIVERING': '배송중',
      'PURCHASE_DECIDED': '배송완료',
      'FINAL_DELIVERY': '배송완료',
      'CANCELED': '취소',
      'RETURNED': '반품'
    }
    return statusMap[status] || status
  }

  // 마켓 타입 한글 변환
  const getMarketText = (marketType: string) => {
    return marketType === 'SS' ? '스마트스토어' : marketType === 'CP' ? '쿠팡' : marketType
  }

  // 날짜 포맷팅 (24시간 형식, 한국 시간 기준)
  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-'
    try {
      // 백엔드에서 'YYYY-MM-DD HH:mm:ss' 형식으로 받아서 초 제거
      if (dateStr.length === 19) {
        return dateStr.substring(0, 16)
      }
      
      const date = new Date(dateStr)
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      const hours = String(date.getHours()).padStart(2, '0')
      const minutes = String(date.getMinutes()).padStart(2, '0')
      
      return `${year}-${month}-${day} ${hours}:${minutes}`
    } catch {
      return dateStr
    }
  }

  // 통관번호 요청 버튼 클릭
  const handleCustomsRequestClick = (order: Order) => {
    if (order.pccc_req_date) {
      // 재요청인 경우 모달 표시
      setSelectedOrder(order)
      setRerequestReason('')
      setShowRerequestModal(true)
    } else {
      // 최초 요청인 경우 바로 실행
      handleCustomsRequest(order, '통관번호요청')
    }
  }

  // 통관번호 요청 실행
  const handleCustomsRequest = async (order: Order, title: string) => {
    try {
      const response = await fetch(`${API_URL}/customs-request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          user_id: userInfo.userId,
          order_id: order.order_id,
          tel_no: order.ordrr_tel,
          title: title
        })
      })
      
      const result = await response.json()
      
      if (result.success) {
        await showAlert('통관번호 요청이 완료되었습니다.')
        loadOrders() // 주문 목록 새로고침
      } else {
        await showAlert(result.message || '통관번호 요청 중 오류가 발생했습니다.')
      }
    } catch (error) {
      console.error('통관번호 요청 오류:', error)
      await showAlert('통관번호 요청 중 오류가 발생했습니다.')
    }
  }

  // 재요청 모달에서 요청 버튼 클릭
  const handleRerequestSubmit = async () => {
    if (!rerequestReason) {
      await showAlert('재요청 사유를 선택해주세요.')
      return
    }

    if (selectedOrder) {
      await handleCustomsRequest(selectedOrder, rerequestReason)
      setShowRerequestModal(false)
      setSelectedOrder(null)
      setRerequestReason('')
    }
  }

  // 재요청 모달 닫기
  const closeRerequestModal = () => {
    setShowRerequestModal(false)
    setSelectedOrder(null)
    setRerequestReason('')
  }

  // 스마트스토어 링크 생성
  const getSmartStoreUrl = (storeId: string | null, displayId: string | null) => {
    if (!storeId || !displayId) return null
    return `https://smartstore.naver.com/${storeId}/products/${displayId}`
  }

  // 쿠팡 링크 생성
  const getCoupangUrl = (displayId: string | null) => {
    if (!displayId) return null
    return `http://www.coupang.com/vp/products/${displayId}`
  }

  // 상품 링크 클릭 핸들러
  const handleProductLinkClick = (e: React.MouseEvent<HTMLAnchorElement>, order: Order) => {
    const hasDisplayId = order.market_type === 'SS' 
      ? order.display_id_ss && order.store_id
      : order.display_id_cp

    if (!hasDisplayId) {
      e.preventDefault()
      showAlert('상품이 존재하지 않습니다')
    }
  }

  // 타오바오 링크 열기 (팝업)
  const openTaobaoLink = async (url: string | null) => {
    if (!url) {
      await showAlert('타오바오 링크가 없습니다.')
      return
    }
    
    window.open(
      url,
      'taobao_popup',
      'width=1000,height=800,scrollbars=yes,resizable=yes'
    )
  }

  // 매입 상태 확인
  const getPurchaseStatus = (order: Order): '미입력' | '진행중' | '완료' => {
    const hasAll = order.taobao_order_no && order.taobao_pay_cn && order.delv_order_no && order.delv_price
    const hasNone = !order.taobao_order_no && !order.taobao_pay_cn && !order.delv_order_no && !order.delv_price
    
    if (hasAll) return '완료'
    if (hasNone) return '미입력'
    return '진행중'
  }

  // 환율 정보 가져오기
  const fetchExchangeRate = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/exchange-rate/cny`)
      const result = await response.json()
      
      if (result.success && result.rate) {
        setExchangeRate(result.rate)
      } else {
        await showAlert('환율 정보를 가져올 수 없습니다.')
        setExchangeRate(0)
      }
    } catch (error) {
      console.error('환율 조회 오류:', error)
      await showAlert('환율 정보를 가져오는 중 오류가 발생했습니다.')
      setExchangeRate(0)
    }
  }

  // 매입 모달 열기
  const openPurchaseModal = async (order: Order) => {
    setSelectedOrder(order)
    setPurchaseInfo({
      taobao_order_no: order.taobao_order_no || '',
      taobao_pay_cn: order.taobao_pay_cn ? String(order.taobao_pay_cn) : '',
      delv_order_no: order.delv_order_no || '',
      delv_price: order.delv_price ? String(order.delv_price) : ''
    })
    await fetchExchangeRate()
    setShowPurchaseModal(true)
  }

  // 매입 모달 닫기
  const closePurchaseModal = () => {
    setShowPurchaseModal(false)
    setSelectedOrder(null)
    setPurchaseInfo({
      taobao_order_no: '',
      taobao_pay_cn: '',
      delv_order_no: '',
      delv_price: ''
    })
    setExchangeRate(0)
  }

  // 매입 정보 저장
  const savePurchaseInfo = async () => {
    if (!selectedOrder) return

    if (!purchaseInfo.taobao_order_no || !purchaseInfo.taobao_pay_cn) {
      await showAlert('타오바오 주문번호와 결제금액은 필수입니다.')
      return
    }

    try {
      setSavingPurchase(true)

      const taobaoPayCn = parseFloat(purchaseInfo.taobao_pay_cn)
      const taobaoPayKr = taobaoPayCn * exchangeRate

      const response = await fetch(`${API_URL}/${selectedOrder.seq}/purchase`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          taobao_order_no: purchaseInfo.taobao_order_no,
          taobao_pay_cn: taobaoPayCn,
          taobao_pay_kr: taobaoPayKr,
          delv_order_no: purchaseInfo.delv_order_no || null,
          delv_price: purchaseInfo.delv_price ? parseFloat(purchaseInfo.delv_price) : null
        })
      })

      const result = await response.json()

      if (result.success) {
        await showAlert('매입 정보가 저장되었습니다.')
        closePurchaseModal()
        loadOrders()
      } else {
        await showAlert(result.message || '매입 정보 저장에 실패했습니다.')
      }
    } catch (error) {
      console.error('매입 정보 저장 오류:', error)
      await showAlert('매입 정보 저장 중 오류가 발생했습니다.')
    } finally {
      setSavingPurchase(false)
    }
  }

  // 이미지 URL을 프록시를 통해 안전하게 처리
  const getSafeImageUrl = (url: string | null): string => {
    if (!url) return ''
    // 백엔드 프록시를 통해 이미지 로드 (CORS 및 SSL 문제 해결)
    return `${API_BASE}/api/image/proxy?url=${encodeURIComponent(url)}`
  }

  const trimPathSegment = (s: string) => String(s).replace(/^\/+/u, '').replace(/\/+$/u, '')

  /** CDN 경로가 있으면 우선 사용, 없으면 기존 t_img_url(프록시) — 상품관리와 동일 */
  const getOrderImageDisplayUrl = (order: Order): string | null => {
    const { base_folder, item_id, main_img_url, t_img_url } = order
    if (base_folder && item_id && main_img_url) {
      return `${PRODUCT_CDN_BASE}/${trimPathSegment(base_folder)}/${trimPathSegment(item_id)}/${trimPathSegment(main_img_url)}`
    }
    return t_img_url ? getSafeImageUrl(t_img_url) : null
  }

  // 이미지 확대 모달 열기 (이미 최종 표시 URL)
  const openImageModal = (displayUrl: string) => {
    setSelectedImage(displayUrl)
    setShowImageModal(true)
  }

  // 이미지 확대 모달 닫기
  const closeImageModal = () => {
    setShowImageModal(false)
    setSelectedImage('')
  }

  // 순번 계산
  const getRowNumber = (index: number) => {
    return totalCount - ((currentPage - 1) * pageSize) - index
  }

  if (!userInfo?.userId) {
    return (
      <div className="order-page">
        <div className="order-page-header">
          <h1 className="page-title">🛒 주문관리</h1>
        </div>
        <div style={{ textAlign: 'center', padding: '40px' }}>
          로그인 정보를 불러오는 중입니다...
        </div>
      </div>
    )
  }

  if (initialLoading) {
    return (
      <div className="order-page">
        <div className="order-page-header">
          <h1 className="page-title">🛒 주문관리</h1>
        </div>
        <div style={{ textAlign: 'center', padding: '40px' }}>
          데이터를 불러오는 중입니다...
        </div>
      </div>
    )
  }

  return (
    <div className="order-page">
      {/* 페이지 헤더 */}
      <div className="order-page-header">
        <h1 className="page-title">🛒 주문관리</h1>
      </div>

      {/* 필터 영역 - 한 줄로 통합 */}
      <div className="dashboard-header compact-filters">
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
        <div className="filter-section">
          <span className="filter-label">스토어:</span>
          <div className="market-checkboxes">
            {stores.length > 0 ? (
              stores.map((store) => (
                <label key={store.biz_idx} className="checkbox-label">
                  <input 
                    type="checkbox" 
                    checked={selectedStores.includes(store.biz_idx)}
                    onChange={(e) => handleStoreChange(store.biz_idx, e.target.checked)}
                  />
                  <span className="checkbox-text">{store.store_name}</span>
                </label>
              ))
            ) : (
              <span className="checkbox-text" style={{ color: '#999' }}>
                등록된 스토어가 없습니다. 마켓연동에서 스토어를 등록해주세요.
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 주문 상태 카드 */}
      <div className="order-stats-cards">
        <div 
          className={`stat-card new-orders ${statusFilter === '신규주문' ? 'active' : ''}`}
          onClick={() => handleStatusFilter('신규주문')}
        >
          <div className="stat-number">{stats.new_orders || 0}</div>
          <div className="stat-label">신규주문</div>
        </div>
        <div 
          className={`stat-card preparing ${statusFilter === '상품준비중' ? 'active' : ''}`}
          onClick={() => handleStatusFilter('상품준비중')}
        >
          <div className="stat-number">{stats.preparing || 0}</div>
          <div className="stat-label">상품준비중</div>
        </div>
        <div 
          className={`stat-card delivering ${statusFilter === '배송중' ? 'active' : ''}`}
          onClick={() => handleStatusFilter('배송중')}
        >
          <div className="stat-number">{stats.delivering || 0}</div>
          <div className="stat-label">배송중</div>
        </div>
        <div 
          className={`stat-card delivered ${statusFilter === '배송완료' ? 'active' : ''}`}
          onClick={() => handleStatusFilter('배송완료')}
        >
          <div className="stat-number">{stats.delivered || 0}</div>
          <div className="stat-label">배송완료</div>
        </div>
        <div className="cancel-return-group">
          <div 
            className={`stat-card canceled ${statusFilter === '취소' ? 'active' : ''}`}
            onClick={() => handleStatusFilter('취소')}
          >
            <div className="stat-number">{stats.canceled || 0}</div>
            <div className="stat-label">취소</div>
          </div>
          <div 
            className={`stat-card returned ${statusFilter === '반품' ? 'active' : ''}`}
            onClick={() => handleStatusFilter('반품')}
          >
            <div className="stat-number">{stats.returned || 0}</div>
            <div className="stat-label">반품</div>
          </div>
        </div>
      </div>

      {/* 주문 개수 및 페이지 크기 선택 */}
      <div className="order-header">
        <div className="order-count">
          전체 <strong>{totalCount}</strong>개 주문
        </div>
        <div className="page-size-selector">
          <label>페이지당 표시:</label>
          <select value={pageSize} onChange={(e) => handlePageSizeChange(Number(e.target.value))}>
            <option value={20}>20개</option>
            <option value={30}>30개</option>
            <option value={50}>50개</option>
          </select>
        </div>
      </div>

      {/* 주문 테이블 */}
      {orders.length === 0 ? (
        <div className="no-orders-message">
          주문정보가 없습니다
        </div>
      ) : (
        <div className="order-table-container" style={{ position: 'relative' }}>
          {loading && (
            <div className="table-loading-overlay">
              <div className="loading-spinner"></div>
            </div>
          )}
          <table className="order-table">
            <thead>
              <tr>
                <th>No</th>
                <th>주문번호</th>
                <th>상태</th>
                <th>마켓</th>
                <th>스토어</th>
                <th>이미지</th>
                <th>상품명</th>
                <th>옵션명</th>
                <th>결제일</th>
                <th>결제금액</th>
                <th className="orderer-header">주문자</th>
                <th className="phone-header">연락처</th>
                <th>주소</th>
                <th>통관번호</th>
                <th>통관번호요청</th>
                <th>타오바오</th>
                <th>매입</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order, index) => {
                const displayUrl = getOrderImageDisplayUrl(order)
                return (
                <tr key={order.seq}>
                  <td className="no-cell">{getRowNumber(index)}</td>
                  <td>{order.order_id}</td>
                  <td>
                    <span className={`status-badge ${order.order_status.toLowerCase()}`}>
                      {getStatusText(order.order_status)}
                    </span>
                  </td>
                  <td>{getMarketText(order.market_type)}</td>
                  <td>{order.store_name}</td>
                  <td>
                    {displayUrl ? (
                      <img 
                        src={displayUrl} 
                        alt={order.product_name} 
                        className="table-image clickable" 
                        onClick={() => openImageModal(displayUrl)}
                      />
                    ) : (
                      <div className="table-image-placeholder">📦</div>
                    )}
                  </td>
                  <td className="product-name-cell">
                    {order.market_type === 'SS' ? (
                      <a
                        href={order.display_id_ss && order.store_id ? getSmartStoreUrl(order.store_id, order.display_id_ss) || '#' : '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="product-link smartstore-link"
                        onClick={(e) => handleProductLinkClick(e, order)}
                      >
                        {order.product_name}
                      </a>
                    ) : order.market_type === 'CP' ? (
                      <a
                        href={order.display_id_cp ? getCoupangUrl(order.display_id_cp) || '#' : '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="product-link coupang-link"
                        onClick={(e) => handleProductLinkClick(e, order)}
                      >
                        {order.product_name}
                      </a>
                    ) : (
                      order.product_name
                    )}
                  </td>
                  <td>{order.opt_info || '-'}</td>
                  <td className="date-cell">{formatDate(order.pay_date)}</td>
                  <td className="amount-cell">{order.pay_amt ? Number(order.pay_amt).toLocaleString() : '0'}원</td>
                  <td className="orderer-cell">{order.ordrr_name}</td>
                  <td className="phone-cell">{order.ordrr_tel}</td>
                  <td className="address-cell">{order.recvr_addr}</td>
                  <td>
                    {order.PCCC || '-'}
                  </td>
                  <td>
                    {order.market_type === 'SS' && (
                      <button 
                        className={order.pccc_req_date ? 'customs-rerequest-btn' : 'customs-request-btn'}
                        onClick={() => handleCustomsRequestClick(order)}
                      >
                        {order.pccc_req_date ? '재요청' : '통관번호요청'}
                      </button>
                    )}
                  </td>
                  <td>
                    <button 
                      className="taobao-link-btn"
                      onClick={() => openTaobaoLink(order.t_url)}
                      disabled={!order.t_url}
                    >
                      타오바오
                    </button>
                  </td>
                  <td>
                    <button 
                      className={`purchase-btn ${getPurchaseStatus(order) === '완료' ? 'purchase-completed' : getPurchaseStatus(order) === '진행중' ? 'purchase-in-progress' : 'purchase-not-entered'}`}
                      onClick={() => openPurchaseModal(order)}
                    >
                      {getPurchaseStatus(order)}
                    </button>
                  </td>
                </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* 페이징 */}
      {totalPages > 1 && (
        <div className="pagination">
          <button 
            className="page-btn"
            onClick={() => handlePageChange(1)}
            disabled={currentPage === 1}
          >
            처음
          </button>
          <button 
            className="page-btn"
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
          >
            이전
          </button>
          
          {getPageNumbers().map(page => (
            <button
              key={page}
              className={`page-btn ${currentPage === page ? 'active' : ''}`}
              onClick={() => handlePageChange(page)}
            >
              {page}
            </button>
          ))}
          
          <button 
            className="page-btn"
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
          >
            다음
          </button>
          <button 
            className="page-btn"
            onClick={() => handlePageChange(totalPages)}
            disabled={currentPage === totalPages}
          >
            마지막
          </button>
        </div>
      )}

      {/* 이미지 확대 모달 */}
      {showImageModal && (
        <div className="image-modal-overlay">
          <div className="image-modal-content">
            <button className="image-modal-close" onClick={closeImageModal}>
              ✕
            </button>
            <img src={selectedImage} alt="상품 이미지" className="enlarged-image" />
          </div>
        </div>
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

      {/* 재요청 모달 */}
      {showRerequestModal && (
        <div className="rerequest-modal-overlay">
          <div className="rerequest-modal-content">
            <div className="rerequest-modal-header">
              <h3>통관번호 재요청</h3>
              <button className="rerequest-modal-close" onClick={closeRerequestModal}>
                ✕
              </button>
            </div>
            <div className="rerequest-modal-body">
              <div className="rerequest-form-group">
                <label className="rerequest-label">요청일자</label>
                <div className="rerequest-date-value">
                  {selectedOrder?.pccc_req_date ? formatDate(selectedOrder.pccc_req_date) : '-'}
                </div>
              </div>
              <div className="rerequest-form-group">
                <label className="rerequest-label">재요청 사유</label>
                <select 
                  className="rerequest-select"
                  value={rerequestReason}
                  onChange={(e) => setRerequestReason(e.target.value)}
                >
                  <option value="">선택하세요</option>
                  <option value="아직 못받음">아직 못받음</option>
                  <option value="잘못된 통관번호 받음">잘못된 통관번호 받음</option>
                </select>
              </div>
            </div>
            <div className="rerequest-modal-footer">
              <button className="rerequest-modal-cancel" onClick={closeRerequestModal}>
                취소
              </button>
              <button className="rerequest-modal-submit" onClick={handleRerequestSubmit}>
                요청
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 매입 모달 */}
      {showPurchaseModal && (
        <div className="purchase-modal-overlay" onClick={closePurchaseModal}>
          <div className="purchase-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="purchase-modal-header">
              <h3>매입정보</h3>
              <button className="purchase-modal-close" onClick={closePurchaseModal}>
                ✕
              </button>
            </div>
            <div className="purchase-modal-body">
              <div className="purchase-form-group">
                <label className="purchase-label">타오바오 주문번호</label>
                <input
                  type="text"
                  className="purchase-input"
                  value={purchaseInfo.taobao_order_no}
                  onChange={(e) => setPurchaseInfo({...purchaseInfo, taobao_order_no: e.target.value})}
                  placeholder="타오바오 주문번호를 입력하세요"
                />
              </div>
              <div className="purchase-form-group">
                <label className="purchase-label">타오바오 결제금액(위안화)</label>
                <input
                  type="number"
                  className="purchase-input"
                  value={purchaseInfo.taobao_pay_cn}
                  onChange={(e) => setPurchaseInfo({...purchaseInfo, taobao_pay_cn: e.target.value})}
                  placeholder="타오바오 결제금액(위안화)을 입력하세요"
                />
              </div>
              <div className="purchase-form-group">
                <label className="purchase-label">현재환율(실시간)</label>
                <input
                  type="number"
                  className="purchase-input"
                  value={exchangeRate}
                  onChange={(e) => setExchangeRate(parseFloat(e.target.value) || 0)}
                  placeholder="219"
                />
              </div>
              <div className="purchase-form-group">
                <label className="purchase-label">배대지 주문번호</label>
                <input
                  type="text"
                  className="purchase-input"
                  value={purchaseInfo.delv_order_no}
                  onChange={(e) => setPurchaseInfo({...purchaseInfo, delv_order_no: e.target.value})}
                  placeholder="배대지 주문번호를 입력하세요"
                />
              </div>
              <div className="purchase-form-group">
                <label className="purchase-label">배대지 비용(원화)</label>
                <input
                  type="number"
                  className="purchase-input"
                  value={purchaseInfo.delv_price}
                  onChange={(e) => setPurchaseInfo({...purchaseInfo, delv_price: e.target.value})}
                  placeholder="배대지 비용(원화)을 입력하세요"
                />
              </div>
            </div>
            <div className="purchase-modal-footer">
              <button className="purchase-modal-cancel" onClick={closePurchaseModal}>
                취소
              </button>
              <button 
                className="purchase-modal-submit" 
                onClick={savePurchaseInfo}
                disabled={savingPurchase}
              >
                {savingPurchase ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default OrderPage
