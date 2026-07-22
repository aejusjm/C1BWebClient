// 좌측 사이드바 컴포넌트 - 로고, 사용자 정보, 메뉴 네비게이션
import { useEffect, useState } from 'react'
import './Sidebar.css'
import { useAlert } from '../contexts/AlertContext'
import { isAdminMenu, isAdminUser } from '../constants/adminMenus'

interface UserInfo {
  userId: string
  userName: string
  userType: string
  endDate: string | null
}

interface SidebarProps {
  activeMenu: string
  onMenuChange: (menu: string) => void
  onLogout?: () => void
  userInfo: UserInfo
}

type CollapsibleMenuKey = 'admin' | 'allProducts' | 'stats' | 'payment' | 'fake' | 'settings'

const MENU_GROUP_ITEMS: Record<CollapsibleMenuKey, string[]> = {
  admin: [
    'standard-info',
    'user-management',
    'cohort-management',
    'notice-management',
    'detail-page-management',
    'batch-log',
    'server-management'
  ],
  allProducts: [
    'all-products',
    'upload-product-stats',
    'deleted-products'
  ],
  stats: [
    'user-sales-stats',
    'daily-sales-stats',
    'mobile-sales-stats'
  ],
  payment: [
    'subscription-management',
    'signup-payment-management',
    'subscription-settlement',
    'admin-direct-payment'
  ],
  fake: [
    'fake-purchase-user',
    'fake-purchase-info',
    'fake-purchase-product',
    'fake-purchase-schedule'
  ],
  settings: ['account', 'basic', 'market']
}

function getMenuGroup(menu: string): CollapsibleMenuKey | null {
  for (const [key, items] of Object.entries(MENU_GROUP_ITEMS) as [CollapsibleMenuKey, string[]][]) {
    if (items.includes(menu)) return key
  }
  return null
}

