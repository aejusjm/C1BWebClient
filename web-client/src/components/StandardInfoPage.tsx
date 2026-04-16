// 기준정보관리 페이지 컴포넌트 - 할율 및 수수료 정보 관리
import { useState, useEffect } from 'react'
import { useAlert } from '../contexts/AlertContext'
import './StandardInfoPage.css'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'
const API_URL = `${API_BASE}/api/standard-info`

function StandardInfoPage() {
  const { showAlert } = useAlert()
  
  // 기준정보 상태 관리
  const [standardInfo, setStandardInfo] = useState({
    rate: '',
    smartStoreFee: '',
    coupangFee: '',
    smartStoreDiscount: '',
    coupangDiscount: ''
  })
  const [loading, setLoading] = useState(false)

  // 컴포넌트 마운트 시 데이터 로드
  useEffect(() => {
    loadStandardInfo()
  }, [])

  // 기준정보 조회
  const loadStandardInfo = async () => {
    try {
      setLoading(true)
      const response = await fetch(API_URL)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const result = await response.json()
      
      if (result.success && result.data) {
        setStandardInfo(result.data)
      }
    } catch (error) {
      console.error('기준정보 조회 오류:', error)
      
      // 더 자세한 오류 메시지
      if (error instanceof TypeError && error.message.includes('fetch')) {
        await showAlert('백엔드 서버에 연결할 수 없습니다.\n\n백엔드 서버가 실행 중인지 확인해주세요.\n(http://localhost:3001)')
      } else {
        await showAlert(`기준정보를 불러오는 중 오류가 발생했습니다.\n\n오류: ${error instanceof Error ? error.message : String(error)}`)
      }
    } finally {
      setLoading(false)
    }
  }

  // 입력 필드 변경 핸들러
  const handleChange = (field: string, value: string) => {
    setStandardInfo({
      ...standardInfo,
      [field]: value
    })
  }

  // 저장 버튼 클릭 핸들러
  const handleSave = async () => {
    try {
      setLoading(true)
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(standardInfo)
      })
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const result = await response.json()
      
      if (result.success) {
        await showAlert('저장되었습니다.')
        loadStandardInfo() // 저장 후 데이터 다시 로드
      } else {
        await showAlert(result.message || '저장 중 오류가 발생했습니다.')
      }
    } catch (error) {
      console.error('기준정보 저장 오류:', error)
      
      if (error instanceof TypeError && error.message.includes('fetch')) {
        await showAlert('백엔드 서버에 연결할 수 없습니다.\n\n백엔드 서버가 실행 중인지 확인해주세요.\n(http://localhost:3001)')
      } else {
        await showAlert(`저장 중 오류가 발생했습니다.\n\n오류: ${error instanceof Error ? error.message : String(error)}`)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="standard-info-page">
      {/* 페이지 헤더 */}
      <div className="standard-info-page-header">
        <h1 className="page-title">📊 기준정보관리</h1>
      </div>

      {/* 기준정보 폼 */}
      <div className="standard-info-form-container">
        <h2 className="form-title">기준정보관리</h2>
        
        <div className="standard-info-form">
          {/* 할율 */}
          <div className="form-row">
            <label className="form-label">할율 :</label>
            <input
              type="text"
              className="form-input"
              value={standardInfo.rate}
              onChange={(e) => handleChange('rate', e.target.value)}
              placeholder="할율을 입력하세요"
            />
          </div>

          {/* 스마트스토어 수수료 */}
          <div className="form-row">
            <label className="form-label">스마트스토어 수수료 :</label>
            <input
              type="text"
              className="form-input"
              value={standardInfo.smartStoreFee}
              onChange={(e) => handleChange('smartStoreFee', e.target.value)}
              placeholder="스마트스토어 수수료를 입력하세요"
            />
          </div>

          {/* 쿠팡 수수료 */}
          <div className="form-row">
            <label className="form-label">쿠팡 수수료 :</label>
            <input
              type="text"
              className="form-input"
              value={standardInfo.coupangFee}
              onChange={(e) => handleChange('coupangFee', e.target.value)}
              placeholder="쿠팡 수수료를 입력하세요"
            />
          </div>

          {/* 스마트스토어 할인율 */}
          <div className="form-row">
            <label className="form-label">스마트스토어 할인율 :</label>
            <input
              type="text"
              className="form-input"
              value={standardInfo.smartStoreDiscount}
              onChange={(e) => handleChange('smartStoreDiscount', e.target.value)}
              placeholder="스마트스토어 할인율을 입력하세요"
            />
          </div>

          {/* 쿠팡 할인율 */}
          <div className="form-row">
            <label className="form-label">쿠팡 할인율 :</label>
            <input
              type="text"
              className="form-input"
              value={standardInfo.coupangDiscount}
              onChange={(e) => handleChange('coupangDiscount', e.target.value)}
              placeholder="쿠팡 할인율을 입력하세요"
            />
          </div>

          {/* 저장 버튼 */}
          <div className="save-button-container">
            <button 
              className="save-btn" 
              onClick={handleSave}
              disabled={loading}
            >
              {loading ? '처리 중...' : '저장'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default StandardInfoPage
