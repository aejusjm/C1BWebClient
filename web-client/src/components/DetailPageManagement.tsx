// 상세페이지관리 컴포넌트 - 상단/하단 이미지 업로드 관리
import { useState, useEffect } from 'react'
// import { useUser } from '../contexts/UserContext' // 현재 미사용
import { useAlert } from '../contexts/AlertContext'
import './DetailPageManagement.css'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'
const API_URL = `${API_BASE}/api/detail-page`

interface ImageSlot {
  id: number
  seq: number | null
  url: string | null
  fileName: string | null
}

function DetailPageManagement() {
  // const { userInfo } = useUser() // 현재 미사용
  const { showAlert, showConfirm } = useAlert()
  
  // 상단 이미지 7개
  const [topImages, setTopImages] = useState<ImageSlot[]>(
    Array.from({ length: 7 }, (_, i) => ({ id: i + 1, seq: null, url: null, fileName: null }))
  )

  // 하단 이미지 7개
  const [bottomImages, setBottomImages] = useState<ImageSlot[]>(
    Array.from({ length: 7 }, (_, i) => ({ id: i + 1, seq: null, url: null, fileName: null }))
  )

  const [uploading, setUploading] = useState(false)
  const [loading, setLoading] = useState(false)

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

  // 컴포넌트 마운트 시 기존 이미지 로드
  useEffect(() => {
    loadImages()
  }, [])

  // 기존 이미지 로드
  const loadImages = async () => {
    try {
      setLoading(true)
      const response = await fetch(`${API_URL}/images`)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const result = await response.json()
      
      if (result.success && result.data.length > 0) {
        const topData = result.data.filter((img: any) => img.img_type === '상단')
        const bottomData = result.data.filter((img: any) => img.img_type === '하단')
        
        // 상단 이미지 매핑
        const newTopImages = [...topImages]
        topData.forEach((img: any, index: number) => {
          if (index < 7) {
            newTopImages[index] = {
              id: index + 1,
              seq: img.seq,
              url: img.img_url,
              fileName: img.img_local_path ? img.img_local_path.split('\\').pop() : null
            }
          }
        })
        setTopImages(newTopImages)
        
        // 하단 이미지 매핑
        const newBottomImages = [...bottomImages]
        bottomData.forEach((img: any, index: number) => {
          if (index < 7) {
            newBottomImages[index] = {
              id: index + 1,
              seq: img.seq,
              url: img.img_url,
              fileName: img.img_local_path ? img.img_local_path.split('\\').pop() : null
            }
          }
        })
        setBottomImages(newBottomImages)
      }
    } catch (error) {
      console.error('이미지 로드 오류:', error)
    } finally {
      setLoading(false)
    }
  }

  // 이미지 업로드 핸들러
  const handleImageUpload = async (
    file: File,
    type: 'top' | 'bottom',
    index: number,
    seq: number | null
  ) => {
    try {
      setUploading(true)

      const formData = new FormData()
      formData.append('image', file)
      formData.append('imgType', type === 'top' ? '상단' : '하단')
      if (seq) {
        formData.append('seq', seq.toString())
      }

      const response = await fetch(`${API_URL}/upload`, {
        method: 'POST',
        body: formData
      })

      const result = await response.json()

      if (result.success) {
        if (type === 'top') {
          const newImages = [...topImages]
          newImages[index] = {
            ...newImages[index],
            seq: result.seq,
            url: result.fileUrl,
            fileName: result.fileName
          }
          setTopImages(newImages)
        } else {
          const newImages = [...bottomImages]
          newImages[index] = {
            ...newImages[index],
            seq: result.seq,
            url: result.fileUrl,
            fileName: result.fileName
          }
          setBottomImages(newImages)
        }

        await showAlert(seq ? '이미지가 수정되었습니다.' : '이미지가 업로드되었습니다.')
      } else {
        await showAlert(result.message || '이미지 업로드에 실패했습니다.')
      }
    } catch (error) {
      console.error('이미지 업로드 오류:', error)
      await showAlert('이미지 업로드 중 오류가 발생했습니다.')
    } finally {
      setUploading(false)
    }
  }

  // 이미지 삭제 핸들러
  const handleImageDelete = async (
    type: 'top' | 'bottom',
    index: number,
    seq: number | null
  ) => {
    if (!seq) return

    const confirmed = await showConfirm('이미지를 삭제하시겠습니까?')
    if (!confirmed) return

    try {
      const response = await fetch(`${API_URL}/delete/${seq}`, {
        method: 'DELETE'
      })

      const result = await response.json()

      if (result.success) {
        if (type === 'top') {
          const newImages = [...topImages]
          newImages[index] = {
            ...newImages[index],
            seq: null,
            url: null,
            fileName: null
          }
          setTopImages(newImages)
        } else {
          const newImages = [...bottomImages]
          newImages[index] = {
            ...newImages[index],
            seq: null,
            url: null,
            fileName: null
          }
          setBottomImages(newImages)
        }

        await showAlert('이미지가 삭제되었습니다.')
      } else {
        await showAlert(result.message || '이미지 삭제에 실패했습니다.')
      }
    } catch (error) {
      console.error('이미지 삭제 오류:', error)
      await showAlert('이미지 삭제 중 오류가 발생했습니다.')
    }
  }

  // 파일 선택 핸들러
  const handleFileSelect = async (
    e: React.ChangeEvent<HTMLInputElement>,
    type: 'top' | 'bottom',
    index: number,
    seq: number | null
  ) => {
    const file = e.target.files?.[0]
    if (file) {
      // JPG, PNG 파일만 허용
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png']
      if (!allowedTypes.includes(file.type)) {
        await showAlert('JPG, PNG 파일만 업로드 가능합니다.')
        e.target.value = '' // 파일 선택 초기화
        return
      }
      
      // 파일 크기 검증 (5MB)
      if (file.size > 5 * 1024 * 1024) {
        await showAlert('파일 크기는 5MB 이하여야 합니다.')
        e.target.value = '' // 파일 선택 초기화
        return
      }

      handleImageUpload(file, type, index, seq)
    }
  }

  // 이미지 슬롯 렌더링
  const renderImageSlot = (
    image: ImageSlot,
    type: 'top' | 'bottom',
    index: number
  ) => {
    return (
      <div key={image.id} className={`image-slot ${type === 'top' ? 'top-slot' : 'bottom-slot'}`}>
        {image.url ? (
          <div className="image-preview">
            <img src={getSafeImageUrl(image.url) || ''} alt={`${type} ${image.id}`} />
            <div className="image-overlay">
              <label className="change-btn">
                <input
                  type="file"
                  accept="image/jpeg,image/jpg,image/png"
                  onChange={(e) => handleFileSelect(e, type, index, image.seq)}
                  disabled={uploading}
                  style={{ display: 'none' }}
                />
                🔄 변경
              </label>
              <button
                className="delete-btn"
                onClick={() => handleImageDelete(type, index, image.seq)}
                disabled={uploading}
              >
                🗑️ 삭제
              </button>
            </div>
          </div>
        ) : (
          <label className="upload-label">
            <input
              type="file"
              accept="image/jpeg,image/jpg,image/png"
              onChange={(e) => handleFileSelect(e, type, index, image.seq)}
              disabled={uploading}
              style={{ display: 'none' }}
            />
            <div className="upload-placeholder">
              <span className="upload-icon">📷</span>
              <span className="upload-text">이미지 선택</span>
              <span className="upload-hint">(JPG, PNG)</span>
            </div>
          </label>
        )}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="detail-page-management">
        <div className="standard-info-page-header">
          <h1 className="page-title">📄 상세페이지관리</h1>
        </div>
        <div style={{ textAlign: 'center', padding: '40px' }}>
          데이터를 불러오는 중입니다...
        </div>
      </div>
    )
  }

  return (
    <div className="detail-page-management">
      {/* 페이지 헤더 */}
      <div className="standard-info-page-header">
        <h1 className="page-title">📄 상세페이지관리</h1>
      </div>

      {/* 상단 이미지 섹션 */}
      <div className="image-section">
        <h2 className="section-title">
          <span className="section-icon">⬆️</span>
          상단이미지 선택
        </h2>
        <div className="image-grid">
          {topImages.map((image, index) =>
            renderImageSlot(image, 'top', index)
          )}
        </div>
      </div>

      {/* 하단 이미지 섹션 */}
      <div className="image-section">
        <h2 className="section-title">
          <span className="section-icon">⬇️</span>
          하단이미지 선택
        </h2>
        <div className="image-grid">
          {bottomImages.map((image, index) =>
            renderImageSlot(image, 'bottom', index)
          )}
        </div>
      </div>

      {/* 업로드 중 표시 */}
      {uploading && (
        <div className="uploading-overlay">
          <div className="uploading-message">
            <div className="spinner"></div>
            <p>이미지 업로드 중...</p>
          </div>
        </div>
      )}
    </div>
  )
}

export default DetailPageManagement
