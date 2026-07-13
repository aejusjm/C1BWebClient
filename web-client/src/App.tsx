// 메인 애플리케이션 컴포넌트 - 대시보드 레이아웃과 전체 구조를 관리
import { useState, useEffect, useCallback } from 'react'
import { useLocation } from 'react-router-dom'
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
import UploadProductStatsPage from './components/UploadProductStatsPage'
import DailySalesStatsPage from './components/DailySalesStatsPage'
import OrderSalesStatsPage from './components/OrderSalesStatsPage'
import SubscriptionPlanPage from './components/SubscriptionPlanPage'
import SubscriptionManagementPage from './components/SubscriptionManagementPage'
import SignupPaymentManagementPage from './components/SignupPaymentManagementPage'
import AdminDirectPaymentPage from './components/AdminDirectPaymentPage'
import SignupPaymentPage from './components/SignupPaymentPage'
import ServerManagementPage from './components/ServerManagementPage'
import DeleteProductManagementPage from './components/DeleteProductManagementPage'
import BatchLogManagementPage from './components/BatchLogManagementPage'
import FakePurchaseUserPage from './components/FakePurchaseUserPage'
import FakePurchaseProductPage from './components/FakePurchaseProductPage'
import FakePurchaseSchedulePage from './components/FakePurchaseSchedulePage'
import FakePurchaseInfoPage from './components/FakePurchaseInfoPage'
import SimpleMobileSalesPage from './components/SimpleMobileSalesPage'
import { UserProvider } from './contexts/UserContext'
import { FilterProvider } from './contexts/FilterContext'
import { AlertProvider, useAlert } from './contexts/AlertContext'
import { isAdminMenu, isAdminUser } from './constants/adminMenus'

interface UserInfo {
  userId: string
  userName: string
  userType: string
  endDate: string | null
}

const ADMIN_DENIED_MESSAGE = '관리자만 접근할 수 있는 메뉴입니다.'

