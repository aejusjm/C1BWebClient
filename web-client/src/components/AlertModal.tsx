// 공통 Alert 모달 컴포넌트 - 전역적으로 사용되는 알림/확인 모달
import { useEffect } from 'react'
import './AlertModal.css'

interface AlertModalProps {
  isOpen: boolean
  type: 'alert' | 'confirm'
  title?: string
  message: string
  onConfirm: () => void
  onCancel?: () => void
}

function AlertModal({ isOpen, type, title, message, onConfirm, onCancel }: AlertModalProps) {
  // ESC 키로 모달 닫기
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        if (type === 'confirm' && onCancel) {
          onCancel()
        } else {
          onConfirm()
        }
      }
    }
    
    if (isOpen) {
      document.addEventListener('keydown', handleEsc)
      // 모달이 열릴 때 body 스크롤 방지
      document.body.style.overflow = 'hidden'
    }
    
    return () => {
      document.removeEventListener('keydown', handleEsc)
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, type, onConfirm, onCancel])

  if (!isOpen) return null

  return (
    <div className="alert-modal-overlay">
      <div className="alert-modal-container">
        {/* 아이콘 영역 */}
        <div className={`alert-modal-icon ${type === 'confirm' ? 'confirm-icon' : 'alert-icon'}`}>
          {type === 'confirm' ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v4m0 4h.01" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
        </div>

        {/* 제목 */}
        {title && <h3 className="alert-modal-title">{title}</h3>}

        {/* 메시지 */}
        <div className="alert-modal-message">
          {message.split('\n').map((line, index) => (
            <p key={index}>{line}</p>
          ))}
        </div>

        {/* 버튼 영역 */}
        <div className="alert-modal-buttons">
          {type === 'confirm' ? (
            <>
              <button 
                className="alert-modal-btn cancel-btn"
                onClick={onCancel}
              >
                취소
              </button>
              <button 
                className="alert-modal-btn confirm-btn"
                onClick={onConfirm}
                autoFocus
              >
                확인
              </button>
            </>
          ) : (
            <button 
              className="alert-modal-btn confirm-btn"
              onClick={onConfirm}
              autoFocus
            >
              확인
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default AlertModal
