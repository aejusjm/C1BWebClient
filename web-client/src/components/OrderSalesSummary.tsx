// 주문&매출 현황 요약 카드 컴포넌트
import { useState, useEffect } from 'react'
import { useUser } from '../contexts/UserContext'
import './OrderSalesSummary.css'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'
const API_URL = `${API_BASE}/api/orders`
const STANDARD_INFO_URL = `${API_BASE}/api/standard-info`

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
  const [rateOfReturn, setRateOfReturn] = useState(0.27) // 기본값 27%
  const [baseSubAmt, setBaseSubAmt] = useState(0) // 기준구독계산금액
  const [subFee, setSubFee] = useState(0) // 구독료

  // 기준정보에서 수익율/기준구독계산금액/구독료 로드
  useEffect(() => {
    loadStandardInfo()
  }, [])

  const loadStandardInfo = async () => {
    try {
      const response = await fetch(STANDARD_INFO_URL)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const result = await response.json()
      
      if (result.success && result.data) {
        if (result.data.rateOfReturn) {
          // rateOfReturn 값을 숫자로 변환하고 퍼센트로 사용 (예: 27 -> 0.27)
          const rate = parseFloat(result.data.rateOfReturn) / 100
          setRateOfReturn(rate)
        }
        setBaseSubAmt(parseFloat(result.data.baseSubAmt) || 0)
        setSubFee(parseFloat(result.data.subFee) || 0)
      }
    } catch (error) {
      console.error('기준정보 로드 오류:', error)
      // 오류 시 기본값 사용
    }
  }

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

  // 예상수익을 총 매출 * 수익율로 계산 (만원 단위)
  const calculateExpectedProfit = () => {
    return Math.floor((totalSales * rateOfReturn) / 10000).toLocaleString()
  }

  // 예상구독료 계산 (만원 단위) - 사용자별 매출 '구독료' 컬럼과 동일 로직
  // 총매출 >= 기준구독계산금액 → 구독료
  // 총매출 < 기준구독계산금액 → 총매출 * 수익율 / 2 (예상수익 / 2)
  const calculateExpectedSubscription = () => {
    const subscription = totalSales >= baseSubAmt
      ? subFee
      : (totalSales * rateOfReturn) / 2
    return Math.floor(subscription / 10000).toLocaleString()
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
        <div className="summary-divider"></div>
        <div className="summary-item">
          <span className="summary-label">예상구독료</span>
          <span className="summary-value">
            {subscriptionBasis ? (
              <><strong>{calculateExpectedSubscription()}</strong> 만원</>
            ) : (
              <button
                type="button"
                className="summary-placeholder-btn"
                onClick={onSubscriptionBasis}
              >
                구독기준선택
              </button>
            )}
          </span>
        </div>
      </div>
    </div>
  )
}

export default OrderSalesSummary