function Sidebar({ activeMenu, onMenuChange, onLogout, userInfo }: SidebarProps) {
  const { showAlert } = useAlert()
  
  // 관리자 여부 확인
  const isAdmin = isAdminUser(userInfo.userType)

  const [expandedMenus, setExpandedMenus] = useState<Record<CollapsibleMenuKey, boolean>>({
    admin: true,
    allProducts: true,
    stats: true,
    payment: true,
    fake: true,
    settings: true
  })

  // 활성 메뉴가 속한 그룹은 자동으로 펼침
  useEffect(() => {
    const group = getMenuGroup(activeMenu)
    if (!group) return
    setExpandedMenus((prev) => (prev[group] ? prev : { ...prev, [group]: true }))
  }, [activeMenu])

  const toggleMenu = (key: CollapsibleMenuKey) => {
    setExpandedMenus((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const handleMenuClick = (menu: string) => {
    if (isAdminMenu(menu) && !isAdmin) {
      void showAlert('관리자만 접근할 수 있는 메뉴입니다.')
      return
    }
    onMenuChange(menu)
  }

  // 만료일 포맷팅 및 남은 일수 계산
  const getExpiryInfo = () => {
    console.log('userInfo:', userInfo)
    console.log('endDate:', userInfo.endDate)
    
    if (!userInfo.endDate || userInfo.endDate === 'null' || userInfo.endDate === '') {
      return { dateStr: '미설정', daysLeft: null }
    }
    
    try {
      const endDate = new Date(userInfo.endDate)
      
      // 유효한 날짜인지 확인
      if (isNaN(endDate.getTime())) {
        return { dateStr: '미설정', daysLeft: null }
      }
      
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      endDate.setHours(0, 0, 0, 0)
      
      const diffTime = endDate.getTime() - today.getTime()
      const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
      
      const year = endDate.getFullYear()
      const month = String(endDate.getMonth() + 1).padStart(2, '0')
      const day = String(endDate.getDate()).padStart(2, '0')
      const dateStr = `${year}.${month}.${day}`
      
      return { dateStr, daysLeft }
    } catch (error) {
      console.error('날짜 파싱 오류:', error)
      return { dateStr: '미설정', daysLeft: null }
    }
  }

  const { dateStr, daysLeft } = getExpiryInfo()
  
  // 만료일 경고 클릭 핸들러
  const handleExpiryWarningClick = () => {
    if (daysLeft !== null) {
      showAlert(`사용기간이 ${daysLeft}일 남았습니다. 구독을 연장하세요`)
    }
  }
  
  return (
    <aside className="sidebar">
      {/* 로고 영역 */}
      <div className="logo-section" onClick={() => handleMenuClick('dashboard')}>
        <img src="/c1b_logo.png" alt="C1B Logo" className="logo-image" />
      </div>

      {/* 사용자 정보 영역 */}
      <div className="user-info">
        <div className="user-name" 
          onClick={() => handleMenuClick('account')}
          style={{ cursor: 'pointer' }}
        >
          {userInfo.userName}({userInfo.userId})
        </div>
        <div 
          className="user-date"
          style={{
            color: daysLeft !== null && daysLeft < 10 && daysLeft >= 0 ? '#ef5350' : '#666',
            fontWeight: daysLeft !== null && daysLeft < 10 && daysLeft >= 0 ? '600' : 'normal',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px'
          }}
        >
          <span>
            만료일: {dateStr}
            {daysLeft !== null && (
              <span>
                {daysLeft > 0 ? ` (${daysLeft}일 남음)` : daysLeft === 0 ? ' (오늘 만료)' : ' (만료됨)'}
              </span>
            )}
          </span>
          {daysLeft !== null && daysLeft < 10 && daysLeft >= 0 && (
            <span 
              className="expiry-warning-icon"
              onClick={handleExpiryWarningClick}
            >
              ⚠️
            </span>
          )}
        </div>
        {onLogout && (
          <button className="logout-btn" onClick={onLogout}>
            🚪 로그아웃
          </button>
        )}
      </div>

      {/* 메뉴 네비게이션 */}
      <nav className="menu-nav">
        <ul className="menu-list">
          {/* 일반 사용자 메뉴 - 관리자에게는 숨김 */}
          {!isAdmin && (
            <>
              <li 
                className={activeMenu === 'dashboard' ? 'active' : ''}
                onClick={() => handleMenuClick('dashboard')}
              >
                <div className="menu-title">
                  <span className="menu-icon">📊</span> 대시보드
                </div>
              </li>
              <li 
                className={activeMenu === 'orders' ? 'active' : ''}
                onClick={() => handleMenuClick('orders')}
              >
                <div className="menu-title">
                  <span className="menu-icon">🛒</span> 주문관리
                </div>
              </li>
              <li 
                className={activeMenu === 'products' ? 'active' : ''}
                onClick={() => handleMenuClick('products')}
              >
                <div className="menu-title">
                  <span className="menu-icon">📦</span> 상품관리
                </div>
              </li>
              <li 
                className={activeMenu === 'order-sales-stats' ? 'active' : ''}
                onClick={() => handleMenuClick('order-sales-stats')}
              >
                <div className="menu-title">
                  <span className="menu-icon">💰</span> 매출통계
                </div>
              </li>
              <li 
                className={activeMenu === 'notices' ? 'active' : ''}
                onClick={() => handleMenuClick('notices')}
              >
                <div className="menu-title">
                  <span className="menu-icon">📢</span> 공지사항
                </div>
              </li>
            </>
          )}
          {/* 설정 메뉴 - 관리자에게는 숨김 */}
          {!isAdmin && (
            <li className={`menu-parent ${expandedMenus.settings ? 'expanded' : 'collapsed'}`}>
              <div
                className="menu-title menu-title-toggle"
                onClick={() => toggleMenu('settings')}
              >
                <span className="menu-icon">⚙️</span> 설정
                <span className="menu-chevron">{expandedMenus.settings ? '▼' : '▶'}</span>
              </div>
              {expandedMenus.settings && (
              <ul className="submenu">
                <li 
                  className={activeMenu === 'account' ? 'active' : ''}
                  onClick={() => handleMenuClick('account')}
                >
                  <span className="submenu-icon">👤</span> 계정관리
                </li>
                <li 
                  className={activeMenu === 'basic' ? 'active' : ''}
                  onClick={() => handleMenuClick('basic')}
                >
                  <span className="submenu-icon">📋</span> 기본정보
                </li>
                <li 
                  className={activeMenu === 'market' ? 'active' : ''}
                  onClick={() => handleMenuClick('market')}
                >
                  <span className="submenu-icon">🔗</span> 마켓연동
                </li>
              </ul>
              )}
            </li>
          )}
          {/* 관리자 메뉴 - 관리자만 표시 */}
          {isAdmin && (
            <li className={`menu-parent ${expandedMenus.admin ? 'expanded' : 'collapsed'}`}>
              <div
                className="menu-title menu-title-toggle"
                onClick={() => toggleMenu('admin')}
              >
                <span className="menu-icon">👨‍💼</span> 관리자메뉴
                <span className="menu-chevron">{expandedMenus.admin ? '▼' : '▶'}</span>
              </div>
              {expandedMenus.admin && (
              <ul className="submenu">
                <li 
                  className={activeMenu === 'standard-info' ? 'active' : ''}
                  onClick={() => handleMenuClick('standard-info')}
                >
                  <span className="submenu-icon">📊</span> 기준정보관리
                </li>
                <li 
                  className={activeMenu === 'user-management' ? 'active' : ''}
                  onClick={() => handleMenuClick('user-management')}
                >
                  <span className="submenu-icon">👥</span> 사용자관리
                </li>
                <li 
                  className={activeMenu === 'cohort-management' ? 'active' : ''}
                  onClick={() => handleMenuClick('cohort-management')}
                >
                  <span className="submenu-icon">🎓</span> 기수관리
                </li>
                <li 
                  className={activeMenu === 'notice-management' ? 'active' : ''}
                  onClick={() => handleMenuClick('notice-management')}
                >
                  <span className="submenu-icon">📢</span> 공지관리
                </li>
                <li 
                  className={activeMenu === 'detail-page-management' ? 'active' : ''}
                  onClick={() => handleMenuClick('detail-page-management')}
                >
                  <span className="submenu-icon">📄</span> 상세페이지관리
                </li>
                <li 
                  className={activeMenu === 'batch-log' ? 'active' : ''}
                  onClick={() => handleMenuClick('batch-log')}
                >
                  <span className="submenu-icon">📋</span> 배치로그관리
                </li>
                <li 
                  className={activeMenu === 'server-management' ? 'active' : ''}
                  onClick={() => handleMenuClick('server-management')}
                >
                  <span className="submenu-icon">🖥️</span> 서버관리
                </li>
              </ul>
              )}
            </li>
          )}
          {/* 전체상품관리 메뉴 - 관리자만 표시 */}
          {isAdmin && (
            <li className={`menu-parent ${expandedMenus.allProducts ? 'expanded' : 'collapsed'}`}>
              <div
                className="menu-title menu-title-toggle"
                onClick={() => toggleMenu('allProducts')}
              >
                <span className="menu-icon">📦</span> 전체상품관리
                <span className="menu-chevron">{expandedMenus.allProducts ? '▼' : '▶'}</span>
              </div>
              {expandedMenus.allProducts && (
              <ul className="submenu">
                <li
                  className={activeMenu === 'all-products' ? 'active' : ''}
                  onClick={() => handleMenuClick('all-products')}
                >
                  <span className="submenu-icon">📦</span> 상품전체관리
                </li>
                <li
                  className={activeMenu === 'upload-product-stats' ? 'active' : ''}
                  onClick={() => handleMenuClick('upload-product-stats')}
                >
                  <span className="submenu-icon">📊</span> 상품등록 현황
                </li>
                <li 
                  className={activeMenu === 'deleted-products' ? 'active' : ''}
                  onClick={() => handleMenuClick('deleted-products')}
                >
                  <span className="submenu-icon">🗑️</span> 삭제상품관리
                </li>
              </ul>
              )}
            </li>
          )}
          {/* 통계통합관리 메뉴 - 관리자만 표시 */}
          {isAdmin && (
            <li className={`menu-parent ${expandedMenus.stats ? 'expanded' : 'collapsed'}`}>
              <div
                className="menu-title menu-title-toggle"
                onClick={() => toggleMenu('stats')}
              >
                <span className="menu-icon">📈</span> 통계통합관리
                <span className="menu-chevron">{expandedMenus.stats ? '▼' : '▶'}</span>
              </div>
              {expandedMenus.stats && (
              <ul className="submenu">
                <li 
                  className={activeMenu === 'user-sales-stats' ? 'active' : ''}
                  onClick={() => handleMenuClick('user-sales-stats')}
                >
                  <span className="submenu-icon">💰</span> 사용자별 매출
                </li>
                <li 
                  className={activeMenu === 'daily-sales-stats' ? 'active' : ''}
                  onClick={() => handleMenuClick('daily-sales-stats')}
                >
                  <span className="submenu-icon">📊</span> 사용자별 매출 추이
                </li>
                <li 
                  className={activeMenu === 'mobile-sales-stats' ? 'active' : ''}
                  onClick={() => handleMenuClick('mobile-sales-stats')}
                >
                  <span className="submenu-icon">📱</span> 사용자별 매출(모바일)
                </li>
              </ul>
              )}
            </li>
          )}
          {/* 구독 및 결제관리 메뉴 - 관리자만 표시 */}
          {isAdmin && (
            <li className={`menu-parent ${expandedMenus.payment ? 'expanded' : 'collapsed'}`}>
              <div
                className="menu-title menu-title-toggle"
                onClick={() => toggleMenu('payment')}
              >
                <span className="menu-icon">💳</span> 구독 및 결제관리
                <span className="menu-chevron">{expandedMenus.payment ? '▼' : '▶'}</span>
              </div>
              {expandedMenus.payment && (
              <ul className="submenu">
                <li
                  className={activeMenu === 'subscription-management' ? 'active' : ''}
                  onClick={() => handleMenuClick('subscription-management')}
                >
                  <span className="submenu-icon">🧾</span> 구독결제관리
                </li>
                <li
                  className={activeMenu === 'signup-payment-management' ? 'active' : ''}
                  onClick={() => handleMenuClick('signup-payment-management')}
                >
                  <span className="submenu-icon">📝</span> 가입신청내역
                </li>
                <li
                  className={activeMenu === 'subscription-settlement' ? 'active' : ''}
                  onClick={() => handleMenuClick('subscription-settlement')}
                >
                  <span className="submenu-icon submenu-icon-svg" aria-hidden="true">
                    <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor">
                      <path d="M7 2h10a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm0 2v4h10V4H7zm1 6v2h2v-2H8zm4 0v2h2v-2h-2zm4 0v2h2v-2h-2zM8 14v2h2v-2H8zm4 0v2h2v-2h-2zm4 0v2h2v-2h-2zM8 18v2h2v-2H8zm4 0v2h2v-2h-2zm4 0v2h2v-2h-2z" />
                    </svg>
                  </span>
                  구독료정산
                </li>
                <li
                  className={activeMenu === 'admin-direct-payment' ? 'active' : ''}
                  onClick={() => handleMenuClick('admin-direct-payment')}
                >
                  <span className="submenu-icon">🖊️</span> 관리자 직접 결제
                </li>
              </ul>
              )}
            </li>
          )}
          {/* 가구매관리 메뉴 - 관리자만 표시 */}
          {isAdmin && (
            <li className={`menu-parent ${expandedMenus.fake ? 'expanded' : 'collapsed'}`}>
              <div
                className="menu-title menu-title-toggle"
                onClick={() => toggleMenu('fake')}
              >
                <span className="menu-icon">🛍️</span> 가구매관리
                <span className="menu-chevron">{expandedMenus.fake ? '▼' : '▶'}</span>
              </div>
              {expandedMenus.fake && (
              <ul className="submenu">
                <li 
                  className={activeMenu === 'fake-purchase-user' ? 'active' : ''}
                  onClick={() => handleMenuClick('fake-purchase-user')}
                >
                  <span className="submenu-icon">👥</span> 가구매 사용자관리
                </li>
                <li 
                  className={activeMenu === 'fake-purchase-info' ? 'active' : ''}
                  onClick={() => handleMenuClick('fake-purchase-info')}
                >
                  <span className="submenu-icon">📋</span> 가구매 리스트
                </li>
                <li 
                  className={activeMenu === 'fake-purchase-product' ? 'active' : ''}
                  onClick={() => handleMenuClick('fake-purchase-product')}
                >
                  <span className="submenu-icon">🏷️</span> 가구매 상품관리
                </li>
                <li 
                  className={activeMenu === 'fake-purchase-schedule' ? 'active' : ''}
                  onClick={() => handleMenuClick('fake-purchase-schedule')}
                >
                  <span className="submenu-icon">📅</span> 가구매 일정관리
                </li>
              </ul>
              )}
            </li>
          )}
        </ul>
      </nav>

      {/* 이미지 공지 및 이벤트 섹션 */}
      <div className="sidebar-footer">
        <button className="subscribe-btn" onClick={() => handleMenuClick('subscription-plan')}>
          <span className="subscribe-icon">🧾</span>
          구독 플랜
        </button>
      </div>
    </aside>
  )
}

export default Sidebar
