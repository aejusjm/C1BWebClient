// 통관번호 입력 페이지 (외부 접근용 - 로그인 불필요)
import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import './PcccInputPage.css'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'
const API_URL = `${API_BASE}/api/pccc-input`

interface OrderInfo {
  store_name: string
  product_name: string
  opt_info: string
  order_id: string
  ordrr_name: string
  ordrr_tel: string
}

interface ValidationError {
  title: string
  message: string
}

function PcccInputPage() {
  const [searchParams] = useSearchParams()
  const pcccGuid = searchParams.get('pccc_guid')
  
  const [orderInfo, setOrderInfo] = useState<OrderInfo | null>(null)
  const [pccc, setPccc] = useState('')
  const [ordrrName, setOrdrrName] = useState('')
  const [ordrrTel, setOrdrrTel] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [validationError, setValidationError] = useState<ValidationError | null>(null)

  // 주문 정보 로드
  useEffect(() => {
    if (!pcccGuid) {
      setError('유효하지 않은 링크입니다.')
      setLoading(false)
      return
    }
    
    loadOrderInfo()
  }, [pcccGuid])

  // 주문 정보 조회
  const loadOrderInfo = async () => {
    try {
      setLoading(true)
      const response = await fetch(`${API_URL}/order-info/${pcccGuid}`)
      const result = await response.json()
      
      if (result.success) {
        setOrderInfo(result.data)
        setOrdrrName(result.data.ordrr_name || '')
        setOrdrrTel(result.data.ordrr_tel || '')
      } else {
        setError(result.message || '주문 정보를 불러올 수 없습니다.')
      }
    } catch (error) {
      console.error('주문 정보 로드 오류:', error)
      setError('주문 정보를 불러오는 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  // 통관번호 검증 API 호출 (백엔드를 통한 프록시)
  const validatePccc = async (): Promise<{ valid: boolean; error?: ValidationError }> => {
    try {
      const response = await fetch(`${API_URL}/validate-pccc`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          pccc: pccc.trim(),
          ordrr_name: ordrrName.trim(),
          ordrr_tel: ordrrTel.trim()
        })
      })
      
      const result = await response.json()
      
      if (!result.success) {
        return {
          valid: false,
          error: {
            title: '검증 오류',
            message: result.message || '통관번호 검증 중 오류가 발생했습니다.'
          }
        }
      }
      
      if (result.valid) {
        return { valid: true }
      } else {
        return {
          valid: false,
          error: result.error
        }
      }
    } catch (error) {
      console.error('통관번호 검증 오류:', error)
      return {
        valid: false,
        error: {
          title: '검증 오류',
          message: '통관번호 검증 중 오류가 발생했습니다.'
        }
      }
    }
  }

  // 통관번호 저장
  const handleSubmit = async () => {
    if (!pccc || pccc.trim() === '') {
      setValidationError({
        title: '입력 오류',
        message: '통관번호를 입력해주세요.'
      })
      return
    }

    if (!ordrrName || ordrrName.trim() === '') {
      setValidationError({
        title: '입력 오류',
        message: '이름을 입력해주세요.'
      })
      return
    }

    if (!ordrrTel || ordrrTel.trim() === '') {
      setValidationError({
        title: '입력 오류',
        message: '전화번호를 입력해주세요.'
      })
      return
    }

    if (!orderInfo) {
      setError('주문 정보가 없습니다.')
      return
    }

    try {
      setLoading(true)
      
      // 1. 통관번호 검증
      const validationResult = await validatePccc()
      
      if (!validationResult.valid) {
        setValidationError(validationResult.error!)
        setLoading(false)
        return
      }
      
      // 2. 검증 성공 시 저장
      const response = await fetch(`${API_URL}/save-pccc`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          order_id: orderInfo.order_id,
          pccc: pccc.trim()
        })
      })
      
      const result = await response.json()
      
      if (result.success) {
        setSuccess(true)
      } else {
        setError(result.message || '통관번호 저장에 실패했습니다.')
      }
    } catch (error) {
      console.error('통관번호 저장 오류:', error)
      setError('통관번호 저장 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  if (loading && !orderInfo) {
    return (
      <div className="pccc-input-container">
        <div className="pccc-loading">
          <div className="spinner"></div>
          <p>주문 정보를 불러오는 중...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="pccc-input-container">
        <div className="pccc-error">
          <div className="error-icon">⚠️</div>
          <h2>오류</h2>
          <p>{error}</p>
        </div>
      </div>
    )
  }

  if (success) {
    return (
      <div className="pccc-input-container">
        <div className="pccc-success">
          <div className="success-icon">✓</div>
          <h2>저장 완료</h2>
          <p>통관번호가 성공적으로 저장되었습니다.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="pccc-input-container">
      <div className="pccc-card">
        <h1 className="pccc-title">통관번호입력</h1>
        
        {orderInfo && (
          <div className="pccc-form">
            <div className="pccc-form-group">
              <label className="pccc-form-label">주문상품명</label>
              <div className="pccc-form-value">{orderInfo.product_name}</div>
            </div>
            
            <div className="pccc-form-group">
              <label className="pccc-form-label">선택옵션명</label>
              <div className="pccc-form-value">{orderInfo.opt_info || '-'}</div>
            </div>
            
            <div className="pccc-form-group">
              <label className="pccc-form-label">이름</label>
              <div className="pccc-input-wrapper">
                <input
                  type="text"
                  className="pccc-form-input-simple pccc-editable-input"
                  value={ordrrName}
                  onChange={(e) => setOrdrrName(e.target.value)}
                  placeholder="이름을 입력하세요"
                  disabled={loading}
                />
                <span className="pccc-edit-icon">✏️</span>
              </div>
            </div>
            
            <div className="pccc-form-group">
              <label className="pccc-form-label">전화번호</label>
              <div className="pccc-input-wrapper">
                <input
                  type="text"
                  className="pccc-form-input-simple pccc-editable-input"
                  value={ordrrTel}
                  onChange={(e) => setOrdrrTel(e.target.value)}
                  placeholder="전화번호를 입력하세요"
                  disabled={loading}
                />
                <span className="pccc-edit-icon">✏️</span>
              </div>
            </div>
            
            <div className="pccc-form-group">
              <label className="pccc-form-label">통관번호</label>
              <input
                type="text"
                className="pccc-form-input"
                value={pccc}
                onChange={(e) => setPccc(e.target.value)}
                placeholder="통관번호를 입력하세요"
                disabled={loading}
              />
            </div>
            
            <button 
              className="submit-btn"
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading ? '검증 중...' : '저장'}
            </button>
          </div>
        )}
      </div>
      
      {/* 검증 오류 모달 */}
      {validationError && (
        <div className="pccc-modal-overlay" onClick={() => setValidationError(null)}>
          <div className="pccc-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="pccc-modal-icon">⚠️</div>
            <h2 className="pccc-modal-title">{validationError.title}</h2>
            <p className="pccc-modal-message">{validationError.message}</p>
            <button 
              className="pccc-modal-btn"
              onClick={() => setValidationError(null)}
            >
              확인
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default PcccInputPage
