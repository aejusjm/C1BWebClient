// C1B 가입 결제 페이지 (비로그인, 직접 접근 / 토스페이먼츠 일반결제)
import { useEffect, useState } from 'react'
import { loadTossPayments } from '@tosspayments/payment-sdk'
import './SignupPaymentPage.css'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'
const API_URL = `${API_BASE}/api/signup-payment`
const TOSS_CLIENT_KEY = import.meta.env.VITE_TOSS_CLIENT_KEY || ''

const SIGNUP_AMOUNT = 6600000

type ViewState = 'form' | 'processing' | 'success' | 'fail'

function SignupPaymentPage() {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [agree, setAgree] = useState(false)
  const [view, setView] = useState<ViewState>('form')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // 결제 성공/실패 리다이렉트 처리
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const status = params.get('status')
    if (!status) return

    const clearQuery = () => {
      window.history.replaceState({}, '', window.location.pathname)
    }

    if (status === 'fail') {
      const msg = params.get('message') || '결제가 취소되었거나 실패했습니다.'
      clearQuery()
      setMessage(msg)
      setView('fail')
      return
    }

    if (status === 'success') {
      const paymentKey = params.get('paymentKey')
      const orderId = params.get('orderId')
      const amount = params.get('amount')
      clearQuery()

      if (!paymentKey || !orderId || !amount) {
        setMessage('결제 정보가 올바르지 않습니다.')
        setView('fail')
        return
      }

      setView('processing')
      ;(async () => {
        try {
          const response = await fetch(`${API_URL}/confirm`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ paymentKey, orderId, amount: Number(amount) })
          })
          const result = await response.json()
          if (result.success) {
            setView('success')
          } else {
            setMessage(result.message || '결제 승인에 실패했습니다.')
            setView('fail')
          }
        } catch (error) {
          console.error('결제 승인 오류:', error)
          setMessage('결제 승인 처리 중 오류가 발생했습니다.')
          setView('fail')
        }
      })()
    }
  }, [])

  const formatAmount = (n: number) => n.toLocaleString()

  const handlePay = async () => {
    if (!name.trim()) {
      setMessage('가입자명을 입력해주세요.')
      return
    }
    if (!phone.trim()) {
      setMessage('연락처를 입력해주세요.')
      return
    }
    if (!agree) {
      setMessage('결제 진행에 동의해주세요.')
      return
    }
    if (!TOSS_CLIENT_KEY) {
      setMessage('결제 설정(클라이언트 키)이 없습니다. 관리자에게 문의하세요.')
      return
    }
    setMessage('')

    try {
      setSubmitting(true)

      // 1) 결제 준비 (가입자 정보 저장 + orderId 발급)
      const prepareRes = await fetch(`${API_URL}/prepare`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), phone: phone.trim() })
      })
      const prepareResult = await prepareRes.json()
      if (!prepareResult.success) {
        setMessage(prepareResult.message || '결제 준비에 실패했습니다.')
        setSubmitting(false)
        return
      }

      const { orderId, amount, orderName, customerName } = prepareResult.data

      // 2) 토스 결제창 호출
      const tossPayments = await loadTossPayments(TOSS_CLIENT_KEY)
      const origin = window.location.origin
      await tossPayments.requestPayment('카드', {
        amount,
        orderId,
        orderName,
        customerName,
        successUrl: `${origin}/signup?status=success`,
        failUrl: `${origin}/signup?status=fail`
      })
      // 성공 시 successUrl로 리다이렉트됨
    } catch (error) {
      console.error('결제 요청 오류:', error)
      // 사용자가 결제창을 닫은 경우 등
      setSubmitting(false)
    }
  }

  const resetToForm = () => {
    setView('form')
    setMessage('')
    setSubmitting(false)
  }

  return (
    <div className="signup-payment-page">
      <div className="signup-payment-card">
        {/* 헤더 / 로고 */}
        <div className="signup-payment-header">
          <div className="signup-logo-wrapper">
            <img src="/c1b_logo.png" alt="C1B Logo" className="signup-logo-image" />
            <div className="signup-logo-text">
              <span className="signup-title-main">C1B</span>
              <span className="signup-title-divider">|</span>
              <span className="signup-title-sub">Click One Button</span>
            </div>
          </div>
          <p className="signup-subtitle">가입 결제</p>
        </div>

        {/* 폼 */}
        {view === 'form' && (
          <div className="signup-payment-body">
            <div className="signup-amount-box">
              <span className="signup-amount-label">결제금액</span>
              <span className="signup-amount-value">{formatAmount(SIGNUP_AMOUNT)}원</span>
              <span className="signup-amount-vat">(VAT 포함)</span>
            </div>

            <div className="signup-field">
              <label>가입자명</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="가입자명을 입력하세요"
                autoFocus
              />
            </div>

            <div className="signup-field">
              <label>연락처</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="연락처를 입력하세요 (예: 010-1234-5678)"
              />
            </div>

            <label className="signup-agree">
              <input
                type="checkbox"
                checked={agree}
                onChange={(e) => setAgree(e.target.checked)}
              />
              <span>결제 내용을 확인하였으며, 결제 진행에 동의합니다.</span>
            </label>

            {message && <div className="signup-error-msg">{message}</div>}

            <button className="signup-pay-btn" onClick={handlePay} disabled={submitting}>
              {submitting ? '결제 진행 중...' : `${formatAmount(SIGNUP_AMOUNT)}원 결제하기`}
            </button>
          </div>
        )}

        {/* 처리 중 */}
        {view === 'processing' && (
          <div className="signup-payment-body signup-result">
            <div className="signup-spinner" />
            <p className="signup-result-text">결제를 확인하고 있습니다...</p>
          </div>
        )}

        {/* 성공 */}
        {view === 'success' && (
          <div className="signup-payment-body signup-result">
            <div className="signup-result-icon success">✓</div>
            <h2 className="signup-result-title">결제가 완료되었습니다</h2>
            <p className="signup-result-text">
              C1B 가입 결제가 정상적으로 처리되었습니다.<br />
              담당자가 곧 연락드리겠습니다.
            </p>
          </div>
        )}

        {/* 실패 */}
        {view === 'fail' && (
          <div className="signup-payment-body signup-result">
            <div className="signup-result-icon fail">!</div>
            <h2 className="signup-result-title">결제에 실패했습니다</h2>
            <p className="signup-result-text">{message || '결제가 정상적으로 처리되지 않았습니다.'}</p>
            <button className="signup-retry-btn" onClick={resetToForm}>
              다시 시도하기
            </button>
          </div>
        )}

        <div className="signup-payment-footer">
          <p>© 2026 C1B. All rights reserved.</p>
        </div>
      </div>
    </div>
  )
}

export default SignupPaymentPage
