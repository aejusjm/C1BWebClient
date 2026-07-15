import { useEffect, useState } from 'react'
import { loadTossPayments } from '@tosspayments/payment-sdk'
import './SubscriptionPlanPage.css'
import { useAlert } from '../contexts/AlertContext'
import { useUser } from '../contexts/UserContext'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'
const API_URL = `${API_BASE}/api/subscription`
const STANDARD_INFO_URL = `${API_BASE}/api/standard-info`
const TOSS_CLIENT_KEY = import.meta.env.VITE_TOSS_CLIENT_KEY || ''

type PlanType = 'BASIC' | 'EXTRA' | 'EXTEND'

function SubscriptionPlanPage() {
  const { showAlert } = useAlert()
  const { userInfo } = useUser()
  const [processing, setProcessing] = useState(false)
  const [basicFee, setBasicFee] = useState<number | null>(null)

  // 기준정보관리 구독료 조회
  useEffect(() => {
    ;(async () => {
      try {
        const response = await fetch(STANDARD_INFO_URL)
        const result = await response.json()
        if (result.success) {
          const fee = Number(result.data?.subFee)
          setBasicFee(Number.isFinite(fee) && fee > 0 ? fee : null)
        }
      } catch (error) {
        console.error('구독료 조회 오류:', error)
      }
    })()
  }, [])

  // 결제 성공/실패 리다이렉트 처리
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const subscription = params.get('subscription')
    if (!subscription) return

    // 쿼리스트링 정리 (재처리 방지)
    const clearQuery = () => {
      window.history.replaceState({}, '', window.location.pathname)
    }

    if (subscription === 'extend-fail') {
      const message = params.get('message') || '결제가 취소되었거나 실패했습니다.'
      clearQuery()
      showAlert(`1개월 연장 결제 실패: ${message}`)
      return
    }

    if (subscription === 'extend-success') {
      const paymentKey = params.get('paymentKey')
      const orderId = params.get('orderId')
      const amount = params.get('amount')
      clearQuery()

      if (!paymentKey || !orderId || !amount || !userInfo.userId) {
        showAlert('결제 정보가 올바르지 않습니다. 다시 시도해주세요.')
        return
      }

      ;(async () => {
        try {
          setProcessing(true)
          const response = await fetch(`${API_URL}/extend/confirm`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              paymentKey,
              orderId,
              amount: Number(amount),
              userId: userInfo.userId
            })
          })
          const result = await response.json()
          if (result.success) {
            await showAlert('1개월 연장 결제가 완료되었습니다. 이용 기간이 1개월 연장되었습니다.')
          } else {
            await showAlert(result.message || '결제 승인에 실패했습니다.')
          }
        } catch (error) {
          console.error('1개월 연장 결제 승인 오류:', error)
          await showAlert('결제 승인 처리 중 오류가 발생했습니다.')
        } finally {
          setProcessing(false)
        }
      })()
      return
    }

    if (subscription === 'fail') {
      const message = params.get('message') || '카드 등록이 취소되었거나 실패했습니다.'
      clearQuery()
      showAlert(`구독 결제 실패: ${message}`)
      return
    }

    if (subscription === 'success') {
      const authKey = params.get('authKey')
      const customerKey = params.get('customerKey')
      const plan = params.get('plan') as PlanType | null
      clearQuery()

      if (!authKey || !customerKey || !plan) {
        showAlert('결제 정보가 올바르지 않습니다. 다시 시도해주세요.')
        return
      }

      // 빌링키 발급 + 첫 결제 요청
      ;(async () => {
        try {
          setProcessing(true)
          const response = await fetch(`${API_URL}/issue-billing-key`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ authKey, customerKey, plan, userId: userInfo.userId })
          })
          const result = await response.json()
          if (result.success) {
            await showAlert('구독 결제가 완료되었습니다. 이용 기간이 연장되었습니다.')
          } else {
            await showAlert(result.message || '구독 결제 처리에 실패했습니다.')
          }
        } catch (error) {
          console.error('구독 결제 처리 오류:', error)
          await showAlert('구독 결제 처리 중 오류가 발생했습니다.')
        } finally {
          setProcessing(false)
        }
      })()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleExtendPurchase = async () => {
    if (!userInfo.userId) {
      await showAlert('로그인 정보가 없습니다. 다시 로그인해주세요.')
      return
    }

    if (!TOSS_CLIENT_KEY) {
      await showAlert('결제 설정(클라이언트 키)이 없습니다. 관리자에게 문의하세요.')
      return
    }

    try {
      setProcessing(true)

      const prepareRes = await fetch(`${API_URL}/extend/prepare`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: userInfo.userId })
      })
      const prepareResult = await prepareRes.json()
      if (!prepareResult.success) {
        await showAlert(prepareResult.message || '결제 준비에 실패했습니다.')
        setProcessing(false)
        return
      }

      const { orderId, amount, orderName } = prepareResult.data

      const tossPayments = await loadTossPayments(TOSS_CLIENT_KEY)
      const origin = window.location.origin
      await tossPayments.requestPayment('카드', {
        amount,
        orderId,
        orderName,
        customerName: userInfo.userName || userInfo.userId,
        successUrl: `${origin}/?subscription=extend-success`,
        failUrl: `${origin}/?subscription=extend-fail`
      })
    } catch (error) {
      console.error('1개월 연장 결제 요청 오류:', error)
      setProcessing(false)
    }
  }

  const handleSubscribe = async (planType: PlanType) => {
    if (planType === 'EXTEND') {
      await handleExtendPurchase()
      return
    }

    if (planType === 'EXTRA') {
      await showAlert('구독이 불가합니다')
      return
    }

    if (!userInfo.userId) {
      await showAlert('로그인 정보가 없습니다. 다시 로그인해주세요.')
      return
    }

    // 기본 플랜: 이미 구독중인지 확인
    try {
      const statusRes = await fetch(`${API_URL}/${encodeURIComponent(userInfo.userId)}`)
      const statusResult = await statusRes.json()
      const isActive =
        statusResult.isActive === true ||
        String(statusResult.data?.status || '').trim().toUpperCase() === 'ACTIVE'
      if (planType === 'BASIC' && statusResult.success && isActive) {
        await showAlert('이미 구독중입니다.')
        return
      }
      if (!statusRes.ok || !statusResult.success) {
        await showAlert(statusResult.message || '구독 상태 확인에 실패했습니다.')
        return
      }
    } catch (error) {
      console.error('구독 상태 조회 오류:', error)
      await showAlert('구독 상태 확인 중 오류가 발생했습니다.')
      return
    }

    if (!TOSS_CLIENT_KEY) {
      await showAlert('결제 설정(클라이언트 키)이 없습니다. 관리자에게 문의하세요.')
      return
    }

    try {
      setProcessing(true)

      // 1) 결제 준비: customerKey 발급
      const prepareRes = await fetch(`${API_URL}/prepare`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: userInfo.userId, plan: planType })
      })
      const prepareResult = await prepareRes.json()
      if (!prepareResult.success) {
        await showAlert(prepareResult.message || '구독 준비에 실패했습니다.')
        setProcessing(false)
        return
      }

      const { customerKey } = prepareResult.data

      // 2) 토스 카드 등록창 호출
      const tossPayments = await loadTossPayments(TOSS_CLIENT_KEY)
      const origin = window.location.origin
      await tossPayments.requestBillingAuth('카드', {
        customerKey,
        successUrl: `${origin}/?subscription=success&plan=${planType}`,
        failUrl: `${origin}/?subscription=fail`
      })
      // requestBillingAuth 성공 시 페이지가 successUrl로 리다이렉트됨
    } catch (error) {
      console.error('구독 결제 요청 오류:', error)
      // 사용자가 결제창을 닫은 경우 등
      setProcessing(false)
    }
  }

  return (
    <div className="subscription-plan-page">
      <div className="subscription-header">
        <h1 className="subscription-title">C1B 자동화 서비스 구독 플랜 정보</h1>
      </div>

      <div className="plan-grid">
        <div className="plan-card">
          <div className="plan-badge">기본 플렌</div>
          <div className="plan-price">
            <strong>
              {basicFee !== null
                ? `월 ${basicFee.toLocaleString()}원`
                : '월 - 원'}
            </strong>
            <span>(VAT 포함)</span>
          </div>
          <div className="plan-divider" />

          <ul className="plan-features">
          <li>상품소싱 일 400 X 3개 사업자 : 매일 1200개(1만개 까지)</li>
            <li>자동 업로드 : 매일 900개 상품</li>
            <li>옵션 및 상세페이지 이미지 자동 번역</li>
            <li>자동 상품갈이 : 매일 150~200개 삭제 후 업로드 자동</li>
            <li>상세페이지 상/하단 이미지 무료 생성(변경 요청 가능)</li>
          </ul>

          <div className="plan-actions">
            <button className="toss-pay-btn" onClick={() => handleSubscribe('BASIC')} disabled={processing}>
              {processing ? '처리 중...' : '구독하기'}
            </button>
          </div>
        </div>

        <div className="plan-card extend">
          <div className="plan-badge">1개월 연장</div>
          <div className="plan-price">
            <strong>990,000원</strong>
            <span>(VAT 포함)</span>
          </div>
          <div className="plan-divider" />

          <ul className="plan-features">
            <li>옵션 및 상세페이지 이미지 자동 번역</li>
            <li>자동 상품갈이 : 매일 150~200개 삭제 후 업로드 자동</li>
            <li>상세페이지 상/하단 이미지 무료 생성(변경 요청 가능)</li>
            <li>결제 시 마다 1개월씩 연장</li>
          </ul>

          <div className="plan-actions">
            <button className="toss-pay-btn extend-pay-btn" onClick={() => handleSubscribe('EXTEND')} disabled={processing}>
              {processing ? '처리 중...' : '구매하기'}
            </button>
          </div>
        </div>

        <div className="plan-card secondary">
          <div className="plan-badge">추가 플랜</div>
          <div className="plan-price">
            <strong>월 50,000원</strong>
            <span>(VAT 포함)</span>
          </div>
          <div className="plan-divider" />

          <ul className="plan-features">
            <li>통관번호 카카오 알림톡 자동 수집 무제한</li>
          </ul>

          <div className="plan-actions">
            <button className="toss-pay-btn" onClick={() => handleSubscribe('EXTRA')} disabled={processing}>
              {processing ? '처리 중...' : '구독하기'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SubscriptionPlanPage
