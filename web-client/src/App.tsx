// 메인 애플리케이션 컴포넌트 - 대시보드 레이아웃과 전체 구조를 관리
import { useState, useEffect } from 'react'
import './App.css'
import LoginPage from './components/LoginPage'
import Sidebar from './components/Sidebar'
import Dashboard from './components/Dashboard'
import NoticePage from './components/NoticePage'
import ProductPage from './components/ProductPage'
import OrderPage from './components/OrderPage'
import AccountPage from './components/AccountPage'
import BasicInfoPage from './components/BasicInfoPage'
import MarketPage from './components/MarketPage'
import StandardInfoPage from './components/StandardInfoPage'
import UserManagementPage from './components/UserManagementPage'
import NoticeManagementPage from './components/NoticeManagementPage'
import DetailPageManagement from './components/DetailPageManagement'
import NoWordManagementPage from './components/NoWordManagementPage'
import UserSalesStatsPage from './components/UserSalesStatsPage'
import DailySalesStatsPage from './components/DailySalesStatsPage'
import SubscriptionPlanPage from './components/SubscriptionPlanPage'
import ServerManagementPage from './components/ServerManagementPage'
import DeleteProductManagementPage from './components/DeleteProductManagementPage'
import BatchLogManagementPage from './components/BatchLogManagementPage'
import { UserProvider } from './contexts/UserContext'
import { FilterProvider } from './contexts/FilterContext'
import { AlertProvider } from './contexts/AlertContext'

interface UserInfo {
  userId: string
  userName: string
  userType: string
  endDate: string | null
}

function App() {
  // 로그인 상태 관리
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [userInfo, setUserInfo] = useState<UserInfo>({
    userId: '',
    userName: '',
    userType: '',
    endDate: null
  })
  
  // 현재 활성화된 메뉴 상태 관리
  const [activeMenu, setActiveMenu] = useState('dashboard')

  // 컴포넌트 마운트 시 로그인 상태 확인
  useEffect(() => {
    const savedUserInfo = localStorage.getItem('userInfo')
    if (savedUserInfo) {
      const parsedUserInfo = JSON.parse(savedUserInfo)
      setIsLoggedIn(true)
      setUserInfo(parsedUserInfo)
    }
  }, [])

  // 로그인 처리
  const handleLogin = (userId: string, userName: string, userType: string, endDate: string | null) => {
    const newUserInfo: UserInfo = {
      userId,
      userName,
      userType,
      endDate
    }
    setIsLoggedIn(true)
    setUserInfo(newUserInfo)
    localStorage.setItem('userInfo', JSON.stringify(newUserInfo))
  }

  // 로그아웃 처리
  const handleLogout = () => {
    setIsLoggedIn(false)
    setUserInfo({
      userId: '',
      userName: '',
      userType: '',
      endDate: null
    })
    localStorage.removeItem('userInfo')
    setActiveMenu('dashboard')
  }

  // 로그인하지 않은 경우 로그인 페이지 표시
  if (!isLoggedIn) {
    return (
      <AlertProvider>
        <LoginPage onLogin={handleLogin} />
      </AlertProvider>
    )
  }

  return (
    <AlertProvider>
      <UserProvider userInfo={userInfo} setUserInfo={setUserInfo}>
        <FilterProvider>
          <div className="app-container">
            {/* 좌측 사이드바 - 로고, 사용자 정보, 메뉴 */}
            <Sidebar 
              activeMenu={activeMenu} 
              onMenuChange={setActiveMenu}
              onLogout={handleLogout}
              userInfo={userInfo}
            />
            
            {/* 메인 콘텐츠 영역 */}
            <main className="main-content">
              {activeMenu === 'dashboard' && <Dashboard onNavigate={setActiveMenu} />}
              {activeMenu === 'products' && <ProductPage />}
              {activeMenu === 'orders' && <OrderPage />}
              {activeMenu === 'order-sales-stats' && <DailySalesStatsPage />}
              {activeMenu === 'account' && <AccountPage />}
              {activeMenu === 'basic' && <BasicInfoPage />}
              {activeMenu === 'market' && <MarketPage />}
              {activeMenu === 'notices' && <NoticePage />}
              {activeMenu === 'standard-info' && <StandardInfoPage />}
              {activeMenu === 'user-management' && <UserManagementPage onNavigate={setActiveMenu} />}
              {activeMenu === 'notice-management' && <NoticeManagementPage />}
              {activeMenu === 'deleted-products' && <DeleteProductManagementPage />}
              {activeMenu === 'detail-page-management' && <DetailPageManagement />}
              {activeMenu === 'banned-words' && <NoWordManagementPage />}
              {activeMenu === 'batch-log' && <BatchLogManagementPage />}
              {activeMenu === 'server-management' && <ServerManagementPage />}
              {activeMenu === 'user-sales-stats' && <UserSalesStatsPage />}
              {activeMenu === 'subscription-plan' && <SubscriptionPlanPage />}
            </main>
          </div>
        </FilterProvider>
      </UserProvider>
    </AlertProvider>
  )
}

export default App