function AuthenticatedApp({
  userInfo,
  setUserInfo,
  onLogout,
  activeMenu,
  setActiveMenu
}: {
  userInfo: UserInfo
  setUserInfo: React.Dispatch<React.SetStateAction<UserInfo>>
  onLogout: () => void
  activeMenu: string
  setActiveMenu: React.Dispatch<React.SetStateAction<string>>
}) {
  const { showAlert } = useAlert()
  const location = useLocation()

  const handleMenuChange = useCallback(
    (menu: string) => {
      if (isAdminMenu(menu) && !isAdminUser(userInfo.userType)) {
        void showAlert(ADMIN_DENIED_MESSAGE)
        return
      }
      setActiveMenu(menu)
    },
    [userInfo.userType, showAlert, setActiveMenu]
  )

  // 관리자 메뉴 접근 시마다 사용자종류 검사
  useEffect(() => {
    if (!isAdminMenu(activeMenu)) return
    if (isAdminUser(userInfo.userType)) return

    void showAlert(ADMIN_DENIED_MESSAGE)
    setActiveMenu('dashboard')
  }, [activeMenu, userInfo.userType, showAlert, setActiveMenu])

  // URL /UploadProductStats 로 진입 시 메뉴 동기화
  useEffect(() => {
    const p = location.pathname.replace(/\/$/, '') || '/'
    if (p === '/UploadProductStats' || p.toLowerCase() === '/uploadproductstats') {
      handleMenuChange('upload-product-stats')
    }
  }, [location.pathname, handleMenuChange])

  // 토스 구독/관리자 직접결제 리다이렉트 진입 시 해당 페이지로 이동
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    if (params.get('subscription')) {
      handleMenuChange('subscription-plan')
    }
    if (params.get('adminPay')) {
      handleMenuChange('admin-direct-payment')
    }
  }, [location.search, handleMenuChange])

  const renderAdminPage = (menu: string, page: React.ReactNode) => {
    if (activeMenu !== menu) return null
    if (!isAdminUser(userInfo.userType)) return null
    return page
  }

  // 사용자별 매출(모바일) - 관리자만, 사이드바 없이 표시
  if (activeMenu === 'mobile-sales-stats') {
    if (!isAdminUser(userInfo.userType)) {
      return null
    }
    return <SimpleMobileSalesPage onNavigate={handleMenuChange} />
  }

  return (
    <UserProvider userInfo={userInfo} setUserInfo={setUserInfo}>
      <FilterProvider>
        <div className="app-container">
          <Sidebar
            activeMenu={activeMenu}
            onMenuChange={handleMenuChange}
            onLogout={onLogout}
            userInfo={userInfo}
          />

          <main className="main-content">
            {activeMenu === 'dashboard' && <Dashboard onNavigate={handleMenuChange} />}
            {activeMenu === 'products' && <ProductPage />}
            {activeMenu === 'orders' && <OrderPage />}
            {activeMenu === 'order-sales-stats' && <OrderSalesStatsPage />}
            {activeMenu === 'account' && <AccountPage />}
            {activeMenu === 'basic' && <BasicInfoPage />}
            {activeMenu === 'market' && <MarketPage />}
            {activeMenu === 'notices' && <NoticePage />}
            {activeMenu === 'subscription-plan' && <SubscriptionPlanPage />}

            {renderAdminPage('standard-info', <StandardInfoPage />)}
            {renderAdminPage('user-management', <UserManagementPage onNavigate={handleMenuChange} />)}
            {renderAdminPage('subscription-management', <SubscriptionManagementPage />)}
            {renderAdminPage('signup-payment-management', <SignupPaymentManagementPage />)}
            {renderAdminPage('admin-direct-payment', <AdminDirectPaymentPage />)}
            {renderAdminPage('notice-management', <NoticeManagementPage />)}
            {renderAdminPage('deleted-products', <DeleteProductManagementPage />)}
            {renderAdminPage('detail-page-management', <DetailPageManagement />)}
            {renderAdminPage('banned-words', <NoWordManagementPage />)}
            {renderAdminPage('batch-log', <BatchLogManagementPage />)}
            {renderAdminPage('server-management', <ServerManagementPage />)}
            {renderAdminPage('user-sales-stats', <UserSalesStatsPage onNavigate={handleMenuChange} />)}
            {renderAdminPage('daily-sales-stats', <DailySalesStatsPage />)}
            {renderAdminPage('upload-product-stats', <UploadProductStatsPage />)}
            {renderAdminPage('fake-purchase-user', <FakePurchaseUserPage />)}
            {renderAdminPage('fake-purchase-info', <FakePurchaseInfoPage />)}
            {renderAdminPage('fake-purchase-product', <FakePurchaseProductPage />)}
            {renderAdminPage('fake-purchase-schedule', <FakePurchaseSchedulePage />)}
          </main>
        </div>
      </FilterProvider>
    </UserProvider>
  )
}

function App() {
  const location = useLocation()
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [userInfo, setUserInfo] = useState<UserInfo>({
    userId: '',
    userName: '',
    userType: '',
    endDate: null
  })
  const [activeMenu, setActiveMenu] = useState('dashboard')

  useEffect(() => {
    const savedUserInfo = localStorage.getItem('userInfo')
    if (savedUserInfo) {
      const parsedUserInfo = JSON.parse(savedUserInfo)
      setIsLoggedIn(true)
      setUserInfo(parsedUserInfo)
      if (isAdminUser(parsedUserInfo.userType)) {
        setActiveMenu('user-sales-stats')
      }
    }
  }, [])

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
    if (isAdminUser(userType)) {
      setActiveMenu('user-sales-stats')
    } else {
      setActiveMenu('dashboard')
    }
  }

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

  const currentPath = location.pathname.replace(/\/$/, '').toLowerCase()
  if (currentPath === '/signup') {
    return (
      <AlertProvider>
        <SignupPaymentPage />
      </AlertProvider>
    )
  }

  if (!isLoggedIn) {
    return (
      <AlertProvider>
        <LoginPage onLogin={handleLogin} />
      </AlertProvider>
    )
  }

  return (
    <AlertProvider>
      <AuthenticatedApp
        userInfo={userInfo}
        setUserInfo={setUserInfo}
        onLogout={handleLogout}
        activeMenu={activeMenu}
        setActiveMenu={setActiveMenu}
      />
    </AlertProvider>
  )
}

export default App
