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
}

function OrderSalesSummary({ 
  dateFilter, 
  smartStore, 
  coupang, 
  selectedStores,
  stores,
  useCustomDate = false,
  startDate = '',
  endDate = ''
}: OrderSalesSummaryProps) {
  const { userInfo } = useUser()
  const [totalSales, setTotalSales] = useState(0)

  useEffect(() => {
    if (userInfo?.userId && stores.length > 0 && selectedStores.length > 0) {
      loadSummary()
    } else {
      setTotalSales(0)
    }
  }, [dateFilter, smartStore, coupang, selectedStores, stores, useCustomDate, startDate, endDate, userInfo?.userId])

  const loadSummary = async () => {
    try {
      // 선택된 스토어 ID를 파싱하여 스토어명으로 변환
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
        setTotalSales(result.data?.total_sales || 0)
      }
    } catch (error) {
      console.error('주문&매출 현황 로드 오류:', error)
      setTotalSales(0)
    }
  }

  // 매출액을 만원 단위로 변환
  const formatSales = (amount: number) => {
    return Math.floor(amount / 10000).toLocaleString()
  }

  // 예상수익을 총 매출의 27%로 계산 (만원 단위)
  const calculateExpectedProfit = () => {
    return Math.floor((totalSales * 0.27) / 10000).toLocaleString()
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
            <strong>{calculateExpectedProfit()}</strong> 만원
          </span>
        </div>
      </div>
    </div>
  )
}

export default OrderSalesSummary
