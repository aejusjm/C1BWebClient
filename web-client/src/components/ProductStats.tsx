// 등록상품 수 컴포넌트 - 마켓별 상품 등록 통계 표시
import { useState, useEffect } from 'react'
import { useUser } from '../contexts/UserContext'
import './ProductStats.css'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'

interface StoreStats {
  biz_idx: number
  store_name: string
  count: number
}

interface MarketStats {
  total: number
  stores: StoreStats[]
}

interface ProductStatsData {
  smartStore: MarketStats
  coupang: MarketStats
}

function ProductStats() {
  const { userInfo } = useUser()
  const [stats, setStats] = useState<ProductStatsData>({
    smartStore: { total: 0, stores: [] },
    coupang: { total: 0, stores: [] }
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (userInfo?.userId) {
      loadProductStats()
    }
  }, [userInfo?.userId])

  const loadProductStats = async () => {
    try {
      setLoading(true)
      const response = await fetch(`${API_BASE}/api/products/stats/${userInfo.userId}`)
      
      if (!response.ok) {
        throw new Error('상품 통계 조회 실패')
      }

      const result = await response.json()
      
      if (result.success) {
        setStats(result.data)
      }
    } catch (error) {
      console.error('상품 통계 로드 오류:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatNumber = (num: number) => {
    return num.toLocaleString()
  }

  return (
    <div className="product-stats-container">
      <h3 className="stats-title">등록상품 수</h3>
      
      <div className="stats-grid">
        {/* 스마트스토어 통계 */}
        <div className="stats-card">
          <div className="stats-card-header">스마트스토어</div>
          <div className="stats-numbers">
            {loading ? (
              <div className="stats-loading">로딩 중...</div>
            ) : (
              <>
                <div className="stats-main-number">{formatNumber(stats.smartStore.total)}</div>
                <div className="stats-sub-numbers">
                  {stats.smartStore.stores.map((store, index) => (
                    <span key={store.biz_idx}>
                      {formatNumber(store.count)}
                      {index < stats.smartStore.stores.length - 1 && ' / '}
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* 쿠팡 통계 */}
        <div className="stats-card">
          <div className="stats-card-header">쿠팡</div>
          <div className="stats-numbers">
            {loading ? (
              <div className="stats-loading">로딩 중...</div>
            ) : (
              <>
                <div className="stats-main-number">{formatNumber(stats.coupang.total)}</div>
                <div className="stats-sub-numbers">
                  {stats.coupang.stores.length > 0 ? (
                    stats.coupang.stores.map((store, index) => (
                      <span key={store.biz_idx}>
                        {formatNumber(store.count)}
                        {index < stats.coupang.stores.length - 1 && ' / '}
                      </span>
                    ))
                  ) : (
                    <span>-</span>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default ProductStats
