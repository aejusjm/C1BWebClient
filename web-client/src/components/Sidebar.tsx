// 좌측 사이드바 컴포넌트 - 로고, 사용자 정보, 메뉴 네비게이션
import './Sidebar.css'

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

function Sidebar({ activeMenu, onMenuChange, onLogout, userInfo }: SidebarProps) {
  // 관리자 여부 확인
  const isAdmin = userInfo.userType === '관리자'

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
  return (
    <aside className="sidebar">
      {/* 로고 영역 */}
      <div className="logo-section" onClick={() => onMenuChange('dashboard')}>
        <img src="/c1b_logo.png" alt="C1B Logo" className="logo-image" />
      </div>

      {/* 사용자 정보 영역 */}
      <div className="user-info">
        <div 
          className="user-name" 
          onClick={() => onMenuChange('account')}
          style={{ cursor: 'pointer' }}
        >
          {userInfo.userName}({userInfo.userId})
        </div>
        <div className="user-date">
          만료일: {dateStr}
          {daysLeft !== null && (
            <span>
              {daysLeft > 0 ? ` (${daysLeft}일 남음)` : daysLeft === 0 ? ' (오늘 만료)' : ' (만료됨)'}
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
          <li 
            className={activeMenu === 'dashboard' ? 'active' : ''}
            onClick={() => onMenuChange('dashboard')}
          >
            <div className="menu-title">
              <span className="menu-icon">📊</span> 대시보드
            </div>
          </li>
          <li 
            className={activeMenu === 'orders' ? 'active' : ''}
            onClick={() => onMenuChange('orders')}
          >
            <div className="menu-title">
              <span className="menu-icon">🛒</span> 주문관리
            </div>
          </li>
          <li 
            className={activeMenu === 'products' ? 'active' : ''}
            onClick={() => onMenuChange('products')}
          >
            <div className="menu-title">
              <span className="menu-icon">📦</span> 상품관리
            </div>
          </li>
          <li 
            className={activeMenu === 'order-sales-stats' ? 'active' : ''}
            onClick={() => onMenuChange('order-sales-stats')}
          >
            <div className="menu-title">
              <span className="menu-icon">💰</span> 매출통계
            </div>
          </li>
          <li 
            className={activeMenu === 'notices' ? 'active' : ''}
            onClick={() => onMenuChange('notices')}
          >
            <div className="menu-title">
              <span className="menu-icon">📢</span> 공지사항
            </div>
          </li>
          <li className="menu-parent">
            <div className="menu-title">
              <span className="menu-icon">⚙️</span> 설정
            </div>
            <ul className="submenu">
              <li 
                className={activeMenu === 'account' ? 'active' : ''}
                onClick={() => onMenuChange('account')}
              >
                <span className="submenu-icon">👤</span> 계정관리
              </li>
              <li 
                className={activeMenu === 'basic' ? 'active' : ''}
                onClick={() => onMenuChange('basic')}
              >
                <span className="submenu-icon">📋</span> 기본정보
              </li>
              <li 
                className={activeMenu === 'market' ? 'active' : ''}
                onClick={() => onMenuChange('market')}
              >
                <span className="submenu-icon">🔗</span> 마켓연동
              </li>
            </ul>
          </li>
          {/* 관리자 메뉴 - 관리자만 표시 */}
          {isAdmin && (
            <li className="menu-parent">
              <div className="menu-title">
                <span className="menu-icon">👨‍💼</span> 관리자메뉴
              </div>
              <ul className="submenu">
                <li 
                  className={activeMenu === 'standard-info' ? 'active' : ''}
                  onClick={() => onMenuChange('standard-info')}
                >
                  <span className="submenu-icon">📊</span> 기준정보관리
                </li>
                <li 
                  className={activeMenu === 'user-management' ? 'active' : ''}
                  onClick={() => onMenuChange('user-management')}
                >
                  <span className="submenu-icon">👥</span> 사용자관리
                </li>
                <li 
                  className={activeMenu === 'notice-management' ? 'active' : ''}
                  onClick={() => onMenuChange('notice-management')}
                >
                  <span className="submenu-icon">📢</span> 공지관리
                </li>
                <li 
                  className={activeMenu === 'detail-page-management' ? 'active' : ''}
                  onClick={() => onMenuChange('detail-page-management')}
                >
                  <span className="submenu-icon">📄</span> 상세페이지관리
                </li>
                <li 
                  className={activeMenu === 'deleted-products' ? 'active' : ''}
                  onClick={() => onMenuChange('deleted-products')}
                >
                  <span className="submenu-icon">🗑️</span> 삭제상품관리
                </li>
                <li 
                  className={activeMenu === 'batch-log' ? 'active' : ''}
                  onClick={() => onMenuChange('batch-log')}
                >
                  <span className="submenu-icon">📋</span> 배치로그관리
                </li>
                <li 
                  className={activeMenu === 'server-management' ? 'active' : ''}
                  onClick={() => onMenuChange('server-management')}
                >
                  <span className="submenu-icon">🖥️</span> 서버관리
                </li>
              </ul>
            </li>
          )}
          {/* 관리자통계관리 메뉴 - 관리자만 표시 */}
          {isAdmin && (
            <li className="menu-parent">
              <div className="menu-title">
                <span className="menu-icon">📈</span> 관리자통계관리
              </div>
              <ul className="submenu">
                <li 
                  className={activeMenu === 'user-sales-stats' ? 'active' : ''}
                  onClick={() => onMenuChange('user-sales-stats')}
                >
                  <span className="submenu-icon">💰</span> 사용자별 매출
                </li>
                <li 
                  className={activeMenu === 'upload-product-stats' ? 'active' : ''}
                  onClick={() => onMenuChange('upload-product-stats')}
                >
                  <span className="submenu-icon">📦</span> 상품등록 현황
                </li>
              </ul>
            </li>
          )}
        </ul>
      </nav>

      {/* 이미지 공지 및 이벤트 섹션 */}
      <div className="sidebar-footer">
        <button className="subscribe-btn" onClick={() => onMenuChange('subscription-plan')}>
          <span className="subscribe-icon">🧾</span>
          구독 플랜 확인
        </button>
      </div>
    </aside>
  )
}

export default Sidebar
