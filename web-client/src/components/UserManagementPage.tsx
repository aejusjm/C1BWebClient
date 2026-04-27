// 사용자관리 페이지 컴포넌트 - 사용자 조회 및 수정
import React, { useState, useEffect } from 'react'
import { useUser } from '../contexts/UserContext'
import { useAlert } from '../contexts/AlertContext'
import './UserManagementPage.css'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'
const API_URL = `${API_BASE}/api/users`
const MARKET_API_URL = `${API_BASE}/api/market`
const SMARTSTORE_API_URL = `${API_BASE}/api/smartstore-api`
const COUPANG_API_URL = `${API_BASE}/api/coupang-api`
const USER_DETAIL_IMAGE_API_URL = `${API_BASE}/api/user-detail-images`

interface StoreInfo {
  biz_idx: number
  storeName: string
  id: string
  storeId: string
  password: string
  appId: string
  appSecret: string
  useYn: string
  isNew?: boolean
}

interface CoupangInfo {
  biz_idx: number
  storeName: string
  accountId: string
  password: string
  vendorCode: string
  accessKey: string
  secretKey: string
  useYn: string
  isNew?: boolean
}

interface ServerInfo {
  server_id: string
  server_name: string
}

interface User {
  user_id: string
  user_pwd: string
  user_name: string
  start_date: string | null
  end_date: string | null
  user_type: string
  margin_rate: number
  user_phone: string
  user_email: string
  input_date: string
  server_id: string
  last_proc_date: string | null
  proc_ord: number
  batch_date: string | null
  last_delete_date: string | null
  use_yn: string
  reupload_target_yn: string
  get_cnt: number
  del_cnt: number
  del_days: number
  sale_keep_days: number
  cs_phone: string
  cs_phone_apply: string
  biz_hours: string
  upload_stop: string
  marketCount?: number
}

interface UserManagementPageProps {
  onNavigate?: (menu: string) => void
}

