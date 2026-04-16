// 계정관리 페이지 컴포넌트 - 사용자 계정 정보 관리
import { useState, useEffect } from 'react'
import { useUser } from '../contexts/UserContext'
import { useAlert } from '../contexts/AlertContext'
import './AccountPage.css'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'
const API_URL = `${API_BASE}/api/users`

function AccountPage() {
  const { userInfo } = useUser()
  const { showAlert } = useAlert()
  const [loading, setLoading] = useState(false)
  
  // 계정 정보 상태 관리
  const [accountInfo, setAccountInfo] = useState({
    userId: '',
    name: '',
    email: '',
    password: '',
    phone: '',
    endDate: ''
  })

  // 컴포넌트 마운트 시 사용자 정보 로드
  useEffect(() => {
    loadUserInfo()
  }, [])

  // 사용자 정보 조회
  const loadUserInfo = async () => {
    try {
      setLoading(true)
      const response = await fetch(`${API_URL}/${userInfo.userId}`)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const result = await response.json()
      
      if (result.success) {
        const user = result.data
        setAccountInfo({
          userId: user.user_id,
          name: user.user_name,
          email: user.user_email || '',
          password: user.user_pwd || '********', // 마스킹된 비밀번호 표시
          phone: user.user_phone || '',
          endDate: user.end_date ? new Date(user.end_date).toISOString().split('T')[0] : ''
        })
      }
    } catch (error) {
      console.error('사용자 정보 조회 오류:', error)
      await showAlert('사용자 정보를 불러오는 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  // 비밀번호 변경 모달 상태
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  })

  // 입력 필드 변경 핸들러
  const handleChange = (field: string, value: string | boolean) => {
    setAccountInfo({
      ...accountInfo,
      [field]: value
    })
  }

  // 비밀번호 변경 버튼 클릭 핸들러
  const handlePasswordChange = () => {
    setShowPasswordModal(true)
  }

  // 비밀번호 모달 닫기
  const closePasswordModal = () => {
    setShowPasswordModal(false)
    setPasswordData({
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    })
  }

  // 비밀번호 저장
  const handlePasswordSave = async () => {
    if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
      await showAlert('모든 필드를 입력해주세요.')
      return
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      await showAlert('새 비밀번호가 일치하지 않습니다.')
      return
    }

    try {
      setLoading(true)
      
      // 비밀번호 전용 API 사용 (비밀번호만 변경)
      const response = await fetch(`${API_URL}/${accountInfo.userId}/password`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          current_password: passwordData.currentPassword,
          new_password: passwordData.newPassword
        })
      })
      
      const result = await response.json()
      
      if (result.success) {
        await showAlert('비밀번호가 변경되었습니다.')
        closePasswordModal()
      } else {
        await showAlert(result.message || '비밀번호 변경 중 오류가 발생했습니다.')
      }
    } catch (error) {
      console.error('비밀번호 변경 오류:', error)
      await showAlert('비밀번호 변경 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  // 계정 정보 저장 (이름, 이메일, 휴대번호)
  const handleSave = async () => {
    try {
      setLoading(true)
      
      // 기본정보 수정 전용 API 사용
      const response = await fetch(`${API_URL}/${accountInfo.userId}/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          user_name: accountInfo.name,
          user_email: accountInfo.email,
          user_phone: accountInfo.phone
        })
      })
      
      const result = await response.json()
      
      if (result.success) {
        await showAlert('계정 정보가 저장되었습니다.')
        loadUserInfo()
      } else {
        await showAlert(result.message || '저장 중 오류가 발생했습니다.')
      }
    } catch (error) {
      console.error('계정 정보 저장 오류:', error)
      await showAlert('저장 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="account-page">
      {/* 페이지 헤더 */}
      <div className="account-page-header">
        <h1 className="page-title">👤 계정관리</h1>
      </div>

      {/* 계정정보 폼 */}
      <div className="account-form-container">
        <h2 className="form-title">계정정보</h2>
        
        {loading ? (
          <div className="loading-message">정보를 불러오는 중...</div>
        ) : (
          <>
            <div className="account-form">
              {/* 아이디 (읽기전용) */}
              <div className="form-row">
                <label className="form-label">아이디</label>
                <input
                  type="text"
                  className="form-input"
                  value={accountInfo.userId}
                  disabled
                  readOnly
                />
              </div>

              {/* 이름 */}
              <div className="form-row">
                <label className="form-label">이름</label>
                <input
                  type="text"
                  className="form-input"
                  value={accountInfo.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  placeholder="이름을 입력하세요"
                />
              </div>

              {/* 이메일 */}
              <div className="form-row">
                <label className="form-label">이메일</label>
                <input
                  type="email"
                  className="form-input"
                  value={accountInfo.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                  placeholder="이메일을 입력하세요"
                />
              </div>

              {/* 비밀번호 */}
              <div className="form-row">
                <label className="form-label">비밀번호</label>
                <div className="password-input-group">
                  <input
                    type="password"
                    className="form-input password-input"
                    value="********"
                    disabled
                    readOnly
                  />
                  <button 
                    className="password-change-btn"
                    onClick={handlePasswordChange}
                  >
                    변경
                  </button>
                </div>
              </div>

              {/* 휴대번호 */}
              <div className="form-row">
                <label className="form-label">휴대번호</label>
                <input
                  type="tel"
                  className="form-input"
                  value={accountInfo.phone}
                  onChange={(e) => handleChange('phone', e.target.value)}
                  placeholder="전화번호를 입력하세요"
                />
              </div>

              {/* 종료일자 (읽기전용) */}
              <div className="form-row">
                <label className="form-label">종료일자</label>
                <input
                  type="date"
                  className="form-input"
                  value={accountInfo.endDate}
                  disabled
                  readOnly
                />
              </div>
            </div>

            {/* 저장 버튼 */}
            <div className="form-actions">
              <button 
                className="save-account-btn"
                onClick={handleSave}
                disabled={loading}
              >
                {loading ? '저장 중...' : '저장'}
              </button>
            </div>
          </>
        )}
      </div>

      {/* 비밀번호 변경 모달 */}
      {showPasswordModal && (
        <div className="password-modal-overlay">
          <div className="password-modal-content">
            <div className="password-modal-header">
              <h3 className="password-modal-title">비밀번호 변경</h3>
              <button 
                className="password-modal-close"
                onClick={closePasswordModal}
              >
                ✕
              </button>
            </div>

            <div className="password-modal-body">
              {/* 현재 비밀번호 */}
              <div className="modal-form-group">
                <label className="modal-label">현재 비밀번호</label>
                <input
                  type="password"
                  className="modal-input"
                  value={passwordData.currentPassword}
                  onChange={(e) => setPasswordData({...passwordData, currentPassword: e.target.value})}
                  placeholder="현재 비밀번호를 입력하세요"
                />
              </div>

              {/* 새 비밀번호 */}
              <div className="modal-form-group">
                <label className="modal-label">새 비밀번호</label>
                <input
                  type="password"
                  className="modal-input"
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData({...passwordData, newPassword: e.target.value})}
                  placeholder="새 비밀번호를 입력하세요"
                />
              </div>

              {/* 새 비밀번호 확인 */}
              <div className="modal-form-group">
                <label className="modal-label">새 비밀번호 확인</label>
                <input
                  type="password"
                  className="modal-input"
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData({...passwordData, confirmPassword: e.target.value})}
                  placeholder="새 비밀번호를 다시 입력하세요"
                />
              </div>
            </div>

            <div className="password-modal-footer">
              <button 
                className="modal-btn cancel-btn"
                onClick={closePasswordModal}
              >
                취소
              </button>
              <button 
                className="modal-btn save-btn"
                onClick={handlePasswordSave}
              >
                저장
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AccountPage
