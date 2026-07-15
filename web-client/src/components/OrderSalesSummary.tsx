// 주문&매출 현황 요약 카드 컴포넌트
import { useState, useEffect } from 'react'
import { useUser } from '../contexts/UserContext'
import './OrderSalesSummary.css'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'
const API_URL = `${API_BASE}/api/orders`

interface OrderSalesSummaryProps {
  dateFilter: string
  smartStore: boolean
  coupang: boolean
  selectedStores: string[]
  stores: Array<{user_id: string, biz_idx: number, store_name: string, market_type: string}>
  useCustomDate?: boolean
  startDate?: string
  endDate?: string
  subscriptionBasis?: boolean
  onSubscriptionBasis?: () => void
}

function OrderSalesSummary({ 
  dateFilter, 
  smartStore, 
  coupang, 
  selectedStores,
  stores,
  useCustomDate = false,
  startDate = '',
  endDate = '',
  subscriptionBasis = false,
  onSubscriptionBasis
}: OrderSalesSummaryProps) {
  const { userInfo } = useUser()
  const [totalSales, setTotalSales] = useState(0)
  const [expectedProfit, setExpectedProfit] = useState(0)
  const [expectedSubscriptionFee, setExpectedSubscriptionFee] = useState(0)

  useEffect(() => {
    if (userInfo?.userId && stores.length > 0 && selectedStores.length > 0) {
      loadSummary()
    } else {
      setTotalSales(0)
      setExpectedProfit(0)
      setExpectedSubscriptionFee(0)
    }
  }, [dateFilter, smartStore, coupang, selectedStores, stores, useCustomDate, startDate, endDate, userInfo?.userId])

  const loadSummary = async () => {
    try {
      const selectedStoreNames = selectedStores
        .map(storeId => {
          const [marketType, bizIdx] = storeId.split('-')
          const store = stores.find(s => s.market_type === marketType && s.biz_idx === parseInt(bizIdx))
          return store?.store_name
        })
        .filter(name => name !== undefined)
      const storesParam = selectedStoreNames.join(',')
      let url = `${API_URL}/dashboard/summary/${userInfo.userId}?dateFilter=${dateFilter}&smartStore=${smartStore}&coupang=${coupang}&stores=${storesParam}`
      
      if (useCustomDate && startDate && endDate) {
        url += `&startDate=${startDate}&endDate=${endDate}`
      }
      
      const response = await fetch(url)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const result = await response.json()
      
      if (result.success) {
        setTotalSales(Number(result.data?.total_sales) || 0)
        setExpectedProfit(Number(result.data?.expected_profit) || 0)
        setExpectedSubscriptionFee(Number(result.data?.expected_subscription_fee) || 0)
      }
    } catch (error) {
      console.error('주문&매출 현황 로드 오류:', error)
      setTotalSales(0)
      setExpectedProfit(0)
      setExpectedSubscriptionFee(0)
    }
  }

  const formatSales = (amount: number) => {
    return Math.floor(amount / 10000).toLocaleString()
  }

  return (
    <div className="order-sales-summary">
      <h3 className="summary-title">📊 주문&매출 현황</h3>
      <div className="summary-content">
        <div className="summary-item">
          <span className="summary-label">총 매출</span>
          <span className="summary-value">
            <strong>{formatSales(totalSales)}</strong> 만원
          </span>
        </div>
        <div className="summary-divider"></div>
        <div className="summary-item">
          <span className="summary-label">예상수익</span>
          <span className="summary-value">
            <strong>{formatSales(expectedProfit)}</strong> 만원
          </span>
        </div>
        <div className="summary-divider"></div>
        <div className="summary-item">
          <span className="summary-label">예상구독료</span>
          <span className="summary-value">
            {subscriptionBasis ? (
              <><strong>{formatSales(expectedSubscriptionFee)}</strong> 만원</>
            ) : (
              <button
                type="button"
                className="summary-placeholder-btn"
                onClick={onSubscriptionBasis}
              >
                현재구독료확인
              </button>
            )}
          </span>
        </div>
      </div>
    </div>
  )
}

export default OrderSalesSummary
