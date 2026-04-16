// 로그인 페이지 컴포넌트
import { useState, useEffect } from 'react'
import './LoginPage.css'
import { useAlert } from '../contexts/AlertContext'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'

interface LoginPageProps {
  onLogin: (userId: string, userName: string, userType: string, endDate: string | null) => void
}

function LoginPage({ onLogin }: LoginPageProps) {
  const { showAlert } = useAlert()
  const [loginData, setLoginData] = useState({
    userId: '',
    password: ''
  })
  const [rememberMe, setRememberMe] = useState(false)
  const [loading, setLoading] = useState(false)
  const [showExpiredModal, setShowExpiredModal] = useState(false)

  // 컴포넌트 마운트 시 저장된 로그인 정보 불러오기
  useEffect(() => {
    const savedUserId = localStorage.getItem('savedUserId')
    const savedPassword = localStorage.getItem('savedPassword')
    const savedRememberMe = localStorage.getItem('rememberMe') === 'true'

    if (savedRememberMe && savedUserId && savedPassword) {
      setLoginData({
        userId: savedUserId,
        password: savedPassword
      })
      setRememberMe(true)
    }
  }, [])

  // 입력 필드 변경 핸들러
  const handleChange = (field: string, value: string) => {
    setLoginData({
      ...loginData,
      [field]: value
    })
  }

  // Enter 키 로그인
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleLogin()
    }
  }

  // 로그인 처리
  const handleLogin = async () => {
    if (!loginData.userId || !loginData.password) {
      await showAlert('아이디와 비밀번호를 입력해주세요.')
      return
    }

    try {
      setLoading(true)
      
      // 로그인 API 호출 (서버에서 비밀번호 검증)
      const response = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: loginData.userId,
          password: loginData.password
        })
      })
      
      const result = await response.json()
      
      if (!response.ok) {
        await showAlert(result.message || '로그인에 실패했습니다.')
        return
      }
      
      if (result.success) {
        const user = result.data
        
        // 종료일자 확인
        if (user.end_date) {
          const endDate = new Date(user.end_date)
          const today = new Date()
          today.setHours(0, 0, 0, 0)
          endDate.setHours(0, 0, 0, 0)
          
          if (endDate < today) {
            setShowExpiredModal(true)
            return
          }
        }
        
        // 로그인 정보 저장 또는 삭제
        if (rememberMe) {
          localStorage.setItem('savedUserId', loginData.userId)
          localStorage.setItem('savedPassword', loginData.password)
          localStorage.setItem('rememberMe', 'true')
        } else {
          localStorage.removeItem('savedUserId')
          localStorage.removeItem('savedPassword')
          localStorage.removeItem('rememberMe')
        }
        
        // 로그인 성공
        onLogin(user.user_id, user.user_name, user.user_type, user.end_date)
      } else {
        await showAlert(result.message || '로그인에 실패했습니다.')
      }
    } catch (error) {
      console.error('로그인 오류:', error)
      await showAlert('로그인 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-header">
          <div className="login-logo-wrapper">
            <div className="login-logo">
              <img src="/c1b_logo.png" alt="C1B Logo" className="login-logo-image" />
            </div>
            <div className="logo-text-wrapper">
              <h1 className="login-title">
                <span className="title-main">C1B</span>
                <span className="title-divider">|</span>
                <span className="title-sub">Click One Button</span>
              </h1>
            </div>
          </div>
          <p className="login-subtitle">로그인</p>
        </div>

        <div className="login-form">
          {/* 아이디 */}
          <div className="login-field">
            <label className="login-label">아이디</label>
            <input
              type="text"
              className="login-input"
              value={loginData.userId}
              onChange={(e) => handleChange('userId', e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="아이디를 입력하세요"
              autoFocus
            />
          </div>

          {/* 비밀번호 */}
          <div className="login-field">
            <label className="login-label">비밀번호</label>
            <input
              type="password"
              className="login-input"
              value={loginData.password}
              onChange={(e) => handleChange('password', e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="비밀번호를 입력하세요"
            />
          </div>

          {/* 로그인 정보 저장 체크박스 */}
          <div className="login-remember">
            <label className="remember-label">
              <input
                type="checkbox"
                className="remember-checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
              <span className="remember-text">로그인 정보 저장</span>
            </label>
          </div>

          {/* 로그인 버튼 */}
          <button
            className="login-btn"
            onClick={handleLogin}
            disabled={loading}
          >
            {loading ? '로그인 중...' : '로그인'}
          </button>
        </div>

        <div className="login-footer">
          <p className="login-info">© 2026 C1B. All rights reserved.</p>
        </div>
      </div>

      {/* 사용기한 만료 모달 */}
      {showExpiredModal && (
        <div className="expired-modal-overlay">
          <div className="expired-modal-content">
            <div className="expired-modal-icon">⚠️</div>
            <h3 className="expired-modal-title">사용기한 만료</h3>
            <p className="expired-modal-message">
              사용기한이 지났습니다.<br />
              계속 사용을 하시려면,<br />
              관리자에게 문의하여 주세요.
            </p>
            <button 
              className="expired-modal-btn"
              onClick={() => {
                setShowExpiredModal(false)
                setLoginData({ userId: '', password: '' })
              }}
            >
              확인
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default LoginPage
