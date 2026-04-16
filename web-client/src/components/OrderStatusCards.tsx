// 주문현황 카드 컴포넌트 - 결제완료, 배송준비중, 배송중, 배송완료 통계 표시
import { useState, useEffect } from 'react'
import { useUser } from '../contexts/UserContext'
import { useFilter } from '../contexts/FilterContext'
import './OrderStatusCards.css'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'
const API_URL = `${API_BASE}/api/orders`

interface OrderStatusCardsProps {
  dateFilter: string
  smartStore: boolean
  coupang: boolean
  selectedStores: number[]
  onNavigate?: (menu: string) => void
  useCustomDate?: boolean
  startDate?: string
  endDate?: string
}

function OrderStatusCards({ dateFilter, smartStore, coupang, selectedStores, onNavigate, useCustomDate = false, startDate = '', endDate = '' }: OrderStatusCardsProps) {
  const { navigateToOrdersWithFilter } = useFilter()
  const { userInfo } = useUser()
  const [stats, setStats] = useState({
    new_orders: 0,
    preparing: 0,
    delivering: 0,
    delivered: 0
  })

  useEffect(() => {
    if (userInfo?.userId) {
      loadStats()
    }
  }, [dateFilter, smartStore, coupang, selectedStores, useCustomDate, startDate, endDate, userInfo?.userId])

  const loadStats = async () => {
    try {
      const storesParam = selectedStores.join(',')
      let url = `${API_URL}/stats/${userInfo.userId}?dateFilter=${dateFilter}&smartStore=${smartStore}&coupang=${coupang}&stores=${storesParam}`
      
      // 사용자 정의 날짜 범위가 설정된 경우
      if (useCustomDate && startDate && endDate) {
        url += `&startDate=${startDate}&endDate=${endDate}`
      }
      
      const response = await fetch(url)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const result = await response.json()
      
      if (result.success) {
        setStats({
          new_orders: result.data?.new_orders || 0,
          preparing: result.data?.preparing || 0,
          delivering: result.data?.delivering || 0,
          delivered: result.data?.delivered || 0
        })
      }
    } catch (error) {
      console.error('주문 통계 로드 오류:', error)
    }
  }

  // 전체 건수 계산
  const totalCount = stats.new_orders + stats.preparing + stats.delivering + stats.delivered

  // 주문 상태별 데이터
  const orderStats = [
    { label: '신규주문', count: stats.new_orders, color: '#2196F3' },
    { label: '상품준비중', count: stats.preparing, color: '#FF9800' },
    { label: '배송중', count: stats.delivering, color: '#4CAF50' },
    { label: '배송완료', count: stats.delivered, color: '#9E9E9E' }
  ]

  // 카드 클릭 시 주문관리 페이지로 이동
  const handleCardClick = (status: string) => {
    navigateToOrdersWithFilter(status)
    onNavigate?.('orders')
  }

  // 전체건수 카드 클릭 시 주문관리 페이지로 이동 (필터 없이)
  const handleTotalClick = () => {
    navigateToOrdersWithFilter(null)
    onNavigate?.('orders')
  }

  return (
    <div className="order-status-section">
      <h2 className="section-title">주문현황</h2>
      <div className="status-cards-with-total">
        {/* 전체건수 카드 */}
        <div className="total-count-card clickable" onClick={handleTotalClick}>
          <div className="total-label">전체건수</div>
          <div className="total-number">{totalCount}</div>
        </div>
        
        {/* 상태별 카드 그리드 */}
        <div className="status-cards-grid">
          {orderStats.map((stat, index) => (
            <div 
              key={index} 
              className="status-card-compact clickable"
              onClick={() => handleCardClick(stat.label)}
            >
              <span className="compact-label">{stat.label}</span>
              <span className="compact-count" style={{ color: stat.color }}>
                {stat.count}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default OrderStatusCards
