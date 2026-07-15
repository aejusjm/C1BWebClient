// 관리자 직접 결제 페이지
import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { loadTossPayments } from '@tosspayments/payment-sdk'
import { useAlert } from '../contexts/AlertContext'
import './AdminDirectPaymentPage.css'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'
const API_URL = `${API_BASE}/api/admin-direct-payment`
const TOSS_CLIENT_KEY = import.meta.env.VITE_TOSS_CLIENT_KEY || ''
const DRAFT_KEY = 'adminDirectPaymentDraft'
const HANDLED_KEY_PREFIX = 'adminDirectPaymentHandled:'

type PayType = 'SUBSCRIPTION' | 'GENERAL'

interface UserOption {
  user_id: string
  user_name: string | null
}

interface PaymentDraft {
  userId: string
  orderName: string
  amount: number
  payType: PayType
}

function takeDraft(): PaymentDraft | null {
  try {
    const draftRaw = sessionStorage.getItem(DRAFT_KEY)
    if (!draftRaw) return null
    sessionStorage.removeItem(DRAFT_KEY)
    return JSON.parse(draftRaw) as PaymentDraft
  } catch {
    sessionStorage.removeItem(DRAFT_KEY)
    return null
  }
}

function markHandled(lockId: string): boolean {
  const key = `${HANDLED_KEY_PREFIX}${lockId}`
  if (sessionStorage.getItem(key)) return false
  sessionStorage.setItem(key, '1')
  return true
}

