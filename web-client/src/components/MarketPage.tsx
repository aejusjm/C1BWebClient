// 마켓연동 페이지 컴포넌트 - 스마트스토어 및 쿠팡 연동 정보 관리
import { useState, useEffect } from 'react'
import { useUser } from '../contexts/UserContext'
import { useAlert } from '../contexts/AlertContext'
import './MarketPage.css'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'
const API_URL = `${API_BASE}/api/market`

interface StoreInfo {
  biz_idx: number
  storeName: string
  id: string
  password: string
  storeId: string
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

function MarketPage() {
  const { userInfo } = useUser()
  const { showAlert } = useAlert()
  const [loading, setLoading] = useState(false)
  
  // 탭 상태 관리
  const [activeTab, setActiveTab] = useState<'smartstore' | 'coupang'>('smartstore')

  // 스마트스토어 정보 상태 (3개)
  const [smartStores, setSmartStores] = useState<StoreInfo[]>([
    { biz_idx: 1, storeName: '', id: '', password: '', storeId: '', appId: '', appSecret: '', useYn: 'Y' },
    { biz_idx: 2, storeName: '', id: '', password: '', storeId: '', appId: '', appSecret: '', useYn: 'Y' },
    { biz_idx: 3, storeName: '', id: '', password: '', storeId: '', appId: '', appSecret: '', useYn: 'Y' }
  ])

  // 쿠팡 정보 상태 (3개)
  const [coupangStores, setCoupangStores] = useState<CoupangInfo[]>([
    { biz_idx: 1, storeName: '', accountId: '', password: '', vendorCode: '', accessKey: '', secretKey: '', useYn: 'Y' },
    { biz_idx: 2, storeName: '', accountId: '', password: '', vendorCode: '', accessKey: '', secretKey: '', useYn: 'Y' },
    { biz_idx: 3, storeName: '', accountId: '', password: '', vendorCode: '', accessKey: '', secretKey: '', useYn: 'Y' }
  ])

  // 컴포넌트 마운트 시 데이터 로드
  useEffect(() => {
    loadSmartStores()
    loadCoupangStores()
  }, [])

  // 스마트스토어 목록 조회
  const loadSmartStores = async () => {
    try {
      setLoading(true)
      const response = await fetch(`${API_URL}/smartstore/${userInfo.userId}`)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const result = await response.json()
      
      if (result.success && result.data.length > 0) {
        const loadedStores = [1, 2, 3].map(idx => {
          const found = result.data.find((s: any) => s.biz_idx === idx)
          return found ? {
            biz_idx: found.biz_idx,
            storeName: found.store_name || '',
            id: found.account_id || '',
            password: found.user_pwd || '',
            storeId: found.store_id || '',
            appId: found.client_id || '',
            appSecret: found.client_secret_sign || '',
            useYn: found.use_yn || 'Y',
            isNew: false
          } : {
            biz_idx: idx,
            storeName: '',
            id: '',
            password: '',
            storeId: '',
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
    } finally {
      setLoading(false)
    }
  }

  // 쿠팡 목록 조회
  const loadCoupangStores = async () => {
    try {
      setLoading(true)
      const response = await fetch(`${API_URL}/coupang/${userInfo.userId}`)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const result = await response.json()
      
      if (result.success && result.data.length > 0) {
        const loadedStores = [1, 2, 3].map(idx => {
          const found = result.data.find((s: any) => s.biz_idx === idx)
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
    } finally {
      setLoading(false)
    }
  }

  // 스마트스토어 입력 변경 핸들러
  const handleSmartStoreChange = (index: number, field: keyof StoreInfo, value: string) => {
    const newStores = [...smartStores]
    newStores[index] = { ...newStores[index], [field]: value }
    setSmartStores(newStores)
  }

  // 쿠팡 입력 변경 핸들러
  const handleCoupangChange = (index: number, field: keyof CoupangInfo, value: string) => {
    const newStores = [...coupangStores]
    newStores[index] = { ...newStores[index], [field]: value }
    setCoupangStores(newStores)
  }

  // 스마트스토어 저장 핸들러
  const handleSmartStoreSave = async (index: number) => {
    const store = smartStores[index]
    
    // 필수 입력 검증 (순차적으로 체크)
    if (!store.storeName) {
      await showAlert('스토어명은 필수 입력 항목입니다.')
      document.getElementById(`ss-storeName-${index}`)?.focus()
      return
    }
    if (!store.id) {
      await showAlert('아이디는 필수 입력 항목입니다.')
      document.getElementById(`ss-id-${index}`)?.focus()
      return
    }
    if (!store.password) {
      await showAlert('비밀번호는 필수 입력 항목입니다.')
      document.getElementById(`ss-password-${index}`)?.focus()
      return
    }
    
    try {
      setLoading(true)
      const response = await fetch(`${API_URL}/smartstore/${userInfo.userId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          biz_idx: store.biz_idx,
          store_name: store.storeName,
          account_id: store.id,
          user_pwd: store.password,
          store_id: store.storeId,
          client_id: store.appId,
          client_secret_sign: store.appSecret,
          use_yn: store.useYn
        })
      })
      
      const result = await response.json()
      
      if (result.success) {
        await showAlert('스마트스토어 정보가 저장되었습니다.')
        loadSmartStores()
      } else {
        await showAlert(result.message || '저장 중 오류가 발생했습니다.')
      }
    } catch (error) {
      console.error('스마트스토어 저장 오류:', error)
      await showAlert('저장 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  // 쿠팡 저장 핸들러
  const handleCoupangSave = async (index: number) => {
    const store = coupangStores[index]
    
    // 필수 입력 검증 (순차적으로 체크)
    if (!store.storeName) {
      await showAlert('스토어명은 필수 입력 항목입니다.')
      document.getElementById(`cp-storeName-${index}`)?.focus()
      return
    }
    if (!store.accountId) {
      await showAlert('쿠팡 ID는 필수 입력 항목입니다.')
      document.getElementById(`cp-accountId-${index}`)?.focus()
      return
    }
    if (!store.password) {
      await showAlert('비밀번호는 필수 입력 항목입니다.')
      document.getElementById(`cp-password-${index}`)?.focus()
      return
    }
    
    try {
      setLoading(true)
      const response = await fetch(`${API_URL}/coupang/${userInfo.userId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
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
        loadCoupangStores()
      } else {
        await showAlert(result.message || '저장 중 오류가 발생했습니다.')
      }
    } catch (error) {
      console.error('쿠팡 저장 오류:', error)
      await showAlert('저장 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="market-page">
        <div className="market-page-header">
          <h1 className="page-title">🔗 마켓연동</h1>
        </div>
        <div style={{ textAlign: 'center', padding: '40px' }}>
          데이터를 불러오는 중입니다...
        </div>
      </div>
    )
  }

  return (
    <div className="market-page">
      {/* 페이지 헤더 */}
      <div className="market-page-header">
        <h1 className="page-title">🔗 마켓연동</h1>
      </div>

      {/* 마켓연동 컨테이너 */}
      <div className="market-container">
        <h2 className="container-title">마켓연동</h2>

        {/* 탭 메뉴 */}
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

        {/* 스마트스토어 섹션 */}
        {activeTab === 'smartstore' && (
          <div className="market-section">
            <h3 className="section-title">스마트스토어 연동 정보</h3>
            <p className="required-note">※ 필수 입력: 스토어명, 아이디, 비밀번호</p>
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
                  <label className="field-label required">스토어명</label>
                  <input
                    id={`ss-storeName-${index}`}
                    type="text"
                    className="field-input"
                    value={store.storeName}
                    onChange={(e) => handleSmartStoreChange(index, 'storeName', e.target.value)}
                    placeholder="스토어명 입력"
                  />
                </div>
                <div className="form-group">
                  <label className="field-label required">아이디</label>
                  <input
                    id={`ss-id-${index}`}
                    type="text"
                    className="field-input"
                    value={store.id}
                    onChange={(e) => handleSmartStoreChange(index, 'id', e.target.value)}
                    placeholder="아이디 입력"
                  />
                </div>
                <div className="form-group">
                  <label className="field-label required">비밀번호</label>
                  <input
                    id={`ss-password-${index}`}
                    type="password"
                    className="field-input"
                    value={store.password}
                    onChange={(e) => handleSmartStoreChange(index, 'password', e.target.value)}
                    placeholder="비밀번호 입력"
                  />
                </div>
                <div className="form-group">
                  <label className="field-label">스토어 ID</label>
                  <input
                    id={`ss-storeId-${index}`}
                    type="text"
                    className="field-input"
                    value={store.storeId}
                    onChange={(e) => handleSmartStoreChange(index, 'storeId', e.target.value)}
                    placeholder="스토어 ID 입력"
                    disabled
                  />
                </div>
                <div className="form-group">
                  <label className="field-label">APP ID</label>
                  <input
                    id={`ss-appId-${index}`}
                    type="text"
                    className="field-input"
                    value={store.appId}
                    onChange={(e) => handleSmartStoreChange(index, 'appId', e.target.value)}
                    placeholder="APP ID 입력"
                    disabled
                  />
                </div>
                <div className="form-group">
                  <label className="field-label">APP 시크릿</label>
                  <input
                    id={`ss-appSecret-${index}`}
                    type="text"
                    className="field-input"
                    value={store.appSecret}
                    onChange={(e) => handleSmartStoreChange(index, 'appSecret', e.target.value)}
                    placeholder="APP 시크릿 입력"
                    disabled
                  />
                </div>
                <div className="form-group">
                  <label className="field-label">사용여부</label>
                  <select
                    className="field-input"
                    value={store.useYn}
                    onChange={(e) => handleSmartStoreChange(index, 'useYn', e.target.value)}
                    disabled
                  >
                    <option value="Y">사용</option>
                    <option value="N">미사용</option>
                  </select>
                </div>
                <button 
                  className={`store-save-btn ${store.isNew ? 'new' : ''}`}
                  onClick={() => handleSmartStoreSave(index)}
                >
                  저장
                </button>
              </div>
            ))}
          </div>
        </div>
        )}

        {/* 쿠팡 섹션 */}
        {activeTab === 'coupang' && (
          <div className="market-section">
            <h3 className="section-title">쿠팡 연동 정보</h3>
            <p className="required-note">※ 필수 입력: 스토어명, 쿠팡ID, 비밀번호</p>
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
                    <label className="field-label required">스토어명</label>
                    <input
                      id={`cp-storeName-${index}`}
                      type="text"
                      className="field-input"
                      value={store.storeName}
                      onChange={(e) => handleCoupangChange(index, 'storeName', e.target.value)}
                      placeholder="스토어명 입력"
                    />
                  </div>
                  <div className="form-group">
                    <label className="field-label required">쿠팡ID</label>
                    <input
                      id={`cp-accountId-${index}`}
                      type="text"
                      className="field-input"
                      value={store.accountId}
                      onChange={(e) => handleCoupangChange(index, 'accountId', e.target.value)}
                      placeholder="쿠팡ID 입력"
                    />
                  </div>
                  <div className="form-group">
                    <label className="field-label required">비밀번호</label>
                    <input
                      id={`cp-password-${index}`}
                      type="password"
                      className="field-input"
                      value={store.password}
                      onChange={(e) => handleCoupangChange(index, 'password', e.target.value)}
                      placeholder="비밀번호 입력"
                    />
                  </div>
                  <div className="form-group">
                    <label className="field-label">업체코드</label>
                    <input
                      id={`cp-vendorCode-${index}`}
                      type="text"
                      className="field-input"
                      value={store.vendorCode}
                      onChange={(e) => handleCoupangChange(index, 'vendorCode', e.target.value)}
                      placeholder="업체코드 입력"
                      disabled
                    />
                  </div>
                  <div className="form-group">
                    <label className="field-label">Access Key</label>
                    <input
                      id={`cp-accessKey-${index}`}
                      type="text"
                      className="field-input"
                      value={store.accessKey}
                      onChange={(e) => handleCoupangChange(index, 'accessKey', e.target.value)}
                      placeholder="Access Key 입력"
                      disabled
                    />
                  </div>
                  <div className="form-group">
                    <label className="field-label">Secret Key</label>
                    <input
                      id={`cp-secretKey-${index}`}
                      type="text"
                      className="field-input"
                      value={store.secretKey}
                      onChange={(e) => handleCoupangChange(index, 'secretKey', e.target.value)}
                      placeholder="Secret Key 입력"
                      disabled
                    />
                  </div>
                  <div className="form-group">
                    <label className="field-label">사용여부</label>
                    <select
                      className="field-input"
                      value={store.useYn}
                      onChange={(e) => handleCoupangChange(index, 'useYn', e.target.value)}
                      disabled
                    >
                      <option value="Y">사용</option>
                      <option value="N">미사용</option>
                    </select>
                  </div>
                  <button 
                    className={`store-save-btn ${store.isNew ? 'new' : ''}`}
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
  )
}

export default MarketPage