/** 종료일(0시) − 오늘(0시) 일수. 미설정/불가 시 null */
function getDaysRemainingFromEndDate(endDateStr: string | null): number | null {
  if (!endDateStr) return null
  const end = new Date(endDateStr)
  if (Number.isNaN(end.getTime())) return null
  const today = new Date()
  end.setHours(0, 0, 0, 0)
  today.setHours(0, 0, 0, 0)
  return Math.round((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

/** 테이블 정렬 키 (남은일자는 end_date 기반 계산) */
type SortColumnKey = keyof User | 'days_remaining'

function UserManagementPage({ onNavigate }: UserManagementPageProps) {
  const { setUserInfo } = useUser()
  const { showAlert, showConfirm } = useAlert()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(false)
  
  // 정렬 상태 (기본: 사용자명 오름차순)
  const [sortConfig, setSortConfig] = useState<{
    key: SortColumnKey | null
    direction: 'asc' | 'desc' | null
  }>({
    key: 'user_name',
    direction: 'asc'
  })
  
  // 이미지 프록시를 통한 안전한 URL 생성
  const getSafeImageUrl = (url: string | null): string | null => {
    if (!url) return null
    
    // 로컬 경로인 경우 (상대 경로 또는 /uploads로 시작)
    if (url.startsWith('/') || url.startsWith('./') || url.startsWith('../')) {
      // 항상 localhost:3001을 기준으로 프록시 URL 생성
      const fullUrl = `http://localhost:3001${url}`
      return `${API_BASE}/api/image/proxy?url=${encodeURIComponent(fullUrl)}`
    }
    
    // 외부 URL인 경우 프록시 사용
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return `${API_BASE}/api/image/proxy?url=${encodeURIComponent(url)}`
    }
    
    return url
  }
  const [searchParams, setSearchParams] = useState({
    userName: '',
    userId: '',
    /** 사용여부: 체크 시 use_yn = Y 인 사용자만 */
    filterUseYn: false,
    /** 업로드: 체크 시 upload_stop = N(정상) 인 사용자만 */
    filterUploadNormal: false,
    /** 재업로드여부: 체크 시 reupload_target_yn = Y 인 사용자만 */
    filterReupload: false
  })
  
  // 페이징 상태
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(20) // 페이지당 항목 수
  
  // 수정/추가 모달 상태
  const [showEditModal, setShowEditModal] = useState(false)
  const [isNewUser, setIsNewUser] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [editData, setEditData] = useState<Partial<User>>({})
  
  // 마켓연동 모달 상태
  const [showMarketModal, setShowMarketModal] = useState(false)
  const [marketUserId, setMarketUserId] = useState('')
  const [marketUserName, setMarketUserName] = useState('')
  const [activeTab, setActiveTab] = useState<'smartstore' | 'coupang'>('smartstore')
  const [smartStores, setSmartStores] = useState<StoreInfo[]>([
    { biz_idx: 1, storeName: '', id: '', storeId: '', password: '', appId: '', appSecret: '', useYn: 'Y' },
    { biz_idx: 2, storeName: '', id: '', storeId: '', password: '', appId: '', appSecret: '', useYn: 'Y' },
    { biz_idx: 3, storeName: '', id: '', storeId: '', password: '', appId: '', appSecret: '', useYn: 'Y' }
  ])
  const [coupangStores, setCoupangStores] = useState<CoupangInfo[]>([
    { biz_idx: 1, storeName: '', accountId: '', password: '', vendorCode: '', accessKey: '', secretKey: '', useYn: 'Y' },
    { biz_idx: 2, storeName: '', accountId: '', password: '', vendorCode: '', accessKey: '', secretKey: '', useYn: 'Y' },
    { biz_idx: 3, storeName: '', accountId: '', password: '', vendorCode: '', accessKey: '', secretKey: '', useYn: 'Y' }
  ])
  
  // 서버 목록 상태
  const [servers, setServers] = useState<ServerInfo[]>([])
  
  // 상세이미지 모달 상태
  const [showDetailImageModal, setShowDetailImageModal] = useState(false)
  const [detailImageUserId, setDetailImageUserId] = useState('')
  const [topImageFile, setTopImageFile] = useState<File | null>(null)
  const [bottomImageFile, setBottomImageFile] = useState<File | null>(null)
  const [topImagePreview, setTopImagePreview] = useState<string | null>(null)
  const [bottomImagePreview, setBottomImagePreview] = useState<string | null>(null)
  const [zoomImage, setZoomImage] = useState<string | null>(null)

  // 컴포넌트 마운트 시 전체 사용자 조회 및 서버 목록 조회
  useEffect(() => {
    loadUsers()
    loadServers()
  }, [])

  // 서버 목록 조회
  const loadServers = async () => {
    try {
      const response = await fetch(`${API_URL}/servers`)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const result = await response.json()
      
      if (result.success) {
        setServers(result.data)
      }
    } catch (error) {
      console.error('서버 목록 조회 오류:', error)
    }
  }

  // 사용자 목록 조회
  const loadUsers = async (params?: {
    userName?: string
    userId?: string
    filterUseYn?: boolean
    filterUploadNormal?: boolean
    filterReupload?: boolean
  }) => {
    try {
      setLoading(true)
      const queryParams = new URLSearchParams()

      if (params?.userName?.trim()) queryParams.append('userName', params.userName.trim())
      if (params?.userId?.trim()) queryParams.append('userId', params.userId.trim())
      if (params?.filterUseYn) queryParams.append('useYn', '1')
      if (params?.filterUploadNormal) queryParams.append('uploadNormal', '1')
      if (params?.filterReupload) queryParams.append('reuploadTarget', '1')

      const url = queryParams.toString() ? `${API_URL}?${queryParams}` : API_URL
      console.log('API 요청:', url)
      
      const response = await fetch(url)
      console.log('응답 상태:', response.status, response.statusText)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const result = await response.json()
      console.log('응답 데이터:', result)
      
      if (result.success) {
        // 각 사용자의 마켓 연동 수 조회
        const usersWithMarketCount = await Promise.all(
          result.data.map(async (user: User) => {
            try {
              const marketResponse = await fetch(`${API_URL}/${user.user_id}/market-count`)
              const marketResult = await marketResponse.json()
              
              if (marketResult.success) {
                return {
                  ...user,
                  marketCount: marketResult.data.totalCount
                }
              }
              return { ...user, marketCount: 0 }
            } catch (error) {
              console.error(`마켓 연동 수 조회 오류 (${user.user_id}):`, error)
              return { ...user, marketCount: 0 }
            }
          })
        )
        
        setUsers(usersWithMarketCount)
      } else {
        await showAlert(result.message || '사용자 목록 조회에 실패했습니다.')
      }
    } catch (error) {
      console.error('사용자 목록 조회 오류:', error)
      
      if (error instanceof TypeError && error.message.includes('fetch')) {
        await showAlert('백엔드 서버에 연결할 수 없습니다.\n\n백엔드 서버가 실행 중인지 확인해주세요.\n(http://localhost:3001)')
      } else {
        await showAlert(`사용자 목록을 불러오는 중 오류가 발생했습니다.\n\n오류: ${error instanceof Error ? error.message : String(error)}`)
      }
    } finally {
      setLoading(false)
    }
  }

  /** 체크박스 등 검색조건 반영 + 즉시 API 재조회 (사용자명/ID는 현재 입력값 유지) */
  const applySearchParamsAndRefetch = (patch: Partial<typeof searchParams>) => {
    const next = { ...searchParams, ...patch }
    setSearchParams(next)
    setCurrentPage(1)
    void loadUsers(next)
  }

  // 검색 버튼 클릭
  const handleSearch = () => {
    setCurrentPage(1) // 검색 시 첫 페이지로 이동
    loadUsers(searchParams)
  }

  // 정렬 처리
  const handleSort = (key: SortColumnKey) => {
    let direction: 'asc' | 'desc' | null = 'asc'

    if (sortConfig.key === key) {
      if (sortConfig.direction === 'asc') {
        direction = 'desc'
      } else if (sortConfig.direction === 'desc') {
        direction = null
      }
    }

    setSortConfig({ key: direction ? key : null, direction })
  }

  // 정렬된 사용자 목록
  const sortedUsers = React.useMemo(() => {
    if (!sortConfig.key || !sortConfig.direction) {
      return users
    }

    return [...users].sort((a, b) => {
      if (sortConfig.key === 'days_remaining') {
        const aD = getDaysRemainingFromEndDate(a.end_date)
        const bD = getDaysRemainingFromEndDate(b.end_date)
        if (aD === null && bD === null) return 0
        if (aD === null) return 1
        if (bD === null) return -1
        return sortConfig.direction === 'asc' ? aD - bD : bD - aD
      }

      const col = sortConfig.key as keyof User
      let aValue = a[col]
      let bValue = b[col]

      if (aValue === null || aValue === undefined) return 1
      if (bValue === null || bValue === undefined) return -1

      // 숫자 타입 컬럼 처리 (proc_ord, margin_rate, get_cnt, del_cnt, del_days, sale_keep_days, marketCount)
      const numericFields: (keyof User)[] = [
        'proc_ord',
        'margin_rate',
        'get_cnt',
        'del_cnt',
        'del_days',
        'sale_keep_days',
        'marketCount'
      ]
      if (numericFields.includes(col)) {
        const aNum = Number(aValue) || 0
        const bNum = Number(bValue) || 0
        return sortConfig.direction === 'asc' ? aNum - bNum : bNum - aNum
      }

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortConfig.direction === 'asc'
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue)
      }

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue
      }

      return 0
    })
  }, [users, sortConfig])

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
    setCurrentPage(1) // 첫 페이지로 이동
  }

  // 마켓연동 버튼 클릭
  const handleMarketConnection = async (userId: string) => {
    const user = users.find(u => u.user_id === userId)
    setMarketUserId(userId)
    setMarketUserName(user?.user_name || '')
    setActiveTab('smartstore')
    await loadMarketData(userId)
    setShowMarketModal(true)
  }

  // 마켓 데이터 로드
  const loadMarketData = async (userId: string) => {
    await Promise.all([
      loadSmartStores(userId),
      loadCoupangStores(userId)
    ])
  }

  // 스마트스토어 목록 조회
  const loadSmartStores = async (userId: string) => {
    try {
      const response = await fetch(`${MARKET_API_URL}/smartstore/${userId}`)
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
      
      const result = await response.json()
      
      if (result.success && result.data.length > 0) {
        const loadedStores = [1, 2, 3].map(idx => {
          const found = result.data.find((s: any) => s.biz_idx === idx)
          return found ? {
            biz_idx: found.biz_idx,
            storeName: found.store_name || '',
            id: found.account_id || '',
            storeId: found.store_id || '',
            password: found.user_pwd || '',
            appId: found.client_id || '',
            appSecret: found.client_secret_sign || '',
            useYn: found.use_yn || 'Y',
            isNew: false
          } : {
            biz_idx: idx,
            storeName: '',
            id: '',
            storeId: '',
            password: '',
            appId: '',
            appSecret: '',
            useYn: 'Y',
            isNew: true
          }
        })
        setSmartStores(loadedStores)
      }
    } catch (error) {
      console.error('스마트스토어 조회 오류:', error)
    }
  }

  // 쿠팡 목록 조회
  const loadCoupangStores = async (userId: string) => {
    try {
      const response = await fetch(`${MARKET_API_URL}/coupang/${userId}`)
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
      
      const result = await response.json()
      
      if (result.success && result.data.length > 0) {
        const loadedStores = [1, 2, 3].map(idx => {
          const found = result.data.find((c: any) => c.biz_idx === idx)
          return found ? {
            biz_idx: found.biz_idx,
            storeName: found.store_name || '',
            accountId: found.accountId || '',
            password: found.user_pwd || '',
            vendorCode: found.vendorId || '',
            accessKey: found.accessKey || '',
            secretKey: found.secretKey || '',
            useYn: found.use_yn || 'Y',
            isNew: false
          } : {
            biz_idx: idx,
            storeName: '',
            accountId: '',
            password: '',
            vendorCode: '',
            accessKey: '',
            secretKey: '',
            useYn: 'Y',
            isNew: true
          }
        })
        setCoupangStores(loadedStores)
      }
    } catch (error) {
      console.error('쿠팡 조회 오류:', error)
    }
  }

  // 스마트스토어 개별 저장
  const handleSmartStoreSave = async (index: number) => {
    const store = smartStores[index]
    
    // 연동 테스트 (토큰 발급 성공 여부)
    try {
      const testResponse = await fetch(`${SMARTSTORE_API_URL}/token-test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          marketAccount: store.id,
          clientId: store.appId,
          clientSecret: store.appSecret
        })
      })

      const testResult = await testResponse.json()
      if (!testResult.success) {
        await showAlert(testResult.message || '스마트스토어 연동 테스트에 실패했습니다.')
        return
      }
    } catch (error) {
      console.error('스마트스토어 연동 테스트 오류:', error)
      await showAlert('스마트스토어 연동 테스트 중 오류가 발생했습니다.')
      return
    }
    
    try {
      setLoading(true)
      const response = await fetch(`${MARKET_API_URL}/smartstore/${marketUserId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          biz_idx: store.biz_idx,
          store_name: store.storeName,
          account_id: store.id,
          store_id: store.storeId,
          user_pwd: store.password,
          client_id: store.appId,
          client_secret_sign: store.appSecret,
          use_yn: store.useYn
        })
      })

      const result = await response.json()
      if (result.success) {
        await showAlert('스마트스토어 정보가 저장되었습니다.')
        await loadSmartStores(marketUserId)
      } else {
        await showAlert(`저장 실패: ${result.message}`)
      }
    } catch (error) {
      console.error('스마트스토어 저장 오류:', error)
      await showAlert('저장 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  // 쿠팡 개별 저장
  const handleCoupangSave = async (index: number) => {
    const store = coupangStores[index]
    
    // 쿠팡 연동 테스트
    try {
      const testResponse = await fetch(`${COUPANG_API_URL}/auth-test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          vendorId: store.vendorCode,
          accessKey: store.accessKey,
          secretKey: store.secretKey
        })
      })

      const testResult = await testResponse.json()
      if (!testResult.success) {
        await showAlert(testResult.message || '쿠팡 연동 테스트에 실패했습니다.')
        return
      }
    } catch (error) {
      console.error('쿠팡 연동 테스트 오류:', error)
      await showAlert('쿠팡 연동 테스트 중 오류가 발생했습니다.')
      return
    }
    
    try {
      setLoading(true)
      const response = await fetch(`${MARKET_API_URL}/coupang/${marketUserId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          biz_idx: store.biz_idx,
          store_name: store.storeName,
          accountId: store.accountId,
          user_pwd: store.password,
          vendorId: store.vendorCode,
          accessKey: store.accessKey,
          secretKey: store.secretKey,
          use_yn: store.useYn
        })
      })

      const result = await response.json()
      if (result.success) {
        await showAlert('쿠팡 정보가 저장되었습니다.')
        await loadCoupangStores(marketUserId)
      } else {
        await showAlert(`저장 실패: ${result.message}`)
      }
    } catch (error) {
      console.error('쿠팡 저장 오류:', error)
      await showAlert('저장 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  // 스마트스토어 정보 변경
  const handleSmartStoreChange = (index: number, field: keyof StoreInfo, value: string) => {
    const updated = [...smartStores]
    updated[index] = { ...updated[index], [field]: value }
    setSmartStores(updated)
  }

  // 쿠팡 정보 변경
  const handleCoupangChange = (index: number, field: keyof CoupangInfo, value: string) => {
    const updated = [...coupangStores]
    updated[index] = { ...updated[index], [field]: value }
    setCoupangStores(updated)
  }
  
  // 상세이미지 모달 열기
  const handleDetailImageClick = async (userId: string) => {
    setDetailImageUserId(userId)
    setTopImageFile(null)
    setBottomImageFile(null)
    setTopImagePreview(null)
    setBottomImagePreview(null)
    
    // 기존 이미지 로드
    try {
      const response = await fetch(`${USER_DETAIL_IMAGE_API_URL}/${userId}`)
      const result = await response.json()
      
      if (result.success && result.data) {
        if (result.data.top_img_url) {
          setTopImagePreview(getSafeImageUrl(result.data.top_img_url))
        }
        if (result.data.bottom_img_url) {
          setBottomImagePreview(getSafeImageUrl(result.data.bottom_img_url))
        }
      }
    } catch (error) {
      console.error('기존 이미지 로드 오류:', error)
    }
    
    setShowDetailImageModal(true)
  }
  
  // 이미지 파일 선택
  const handleImageSelect = (type: 'top' | 'bottom', event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    
    // 파일 타입 검증
    if (!file.type.match(/image\/(jpeg|jpg|png)/)) {
      showAlert('JPG, PNG 파일만 업로드 가능합니다.')
      return
    }
    
    // 파일 크기 검증 (10MB)
    if (file.size > 10 * 1024 * 1024) {
      showAlert('파일 크기는 10MB 이하만 가능합니다.')
      return
    }
    
    // 미리보기 생성
    const reader = new FileReader()
    reader.onload = (e) => {
      if (type === 'top') {
        setTopImageFile(file)
        setTopImagePreview(e.target?.result as string)
      } else {
        setBottomImageFile(file)
        setBottomImagePreview(e.target?.result as string)
      }
    }
    reader.readAsDataURL(file)
  }
  
  // 상세이미지 저장
  const handleDetailImageSave = async () => {
    if (!topImageFile && !bottomImageFile) {
      await showAlert('저장할 이미지를 선택해주세요.')
      return
    }
    
    try {
      setLoading(true)
      
      const formData = new FormData()
      if (topImageFile) {
        formData.append('topImage', topImageFile)
      }
      if (bottomImageFile) {
        formData.append('bottomImage', bottomImageFile)
      }
      
      const response = await fetch(`${USER_DETAIL_IMAGE_API_URL}/${detailImageUserId}`, {
        method: 'POST',
        body: formData
      })
      
      const result = await response.json()
      
      if (result.success) {
        await showAlert('상세 이미지가 저장되었습니다.')
        setShowDetailImageModal(false)
      } else {
        await showAlert(`저장 실패: ${result.message}`)
      }
    } catch (error) {
      console.error('상세 이미지 저장 오류:', error)
      await showAlert('저장 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }
  
  // 상세이미지 모달 닫기
  const handleDetailImageCancel = () => {
    setShowDetailImageModal(false)
    setTopImageFile(null)
    setBottomImageFile(null)
    setTopImagePreview(null)
    setBottomImagePreview(null)
  }
  
  // 이미지 확대
  const handleImageZoom = (imageUrl: string) => {
    setZoomImage(imageUrl)
  }
  
  // 이미지 확대 닫기
  const handleZoomClose = () => {
    setZoomImage(null)
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

  // Enter 키 검색
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }

  // 신규 등록 버튼 클릭
  const handleAddClick = () => {
    setIsNewUser(true)
    setSelectedUser(null)
    setEditData({
      user_id: '',
      user_pwd: '',
      user_name: '',
      start_date: null,
      end_date: null,
      user_type: '',
      margin_rate: 0,
      user_phone: '',
      user_email: '',
      server_id: '',
      use_yn: 'Y',
      get_cnt: 0,
      del_cnt: 0,
      del_days: 0,
      sale_keep_days: 0,
      proc_ord: 0,
      upload_stop: 'N'
    })
    setShowEditModal(true)
  }

  // 수정 버튼 클릭
  const handleEditClick = (user: User) => {
    setIsNewUser(false)
    // users 배열에서 최신 사용자 정보를 찾아서 설정 (깊은 복사)
    const latestUser = users.find(u => u.user_id === user.user_id)
    if (latestUser) {
      setSelectedUser({ ...latestUser })
      setEditData({ ...latestUser })
    } else {
      setSelectedUser({ ...user })
      setEditData({ ...user })
    }
    setShowEditModal(true)
  }

  // 해당 사용자로 로그인
  const handleLoginAs = async (user: User) => {
    const confirmed = await showConfirm(`${user.user_name}(${user.user_id}) 계정으로 로그인하시겠습니까?`)
    if (!confirmed) {
      return
    }

    // 종료일 체크
    if (user.end_date) {
      const endDate = new Date(user.end_date)
      const today = new Date()
      if (endDate < today) {
        await showAlert('사용기한이 지난 계정입니다.')
        return
      }
    }

    // 로컬스토리지에 사용자 정보 저장
    const newUserInfo = {
      userId: user.user_id,
      userName: user.user_name,
      userType: user.user_type,
      endDate: user.end_date || null
    }
    localStorage.setItem('userInfo', JSON.stringify(newUserInfo))
    
    // 로그인 성공 메시지 표시
    await showAlert(`${user.user_name} 계정으로 로그인되었습니다.`)
    
    // UserContext 업데이트 (메시지 확인 후)
    console.log('setUserInfo 호출:', newUserInfo)
    setUserInfo(newUserInfo)
    
    // 대시보드로 확실히 이동
    console.log('대시보드로 이동 시작, onNavigate:', onNavigate)
    
    if (onNavigate) {
      console.log('onNavigate 함수 호출')
      onNavigate('dashboard')
    } else {
      console.log('페이지 새로고침')
      window.location.reload()
    }
  }

  // 모달 닫기
  const closeEditModal = () => {
    setShowEditModal(false)
    setIsNewUser(false)
    setSelectedUser(null)
    setEditData({})
  }

  // 수정 데이터 변경
  const handleEditChange = (field: keyof User, value: any) => {
    setEditData({
      ...editData,
      [field]: value
    })
  }

  // 저장 (추가 또는 수정)
  const handleSave = async () => {
    // 필수 필드 검증
    if (!editData.user_id || !editData.user_pwd || !editData.user_name) {
      await showAlert('사용자ID, 비밀번호, 사용자명은 필수 입력 항목입니다.')
      return
    }
    
    try {
      setLoading(true)
      
      if (isNewUser) {
        // 신규 등록
        const response = await fetch(API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(editData)
        })
        
        const result = await response.json()
        
        if (result.success) {
          // 모달 닫기
          closeEditModal()
          // 로딩 상태 유지하면서 데이터 새로고침
          await loadUsers(searchParams)
          // 성공 메시지 표시
          await showAlert('사용자가 등록되었습니다.')
        } else {
          await showAlert(result.message || '등록 중 오류가 발생했습니다.')
        }
      } else {
        // 수정
        if (!selectedUser) return
        
        console.log('사용자 수정 요청 데이터:', editData)
        
        const response = await fetch(`${API_URL}/${selectedUser.user_id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(editData)
        })
        
        console.log('사용자 수정 응답 상태:', response.status)
        
        const result = await response.json()
        
        console.log('사용자 수정 응답 결과:', result)
        
        if (result.success) {
          // 모달 닫기
          closeEditModal()
          // 로딩 상태 유지하면서 데이터 새로고침
          await loadUsers(searchParams)
          // 성공 메시지 표시
          await showAlert('사용자 정보가 수정되었습니다.')
        } else {
          await showAlert(result.message || '수정 중 오류가 발생했습니다.')
        }
      }
    } catch (error) {
      console.error('사용자 저장 오류:', error)
      await showAlert('저장 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  // 날짜 포맷팅
  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-'
    const date = new Date(dateString)
    if (Number.isNaN(date.getTime())) return '-'
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}.${month}.${day}`
  }

  /** 종료일자(0시) − 오늘(0시) 일수. 미설정/파싱 불가 시 '-' */
  const formatDaysRemaining = (endDateStr: string | null) => {
    const n = getDaysRemainingFromEndDate(endDateStr)
    if (n === null) return '-'
    return String(n)
  }

  // 날짜시간 포맷팅 (YYYY-MM-DD HH:mm)
  const formatDateTime = (dateString: string | null) => {
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

  // 마켓 연동 상태 정보 반환
  const getMarketConnectionInfo = (count: number = 0) => {
    if (count === 0) {
      return {
        text: '마켓연동',
        className: 'market-btn-none'
      }
    } else if (count < 6) {
      return {
        text: '연동중',
        className: 'market-btn-partial'
      }
    } else {
      return {
        text: '연동완료',
        className: 'market-btn-complete'
      }
    }
  }

  // 정렬 아이콘 반환
  const getSortIcon = (key: SortColumnKey) => {
    if (sortConfig.key !== key) {
      return ' ⇅'
    }
    if (sortConfig.direction === 'asc') {
      return ' ↑'
    }
    if (sortConfig.direction === 'desc') {
      return ' ↓'
    }
    return ' ⇅'
  }

  return (
    <div className="user-management-page">
      {/* 페이지 헤더 */}
      <div className="user-management-page-header">
        <h1 className="page-title">👥 사용자관리</h1>
        <button className="add-user-btn" onClick={handleAddClick}>
          + 신규 사용자 등록
        </button>
      </div>

      {/* 검색 영역 */}
      <div className="search-area">
        <div className="search-row">
          <div className="search-group">
            <label className="search-label">사용자명:</label>
            <input
              type="text"
              className="search-input"
              value={searchParams.userName}
              onChange={e => setSearchParams({ ...searchParams, userName: e.target.value })}
              onKeyPress={handleKeyPress}
              placeholder="사용자명 입력"
            />
          </div>
          <div className="search-group">
            <label className="search-label">사용자ID:</label>
            <input
              type="text"
              className="search-input"
              value={searchParams.userId}
              onChange={e => setSearchParams({ ...searchParams, userId: e.target.value })}
              onKeyPress={handleKeyPress}
              placeholder="사용자ID 입력"
            />
          </div>
          <div className="search-check-inline" aria-label="검색 조건">
            <label className="search-check-item">
              <input
                type="checkbox"
                checked={searchParams.filterUseYn}
                onChange={e => applySearchParamsAndRefetch({ filterUseYn: e.target.checked })}
                disabled={loading}
              />
              <span>사용여부</span>
            </label>
            <label className="search-check-item">
              <input
                type="checkbox"
                checked={searchParams.filterUploadNormal}
                onChange={e =>
                  applySearchParamsAndRefetch({ filterUploadNormal: e.target.checked })
                }
                disabled={loading}
              />
              <span>업로드</span>
            </label>
            <label className="search-check-item">
              <input
                type="checkbox"
                checked={searchParams.filterReupload}
                onChange={e => applySearchParamsAndRefetch({ filterReupload: e.target.checked })}
                disabled={loading}
              />
              <span>재업로드여부</span>
            </label>
          </div>
          <button
            type="button"
            className="search-btn"
            onClick={handleSearch}
            disabled={loading}
          >
            {loading ? '검색 중...' : '검색'}
          </button>
        </div>
      </div>

      {/* 사용자 목록 테이블 */}
      <div className="user-table-container">
        <div className="table-header">
          <h3>사용자 목록 ({users.length}명)</h3>
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
          <table className="user-table">
            <thead>
              <tr>
                <th>순번</th>
                <th className="sortable" onClick={() => handleSort('user_id')}>
                  사용자ID{getSortIcon('user_id')}
                </th>
                <th className="sortable" onClick={() => handleSort('user_name')}>
                  사용자명{getSortIcon('user_name')}
                </th>
                <th className="sortable" onClick={() => handleSort('user_type')}>
                  사용자종류{getSortIcon('user_type')}
                </th>
                <th className="sortable" onClick={() => handleSort('start_date')}>
                  시작일자{getSortIcon('start_date')}
                </th>
                <th className="sortable" onClick={() => handleSort('end_date')}>
                  종료일자{getSortIcon('end_date')}
                </th>
                <th
                  className="th-days-remaining sortable"
                  onClick={() => handleSort('days_remaining')}
                >
                  남은일자{getSortIcon('days_remaining')}
                </th>
                <th className="sortable" onClick={() => handleSort('margin_rate')}>
                  마진율(%){getSortIcon('margin_rate')}
                </th>
                <th className="sortable" onClick={() => handleSort('server_id')}>
                  서버ID{getSortIcon('server_id')}
                </th>
                <th className="sortable" onClick={() => handleSort('proc_ord')}>
                  처리순번{getSortIcon('proc_ord')}
                </th>
                <th className="sortable" onClick={() => handleSort('use_yn')}>
                  사용여부{getSortIcon('use_yn')}
                </th>
                <th className="sortable" onClick={() => handleSort('upload_stop')}>
                  업로드{getSortIcon('upload_stop')}
                </th>
                <th className="sortable" onClick={() => handleSort('reupload_target_yn')}>
                  재업로드여부{getSortIcon('reupload_target_yn')}
                </th>
                <th className="sortable" onClick={() => handleSort('input_date')}>
                  등록일자{getSortIcon('input_date')}
                </th>
                <th className="sortable" onClick={() => handleSort('marketCount')}>
                  마켓연동{getSortIcon('marketCount')}
                </th>
                <th>상세이미지</th>
                <th>수정</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td colSpan={17} className="no-data">
                    {loading ? '로딩 중...' : '조회된 사용자가 없습니다.'}
                  </td>
                </tr>
              ) : (
                currentUsers.map((user, index) => {
                  const daysRem = getDaysRemainingFromEndDate(user.end_date)
                  const daysRemainClass =
                    daysRem === null
                      ? ''
                      : daysRem <= 3
                        ? ' td-days-remaining-critical'
                        : daysRem <= 10
                          ? ' td-days-remaining-warning'
                          : ''
                  return (
                  <tr key={user.user_id}>
                    <td>{indexOfFirstItem + index + 1}</td>
                    <td>{user.user_id}</td>
                    <td 
                      className="clickable-username"
                      onClick={() => handleLoginAs(user)}
                    >
                      {user.user_name}
                    </td>
                    <td>{user.user_type}</td>
                    <td>{formatDate(user.start_date)}</td>
                    <td>{formatDate(user.end_date)}</td>
                    <td className={`td-days-remaining${daysRemainClass}`}>
                      {formatDaysRemaining(user.end_date)}
                    </td>
                    <td>{user.margin_rate}%</td>
                    <td>{user.server_id}</td>
                    <td>{user.proc_ord}</td>
                    <td>
                      <span className={`status-badge ${user.use_yn === 'Y' ? 'active' : 'inactive'}`}>
                        {user.use_yn === 'Y' ? '사용' : '미사용'}
                      </span>
                    </td>
                    <td>
                      <span className={`status-badge ${user.upload_stop === 'Y' ? 'inactive' : 'active'}`}>
                        {user.upload_stop === 'Y' ? '중지' : '정상'}
                      </span>
                    </td>
                    <td>
                      <span className={`status-badge ${user.reupload_target_yn === 'Y' ? 'active' : 'inactive'}`}>
                        {user.reupload_target_yn === 'Y' ? '예' : '아니오'}
                      </span>
                    </td>
                    <td>{formatDateTime(user.input_date)}</td>
                    <td>
                      {(() => {
                        const marketInfo = getMarketConnectionInfo(user.marketCount)
                        return (
                          <button 
                            className={`market-btn ${marketInfo.className}`}
                            onClick={() => handleMarketConnection(user.user_id)}
                          >
                            {marketInfo.text}
                          </button>
                        )
                      })()}
                    </td>
                    <td>
                      <button 
                        className="market-btn detail-image-btn"
                        onClick={() => handleDetailImageClick(user.user_id)}
                      >
                        상세이미지
                      </button>
                    </td>
                    <td>
                      <button 
                        className="edit-btn"
                        onClick={() => handleEditClick(user)}
                      >
                        수정
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
        {users.length > 0 && (
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
              {currentPage} / {totalPages} 페이지 (총 {users.length}명)
            </span>
          </div>
        )}
      </div>

      {/* 수정/추가 모달 */}
      {showEditModal && (
        <div className="modal-overlay">
          <div className="modal-content user-edit-modal">
            <div className="modal-header">
              <h3 className="modal-title">{isNewUser ? '신규 사용자 등록' : '사용자 정보 수정'}</h3>
              <button className="modal-close" onClick={closeEditModal}>✕</button>
            </div>

            <div className="modal-body">
              <div className="modal-grid">
                {/* 사용자ID */}
                <div className="modal-field">
                  <label>사용자ID *</label>
                  <input 
                    type="text" 
                    value={editData.user_id || ''} 
                    onChange={(e) => handleEditChange('user_id', e.target.value)}
                    disabled={!isNewUser}
                    placeholder={isNewUser ? '사용자ID 입력' : ''}
                  />
                </div>

                {/* 비밀번호 */}
                <div className="modal-field">
                  <label>비밀번호 *</label>
                  <input
                    type="password"
                    value={editData.user_pwd || ''}
                    onChange={(e) => handleEditChange('user_pwd', e.target.value)}
                    placeholder={isNewUser ? '비밀번호 입력' : ''}
                  />
                </div>

                {/* 사용자명 */}
                <div className="modal-field">
                  <label>사용자명 *</label>
                  <input
                    type="text"
                    value={editData.user_name || ''}
                    onChange={(e) => handleEditChange('user_name', e.target.value)}
                    placeholder={isNewUser ? '사용자명 입력' : ''}
                  />
                </div>

                {/* 사용자종류 */}
                <div className="modal-field">
                  <label>사용자종류</label>
                  <select
                    value={editData.user_type || ''}
                    onChange={(e) => handleEditChange('user_type', e.target.value)}
                  >
                    <option value="">선택하세요</option>
                    <option value="일반">일반</option>
                    <option value="우대">우대</option>
                    <option value="관리자">관리자</option>
                  </select>
                </div>

                {/* 연락처 */}
                <div className="modal-field">
                  <label>연락처</label>
                  <input
                    type="text"
                    value={editData.user_phone || ''}
                    onChange={(e) => handleEditChange('user_phone', e.target.value)}
                  />
                </div>

                {/* 이메일 */}
                <div className="modal-field">
                  <label>이메일</label>
                  <input
                    type="email"
                    value={editData.user_email || ''}
                    onChange={(e) => handleEditChange('user_email', e.target.value)}
                  />
                </div>

                {/* 시작일자 */}
                <div className="modal-field">
                  <label>시작일자</label>
                  <input
                    type="date"
                    value={editData.start_date ? new Date(editData.start_date).toISOString().split('T')[0] : ''}
                    onChange={(e) => handleEditChange('start_date', e.target.value)}
                  />
                </div>

                {/* 종료일자 */}
                <div className="modal-field">
                  <label>종료일자</label>
                  <input
                    type="date"
                    value={editData.end_date ? new Date(editData.end_date).toISOString().split('T')[0] : ''}
                    onChange={(e) => handleEditChange('end_date', e.target.value)}
                  />
                </div>

                {/* 마진율 */}
                <div className="modal-field">
                  <label>마진율(%)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editData.margin_rate || 0}
                    onChange={(e) => handleEditChange('margin_rate', parseFloat(e.target.value))}
                  />
                </div>

                {/* 서버ID */}
                <div className="modal-field">
                  <label>서버ID</label>
                  <select
                    value={editData.server_id || ''}
                    onChange={(e) => handleEditChange('server_id', e.target.value)}
                  >
                    <option value="">선택하세요</option>
                    {servers.map((server) => (
                      <option key={server.server_id} value={server.server_id}>
                        {server.server_name} ({server.server_id})
                      </option>
                    ))}
                  </select>
                </div>

                {/* 사용여부 */}
                <div className="modal-field">
                  <label>사용여부</label>
                  <select
                    value={editData.use_yn || ''}
                    onChange={(e) => handleEditChange('use_yn', e.target.value)}
                  >
                    <option value="">선택하세요</option>
                    <option value="Y">사용</option>
                    <option value="N">미사용</option>
                  </select>
                </div>

                {/* 재업로드여부 */}
                <div className="modal-field">
                  <label>재업로드여부</label>
                  <select
                    value={editData.reupload_target_yn || ''}
                    onChange={(e) => handleEditChange('reupload_target_yn', e.target.value)}
                  >
                    <option value="">선택하세요</option>
                    <option value="Y">예</option>
                    <option value="N">아니오</option>
                  </select>
                </div>

                {/* 상품건수 */}
                <div className="modal-field">
                  <label>상품건수</label>
                  <input
                    type="number"
                    value={editData.get_cnt || 0}
                    onChange={(e) => handleEditChange('get_cnt', parseInt(e.target.value))}
                  />
                </div>

                {/* 삭제할상품수 */}
                <div className="modal-field">
                  <label>삭제할상품수</label>
                  <input
                    type="number"
                    value={editData.del_cnt || 0}
                    onChange={(e) => handleEditChange('del_cnt', parseInt(e.target.value))}
                  />
                </div>

                {/* 삭제기준일수 */}
                <div className="modal-field">
                  <label>삭제기준일수</label>
                  <input
                    type="number"
                    value={editData.del_days || 0}
                    onChange={(e) => handleEditChange('del_days', parseInt(e.target.value))}
                  />
                </div>

                {/* 판매상품유지기간 */}
                <div className="modal-field">
                  <label>판매상품유지기간</label>
                  <input
                    type="number"
                    value={editData.sale_keep_days || 0}
                    onChange={(e) => handleEditChange('sale_keep_days', parseInt(e.target.value))}
                  />
                </div>

                {/* 처리순번 */}
                <div className="modal-field">
                  <label>처리순번</label>
                  <input
                    type="number"
                    value={editData.proc_ord || 0}
                    onChange={(e) => handleEditChange('proc_ord', parseInt(e.target.value))}
                  />
                </div>

                {/* 업로드중지 */}
                <div className="modal-field">
                  <label>업로드중지</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="checkbox"
                      checked={editData.upload_stop === 'Y'}
                      onChange={(e) => handleEditChange('upload_stop', e.target.checked ? 'Y' : 'N')}
                      style={{ width: 'auto', cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: '14px', color: '#666' }}>
                      중지
                    </span>
                  </div>
                </div>

                {/* 마지막처리일시 (읽기전용) */}
                <div className="modal-field">
                  <label>마지막처리일시</label>
                  <input
                    type="text"
                    value={editData.last_proc_date ? formatDateTime(editData.last_proc_date) : '-'}
                    disabled
                  />
                </div>

                {/* 배치실행일시 (읽기전용) */}
                <div className="modal-field">
                  <label>배치실행일시</label>
                  <input
                    type="text"
                    value={editData.batch_date ? formatDateTime(editData.batch_date) : '-'}
                    disabled
                  />
                </div>

                {/* 삭제처리일자 (읽기전용) */}
                <div className="modal-field">
                  <label>삭제처리일자</label>
                  <input
                    type="text"
                    value={editData.last_delete_date ? formatDate(editData.last_delete_date) : '-'}
                    disabled
                  />
                </div>

                {/* 고객센터 */}
                <div className="modal-field">
                  <label>고객센터</label>
                  <input
                    type="text"
                    value={editData.cs_phone || ''}
                    onChange={(e) => handleEditChange('cs_phone', e.target.value)}
                    placeholder="010-1234-5678"
                  />
                </div>

                {/* 영업시간 */}
                <div className="modal-field">
                  <label>영업시간</label>
                  <input
                    type="text"
                    value={editData.biz_hours || ''}
                    onChange={(e) => handleEditChange('biz_hours', e.target.value)}
                    placeholder="오전 9시 ~ 오후 6시"
                  />
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="modal-btn cancel-btn" onClick={closeEditModal}>
                취소
              </button>
              <button 
                className="modal-btn save-btn" 
                onClick={handleSave}
                disabled={loading}
              >
                {loading ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 마켓연동 모달 */}
      {showMarketModal && (
        <div className="modal-overlay">
          <div className="modal-content market-modal">
            <div className="modal-header">
              <h3 className="modal-title">🔗 마켓연동 관리 - {marketUserName}({marketUserId})</h3>
              <button className="modal-close" onClick={() => setShowMarketModal(false)}>×</button>
            </div>

            {/* 탭 메뉴 (MarketPage 스타일) */}
            <div className="market-tabs">
              <button
                className={`tab-btn ${activeTab === 'smartstore' ? 'active' : ''}`}
                onClick={() => setActiveTab('smartstore')}
              >
                📱 스마트스토어
              </button>
              <button
                className={`tab-btn ${activeTab === 'coupang' ? 'active' : ''}`}
                onClick={() => setActiveTab('coupang')}
              >
                🛍️ 쿠팡
              </button>
            </div>

            <div className="modal-body market-modal-body">
              {/* 스마트스토어 탭 */}
              {activeTab === 'smartstore' && (
                <div className="market-section">
                  <h3 className="section-title">스마트스토어 연동 정보</h3>
                  <div className="store-grid">
                    {smartStores.map((store, index) => (
                      <div key={index} className="store-card">
                        <h4 className="store-card-title">
                          스마트스토어 {index + 1}
                          {store.isNew ? (
                            <span className="new-badge">없음</span>
                          ) : store.useYn === 'N' ? (
                            <span className="disabled-badge">미사용</span>
                          ) : (
                            <span className="active-badge">사용</span>
                          )}
                        </h4>
                        <div className="form-group">
                          <label className="field-label">스토어명</label>
                          <input
                            type="text"
                            className="field-input"
                            value={store.storeName}
                            onChange={(e) => handleSmartStoreChange(index, 'storeName', e.target.value)}
                            placeholder="스토어명 입력"
                          />
                        </div>
                        <div className="form-group">
                          <label className="field-label">아이디</label>
                          <input
                            type="text"
                            className="field-input"
                            value={store.id}
                            onChange={(e) => handleSmartStoreChange(index, 'id', e.target.value)}
                            placeholder="아이디 입력"
                          />
                        </div>
                        <div className="form-group">
                          <label className="field-label">스토어 ID</label>
                          <input
                            type="text"
                            className="field-input"
                            value={store.storeId}
                            onChange={(e) => handleSmartStoreChange(index, 'storeId', e.target.value)}
                            placeholder="스토어 ID 입력"
                          />
                        </div>
                        <div className="form-group">
                          <label className="field-label">비밀번호</label>
                          <input
                            type="password"
                            className="field-input"
                            value={store.password}
                            onChange={(e) => handleSmartStoreChange(index, 'password', e.target.value)}
                            placeholder="비밀번호 입력"
                          />
                        </div>
                        <div className="form-group">
                          <label className="field-label">APP ID</label>
                          <input
                            type="text"
                            className="field-input"
                            value={store.appId}
                            onChange={(e) => handleSmartStoreChange(index, 'appId', e.target.value)}
                            placeholder="APP ID 입력"
                          />
                        </div>
                        <div className="form-group">
                          <label className="field-label">APP 시크릿</label>
                          <input
                            type="text"
                            className="field-input"
                            value={store.appSecret}
                            onChange={(e) => handleSmartStoreChange(index, 'appSecret', e.target.value)}
                            placeholder="APP 시크릿 입력"
                          />
                        </div>
                        <div className="form-group">
                          <label className="field-label">사용여부</label>
                          <select
                            className="field-input"
                            value={store.useYn}
                            onChange={(e) => handleSmartStoreChange(index, 'useYn', e.target.value)}
                          >
                            <option value="Y">사용</option>
                            <option value="N">미사용</option>
                          </select>
                        </div>
                        <button 
                          className="store-save-btn"
                          onClick={() => handleSmartStoreSave(index)}
                        >
                          저장
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 쿠팡 탭 */}
              {activeTab === 'coupang' && (
                <div className="market-section">
                  <h3 className="section-title">쿠팡 연동 정보</h3>
                  <div className="store-grid">
                    {coupangStores.map((store, index) => (
                      <div key={index} className="store-card">
                        <h4 className="store-card-title">
                          쿠팡 {index + 1}
                          {store.isNew ? (
                            <span className="new-badge">없음</span>
                          ) : store.useYn === 'N' ? (
                            <span className="disabled-badge">미사용</span>
                          ) : (
                            <span className="active-badge">사용</span>
                          )}
                        </h4>
                        <div className="form-group">
                          <label className="field-label">스토어명</label>
                          <input
                            type="text"
                            className="field-input"
                            value={store.storeName}
                            onChange={(e) => handleCoupangChange(index, 'storeName', e.target.value)}
                            placeholder="스토어명 입력"
                          />
                        </div>
                        <div className="form-group">
                          <label className="field-label">Account ID</label>
                          <input
                            type="text"
                            className="field-input"
                            value={store.accountId}
                            onChange={(e) => handleCoupangChange(index, 'accountId', e.target.value)}
                            placeholder="Account ID 입력"
                          />
                        </div>
                        <div className="form-group">
                          <label className="field-label">비밀번호</label>
                          <input
                            type="password"
                            className="field-input"
                            value={store.password}
                            onChange={(e) => handleCoupangChange(index, 'password', e.target.value)}
                            placeholder="비밀번호 입력"
                          />
                        </div>
                        <div className="form-group">
                          <label className="field-label">Vendor Code</label>
                          <input
                            type="text"
                            className="field-input"
                            value={store.vendorCode}
                            onChange={(e) => handleCoupangChange(index, 'vendorCode', e.target.value)}
                            placeholder="Vendor Code 입력"
                          />
                        </div>
                        <div className="form-group">
                          <label className="field-label">Access Key</label>
                          <input
                            type="text"
                            className="field-input"
                            value={store.accessKey}
                            onChange={(e) => handleCoupangChange(index, 'accessKey', e.target.value)}
                            placeholder="Access Key 입력"
                          />
                        </div>
                        <div className="form-group">
                          <label className="field-label">Secret Key</label>
                          <input
                            type="text"
                            className="field-input"
                            value={store.secretKey}
                            onChange={(e) => handleCoupangChange(index, 'secretKey', e.target.value)}
                            placeholder="Secret Key 입력"
                          />
                        </div>
                        <div className="form-group">
                          <label className="field-label">사용여부</label>
                          <select
                            className="field-input"
                            value={store.useYn}
                            onChange={(e) => handleCoupangChange(index, 'useYn', e.target.value)}
                          >
                            <option value="Y">사용</option>
                            <option value="N">미사용</option>
                          </select>
                        </div>
                        <button 
                          className="store-save-btn"
                          onClick={() => handleCoupangSave(index)}
                        >
                          저장
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* 상세이미지 모달 */}
      {showDetailImageModal && (
        <div className="detail-image-modal-overlay">
          <div className="detail-image-modal-content">
            <div className="detail-image-modal-header">
              <h3 className="detail-image-modal-title">상세이미지</h3>
              <button 
                className="detail-image-modal-close"
                onClick={handleDetailImageCancel}
              >
                ✕
              </button>
            </div>
            
            <div className="detail-image-modal-body">
              <div className="detail-image-container">
                {/* 상단이미지 */}
                <div className="image-section">
                <h3 className="image-section-title">상단이미지</h3>
                <div className="image-upload-box">
                  {topImagePreview ? (
                    <img 
                      src={topImagePreview} 
                      alt="상단이미지" 
                      className="image-preview"
                      onClick={() => handleImageZoom(topImagePreview)}
                    />
                  ) : (
                    <div className="image-placeholder">
                      <div className="placeholder-icon">📷</div>
                      <div className="placeholder-text">이미지 선택</div>
                      <div className="placeholder-format">(JPG, PNG)</div>
                    </div>
                  )}
                  <input
                    type="file"
                    id="topImageInput"
                    accept="image/jpeg,image/jpg,image/png"
                    style={{ display: 'none' }}
                    onChange={(e) => handleImageSelect('top', e)}
                  />
                  <button 
                    className="image-select-btn"
                    onClick={() => document.getElementById('topImageInput')?.click()}
                  >
                    선택
                  </button>
                </div>
              </div>
              
                {/* 하단이미지 */}
                <div className="image-section">
                <h3 className="image-section-title">하단이미지</h3>
                <div className="image-upload-box">
                  {bottomImagePreview ? (
                    <img 
                      src={bottomImagePreview} 
                      alt="하단이미지" 
                      className="image-preview"
                      onClick={() => handleImageZoom(bottomImagePreview)}
                    />
                  ) : (
                    <div className="image-placeholder">
                      <div className="placeholder-icon">📷</div>
                      <div className="placeholder-text">이미지 선택</div>
                      <div className="placeholder-format">(JPG, PNG)</div>
                    </div>
                  )}
                  <input
                    type="file"
                    id="bottomImageInput"
                    accept="image/jpeg,image/jpg,image/png"
                    style={{ display: 'none' }}
                    onChange={(e) => handleImageSelect('bottom', e)}
                  />
                  <button 
                    className="image-select-btn"
                    onClick={() => document.getElementById('bottomImageInput')?.click()}
                  >
                    선택
                  </button>
                </div>
                </div>
              </div>
            </div>
            
            <div className="detail-image-modal-footer">
              <button className="modal-btn cancel-btn" onClick={handleDetailImageCancel}>
                취소
              </button>
              <button className="modal-btn save-btn" onClick={handleDetailImageSave}>
                저장
              </button>
            </div>
          </div>
        </div>
      )}
      
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

export default UserManagementPage