function AdminDirectPaymentPage() {
  const { showAlert } = useAlert()
  const navigate = useNavigate()
  const location = useLocation()
  const [users, setUsers] = useState<UserOption[]>([])
  const [userId, setUserId] = useState('')
  const [orderName, setOrderName] = useState('')
  const [payType, setPayType] = useState<PayType>('SUBSCRIPTION')
  const [amount, setAmount] = useState('')
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [processing, setProcessing] = useState(false)

  const resetForm = () => {
    setUserId('')
    setOrderName('')
    setPayType('SUBSCRIPTION')
    setAmount('')
  }

  useEffect(() => {
    loadUsers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 토스 리다이렉트 결과 처리
  // React Router location.search 를 navigate 로 정리해야 App 이 메뉴를 다시 고정하지 않음
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const adminPay = params.get('adminPay')
    if (!adminPay) return

    const clearQuery = () => {
      navigate({ pathname: location.pathname || '/', search: '' }, { replace: true })
    }

    if (adminPay === 'fail') {
      const message = params.get('message') || '결제가 취소되었거나 실패했습니다.'
      const lockId = `fail:${params.get('code') || message}`
      if (!markHandled(lockId)) {
        clearQuery()
        return
      }
      clearQuery()
      sessionStorage.removeItem(DRAFT_KEY)
      void showAlert(`결제 실패: ${message}`)
      return
    }

    if (adminPay === 'sub-success') {
      const authKey = params.get('authKey')
      const customerKey = params.get('customerKey')
      const lockId = `sub:${authKey || customerKey || 'unknown'}`
      if (!markHandled(lockId)) {
        clearQuery()
        return
      }

      const draft = takeDraft()
      clearQuery()

      if (!authKey || !customerKey || !draft?.userId || !draft?.amount || !draft?.orderName) {
        void showAlert('결제 정보가 올바르지 않습니다. 다시 시도해주세요.')
        return
      }

      ;(async () => {
        try {
          setProcessing(true)
          const response = await fetch(`${API_URL}/confirm-subscription`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              authKey,
              customerKey,
              userId: draft.userId,
              amount: Number(draft.amount),
              orderName: draft.orderName
            })
          })
          const result = await response.json()
          if (result.success) {
            await showAlert('구독 결제가 완료되었습니다.')
            resetForm()
          } else {
            await showAlert(result.message || '구독 결제 처리에 실패했습니다.')
          }
        } catch (error) {
          console.error('관리자 구독결제 승인 오류:', error)
          await showAlert('구독 결제 처리 중 오류가 발생했습니다.')
        } finally {
          setProcessing(false)
        }
      })()
      return
    }

    if (adminPay === 'gen-success') {
      const paymentKey = params.get('paymentKey')
      const orderId = params.get('orderId')
      const paidAmount = params.get('amount')
      const lockId = `gen:${paymentKey || orderId || 'unknown'}`
      if (!markHandled(lockId)) {
        clearQuery()
        return
      }

      const draft = takeDraft()
      clearQuery()

      if (!paymentKey || !orderId || !paidAmount || !draft?.userId || !draft?.orderName) {
        void showAlert('결제 정보가 올바르지 않습니다. 다시 시도해주세요.')
        return
      }

      ;(async () => {
        try {
          setProcessing(true)
          const response = await fetch(`${API_URL}/confirm-general`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              paymentKey,
              orderId,
              amount: Number(paidAmount),
              userId: draft.userId,
              orderName: draft.orderName
            })
          })
          const result = await response.json()
          if (result.success) {
            await showAlert('일반 결제가 완료되었습니다.')
            resetForm()
          } else {
            await showAlert(result.message || '일반 결제 처리에 실패했습니다.')
          }
        } catch (error) {
          console.error('관리자 일반결제 승인 오류:', error)
          await showAlert('일반 결제 처리 중 오류가 발생했습니다.')
        } finally {
          setProcessing(false)
        }
      })()
    }
  }, [location.search, location.pathname, navigate, showAlert])

  const loadUsers = async () => {
    try {
      setLoadingUsers(true)
      const response = await fetch(`${API_URL}/users`)
      const result = await response.json()
      if (result.success) {
        setUsers(result.data || [])
      } else {
        await showAlert(result.message || '사용자 목록을 불러오지 못했습니다.')
      }
    } catch (error) {
      console.error('사용자 목록 조회 오류:', error)
      await showAlert('사용자 목록 조회 중 오류가 발생했습니다.')
    } finally {
      setLoadingUsers(false)
    }
  }

  const handlePay = async () => {
    if (!userId) {
      await showAlert('사용자를 선택해주세요.')
      return
    }
    if (!orderName.trim()) {
      await showAlert('결제명(주문명)을 입력해주세요.')
      return
    }
    const payAmount = parseInt(amount, 10)
    if (!payAmount || payAmount <= 0) {
      await showAlert('결제금액을 올바르게 입력해주세요.')
      return
    }
    if (!TOSS_CLIENT_KEY) {
      await showAlert('결제 설정(클라이언트 키)이 없습니다. 관리자에게 문의하세요.')
      return
    }

    try {
      setProcessing(true)

      const prepareRes = await fetch(`${API_URL}/prepare`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          orderName: orderName.trim(),
          payType,
          amount: payAmount
        })
      })
      const prepareResult = await prepareRes.json()
      if (!prepareResult.success) {
        await showAlert(prepareResult.message || '결제 준비에 실패했습니다.')
        setProcessing(false)
        return
      }

      const data = prepareResult.data
      const tossPayments = await loadTossPayments(TOSS_CLIENT_KEY)
      const origin = window.location.origin

      sessionStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({
          userId: data.userId,
          orderName: data.orderName,
          amount: data.amount,
          payType: data.payType
        })
      )

      if (data.payType === 'SUBSCRIPTION') {
        await tossPayments.requestBillingAuth('카드', {
          customerKey: data.customerKey,
          successUrl: `${origin}/?adminPay=sub-success`,
          failUrl: `${origin}/?adminPay=fail`
        })
      } else {
        await tossPayments.requestPayment('카드', {
          amount: data.amount,
          orderId: data.orderId,
          orderName: data.orderName,
          customerName: data.customerName,
          successUrl: `${origin}/?adminPay=gen-success`,
          failUrl: `${origin}/?adminPay=fail`
        })
      }
    } catch (error) {
      console.error('관리자 직접결제 요청 오류:', error)
      sessionStorage.removeItem(DRAFT_KEY)
      setProcessing(false)
    }
  }

  return (
    <div className="admin-direct-payment-page">
      <div className="admin-direct-payment-header">
        <h1 className="page-title">💳 관리자 직접 결제</h1>
      </div>

      <div className="admin-direct-payment-card">
        <h2 className="form-title">결제 정보 입력</h2>

        <div className="admin-pay-field">
          <label>사용자</label>
          <select
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            disabled={loadingUsers || processing}
          >
            <option value="">{loadingUsers ? '불러오는 중...' : '사용자를 선택하세요'}</option>
            {users.map((u) => (
              <option key={u.user_id} value={u.user_id}>
                {u.user_name || u.user_id} ({u.user_id})
              </option>
            ))}
          </select>
        </div>

        <div className="admin-pay-field">
          <label>결제명 (주문명)</label>
          <input
            type="text"
            value={orderName}
            onChange={(e) => setOrderName(e.target.value)}
            placeholder="예: C1B 추가 정산 / 특별 구독 결제"
            disabled={processing}
          />
        </div>

        <div className="admin-pay-field">
          <label>결제구분</label>
          <div className="admin-pay-type-group">
            <label className={`admin-pay-type-option ${payType === 'SUBSCRIPTION' ? 'active' : ''}`}>
              <input
                type="radio"
                name="payType"
                value="SUBSCRIPTION"
                checked={payType === 'SUBSCRIPTION'}
                onChange={() => setPayType('SUBSCRIPTION')}
                disabled={processing}
              />
              구독
            </label>
            <label className={`admin-pay-type-option ${payType === 'GENERAL' ? 'active' : ''}`}>
              <input
                type="radio"
                name="payType"
                value="GENERAL"
                checked={payType === 'GENERAL'}
                onChange={() => setPayType('GENERAL')}
                disabled={processing}
              />
              일반
            </label>
          </div>
          <p className="admin-pay-hint">
            {payType === 'SUBSCRIPTION'
              ? '구독: 카드 등록(빌링) 후 결제되며, 이용기간이 1개월 연장됩니다.'
              : '일반: 일회성 카드 결제로 처리됩니다.'}
          </p>
        </div>

        <div className="admin-pay-field">
          <label>결제금액 (원)</label>
          <input
            type="number"
            min={1}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="결제금액 입력"
            disabled={processing}
          />
        </div>

        <div className="admin-pay-actions">
          <button type="button" className="admin-pay-reset-btn" onClick={resetForm} disabled={processing}>
            초기화
          </button>
          <button type="button" className="admin-pay-submit-btn" onClick={handlePay} disabled={processing}>
            {processing ? '처리 중...' : '결제하기'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default AdminDirectPaymentPage
