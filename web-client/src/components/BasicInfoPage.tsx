// 기본정보 페이지 컴포넌트 - 상단/하단 이미지 선택 및 관리
import { useState, useEffect } from 'react'
import { useUser } from '../contexts/UserContext'
import { useAlert } from '../contexts/AlertContext'
import './BasicInfoPage.css'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'
const API_URL = `${API_BASE}/api/basic-info`

interface DetailImage {
  seq: number
  img_type: string
  img_url: string
}

function BasicInfoPage() {
  const { userInfo } = useUser()
  const { showAlert } = useAlert()
  
  // 상단 이미지 목록
  const [topImages, setTopImages] = useState<DetailImage[]>([])
  // 하단 이미지 목록
  const [bottomImages, setBottomImages] = useState<DetailImage[]>([])
  
  // 선택된 이미지 seq
  const [selectedTopImageSeq, setSelectedTopImageSeq] = useState<number | null>(null)
  const [selectedBottomImageSeq, setSelectedBottomImageSeq] = useState<number | null>(null)
  
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  
  // 사업정보 상태
  const [businessInfo, setBusinessInfo] = useState({
    csPhone: '',
    bizHours: '',
    dispatchLocation: '',
    returnLocation: ''
  })
  
  // 이미지 확대 모달
  const [showImageModal, setShowImageModal] = useState(false)
  const [modalImageUrl, setModalImageUrl] = useState<string | null>(null)

  // 이미지 프록시를 통한 안전한 URL 생성
  const getSafeImageUrl = (url: string | null): string | null => {
    if (!url) return null
    
    // 로컬 경로인 경우 (상대 경로 또는 /uploads로 시작)
    if (url.startsWith('/') || url.startsWith('./') || url.startsWith('../')) {
      return `${API_BASE}${url}`
    }
    
    // 외부 URL인 경우 프록시 사용
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return `${API_BASE}/api/image/proxy?url=${encodeURIComponent(url)}`
    }
    
    return url
  }

  // 컴포넌트 마운트 시 데이터 로드
  useEffect(() => {
    if (userInfo?.userId) {
      loadData()
    }
  }, [userInfo?.userId])

  // 데이터 로드 (이미지 목록 먼저, 그 다음 사용자 선택 이미지 및 사업정보)
  const loadData = async () => {
    try {
      setLoading(true)
      await loadDetailImages()
      await loadUserImages()
      await loadBusinessInfo()
    } finally {
      setLoading(false)
    }
  }

  // 상세페이지 이미지 목록 로드
  const loadDetailImages = async () => {
    try {
      const response = await fetch(`${API_URL}/detail-images`)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const result = await response.json()
      console.log('이미지 목록 로드:', result.data)
      
      if (result.success) {
        const topImgs = result.data.filter((img: DetailImage) => img.img_type === '상단')
        const bottomImgs = result.data.filter((img: DetailImage) => img.img_type === '하단')
        
        console.log('상단 이미지:', topImgs)
        console.log('상단 이미지 seq 목록:', topImgs.map((img: DetailImage) => img.seq))
        console.log('하단 이미지:', bottomImgs)
        console.log('하단 이미지 seq 목록:', bottomImgs.map((img: DetailImage) => img.seq))
        
        setTopImages(topImgs)
        setBottomImages(bottomImgs)
      }
    } catch (error) {
      console.error('이미지 목록 로드 오류:', error)
      await showAlert('이미지 목록을 불러오는 중 오류가 발생했습니다.')
    }
  }

  // 사용자 선택 이미지 로드 (tb_user_detail에서 seq 조회)
  const loadUserImages = async () => {
    try {
      const response = await fetch(`${API_URL}/user-images/${userInfo.userId}`)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const result = await response.json()
      console.log('사용자 이미지 데이터:', result.data)
      
      if (result.success && result.data) {
        // 문자열을 숫자로 변환하여 저장
        const topImg = result.data.top_img ? Number(result.data.top_img) : null
        const bottomImg = result.data.bottom_img ? Number(result.data.bottom_img) : null
        
        console.log('========================================')
        console.log('📌 선택된 상단 이미지 seq:', topImg, '(타입:', typeof topImg, ')')
        console.log('📌 선택된 하단 이미지 seq:', bottomImg, '(타입:', typeof bottomImg, ')')
        console.log('========================================')
        
        setSelectedTopImageSeq(topImg)
        setSelectedBottomImageSeq(bottomImg)
      }
    } catch (error) {
      console.error('사용자 이미지 로드 오류:', error)
    }
  }

  // 이미지 확대 모달 열기
  const openImageModal = (imageUrl: string) => {
    setModalImageUrl(imageUrl)
    setShowImageModal(true)
  }

  // 이미지 확대 모달 닫기
  const closeImageModal = () => {
    setShowImageModal(false)
    setModalImageUrl(null)
  }

  // 사업정보 로드
  const loadBusinessInfo = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/users/${userInfo.userId}`)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const result = await response.json()
      
      if (result.success) {
        const user = result.data
        setBusinessInfo({
          csPhone: user.cs_phone || '',
          bizHours: user.biz_hours || '',
          dispatchLocation: user.dispatch_Location || '',
          returnLocation: user.rturn_location || ''
        })
      }
    } catch (error) {
      console.error('사업정보 조회 오류:', error)
      await showAlert('사업정보를 불러오는 중 오류가 발생했습니다.')
    }
  }

  // 사업정보 입력 핸들러
  const handleBusinessInfoChange = (field: string, value: string | boolean) => {
    setBusinessInfo({
      ...businessInfo,
      [field]: value
    })
  }

  // 통합 저장 버튼 클릭 핸들러 (사업정보 + 상세페이지 이미지)
  const handleSave = async () => {
    if (!selectedTopImageSeq || !selectedBottomImageSeq) {
      await showAlert('상단 이미지와 하단 이미지를 모두 선택해주세요.')
      return
    }

    try {
      setSaving(true)
      
      // 1. 사업정보 저장 (기본정보 전용 API)
      const businessResponse = await fetch(`${API_BASE}/api/users/${userInfo.userId}/basic-info`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          cs_phone: businessInfo.csPhone,
          biz_hours: businessInfo.bizHours,
          dispatch_location: businessInfo.dispatchLocation,
          rturn_location: businessInfo.returnLocation
        })
      })
      
      const businessResult = await businessResponse.json()
      
      if (!businessResult.success) {
        await showAlert(businessResult.message || '사업정보 저장 중 오류가 발생했습니다.')
        return
      }
      
      // 2. 상세페이지 이미지 저장
      const imageResponse = await fetch(`${API_URL}/user-images/${userInfo.userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          top_img: selectedTopImageSeq,
          bottom_img: selectedBottomImageSeq
        })
      })
      
      const imageResult = await imageResponse.json()
      
      if (imageResult.success) {
        await showAlert('저장되었습니다.')
        await loadBusinessInfo()
        await loadUserImages()
      } else {
        await showAlert(imageResult.message || '상세페이지 이미지 저장 중 오류가 발생했습니다.')
      }
    } catch (error) {
      console.error('저장 오류:', error)
      await showAlert('저장 중 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="basic-info-page">
        <div className="basic-info-page-header">
          <h1 className="page-title">📋 기본정보</h1>
        </div>
        <div style={{ textAlign: 'center', padding: '40px' }}>
          데이터를 불러오는 중입니다...
        </div>
      </div>
    )
  }

  return (
    <div className="basic-info-page">
      {/* 페이지 헤더 */}
      <div className="basic-info-page-header">
        <h1 className="page-title">📋 기본정보</h1>
      </div>

      {/* 기본정보 컨테이너 */}
      <div className="basic-info-container">
        {/* 사업정보 섹션 */}
        <h2 className="container-title">사업정보</h2>
        <div className="business-info-section">
          {/* 고객센터 */}
          <div className="form-row">
            <label className="form-label">고객센터</label>
            <input
              type="text"
              className="form-input"
              value={businessInfo.csPhone}
              onChange={(e) => handleBusinessInfoChange('csPhone', e.target.value)}
              placeholder="010-1234-5678"
            />
          </div>

          {/* 영업시간 */}
          <div className="form-row">
            <label className="form-label">영업시간</label>
            <input
              type="text"
              className="form-input"
              value={businessInfo.bizHours}
              onChange={(e) => handleBusinessInfoChange('bizHours', e.target.value)}
              placeholder="오전 9시 ~ 오후 6시"
            />
          </div>

          {/* 출고지 */}
          <div className="form-row">
            <label className="form-label">출고지</label>
            <input
              type="text"
              className="form-input"
              value={businessInfo.dispatchLocation}
              onChange={(e) => handleBusinessInfoChange('dispatchLocation', e.target.value)}
              placeholder="출고지 입력"
            />
          </div>

          {/* 반품지 */}
          <div className="form-row">
            <label className="form-label">반품지</label>
            <input
              type="text"
              className="form-input"
              value={businessInfo.returnLocation}
              onChange={(e) => handleBusinessInfoChange('returnLocation', e.target.value)}
              placeholder="반품지 입력"
            />
          </div>
        </div>

        {/* 상세페이지 섹션 */}
        <h2 className="container-title" style={{ marginTop: '40px' }}>상세페이지</h2>
        <div className="detail-page-section">

          {/* 상단이미지 선택 */}
          <div className="image-selection-group">
            <div className="selection-header">
              <span className="selection-label">상단이미지 선택</span>
            </div>
            {topImages.length === 0 ? (
              <div className="no-images-message">
                등록된 상단 이미지가 없습니다. 상세페이지관리에서 이미지를 먼저 업로드해주세요.
              </div>
            ) : (
              <div className="image-grid">
                {topImages.map((image) => (
                  <div 
                    key={image.seq} 
                    className={`image-card ${selectedTopImageSeq === image.seq ? 'selected' : ''}`}
                  >
                    <div 
                      className="image-preview"
                      onClick={() => setSelectedTopImageSeq(image.seq)}
                    >
                      <img src={getSafeImageUrl(image.img_url) || ''} alt={`상단이미지 ${image.seq}`} />
                      <button 
                        className="image-zoom-btn"
                        onClick={(e) => {
                          e.stopPropagation()
                          openImageModal(getSafeImageUrl(image.img_url) || '')
                        }}
                        title="이미지 확대"
                      >
                        🔍
                      </button>
                    </div>
                    <label className="radio-label">
                      <input
                        type="radio"
                        name="topImage"
                        checked={selectedTopImageSeq === image.seq}
                        onChange={() => setSelectedTopImageSeq(image.seq)}
                      />
                      <span className="radio-circle"></span>
                    </label>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 하단이미지 선택 */}
          <div className="image-selection-group">
            <div className="selection-header">
              <span className="selection-label">하단이미지 선택</span>
            </div>
            {bottomImages.length === 0 ? (
              <div className="no-images-message">
                등록된 하단 이미지가 없습니다. 상세페이지관리에서 이미지를 먼저 업로드해주세요.
              </div>
            ) : (
              <div className="image-grid">
                {bottomImages.map((image) => (
                  <div 
                    key={image.seq} 
                    className={`image-card ${selectedBottomImageSeq === image.seq ? 'selected' : ''}`}
                  >
                    <div 
                      className="image-preview"
                      onClick={() => setSelectedBottomImageSeq(image.seq)}
                    >
                      <img src={getSafeImageUrl(image.img_url) || ''} alt={`하단이미지 ${image.seq}`} />
                      <button 
                        className="image-zoom-btn"
                        onClick={(e) => {
                          e.stopPropagation()
                          openImageModal(getSafeImageUrl(image.img_url) || '')
                        }}
                        title="이미지 확대"
                      >
                        🔍
                      </button>
                    </div>
                    <label className="radio-label">
                      <input
                        type="radio"
                        name="bottomImage"
                        checked={selectedBottomImageSeq === image.seq}
                        onChange={() => setSelectedBottomImageSeq(image.seq)}
                      />
                      <span className="radio-circle"></span>
                    </label>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* 통합 저장 버튼 */}
        <div className="save-button-container" style={{ marginTop: '24px' }}>
          <button 
            className="save-btn" 
            onClick={handleSave}
            disabled={saving || !selectedTopImageSeq || !selectedBottomImageSeq}
          >
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>

      {/* 이미지 확대 모달 */}
      {showImageModal && modalImageUrl && (
        <div className="image-modal-overlay">
          <div className="image-modal-content">
            <button className="image-modal-close" onClick={closeImageModal}>✕</button>
            <img src={modalImageUrl} alt="확대 이미지" className="image-modal-img" />
          </div>
        </div>
      )}
    </div>
  )
}

export default BasicInfoPage
