// 구독관리 페이지 컴포넌트 - 사용자 구독결제 리스트
import { useState, useEffect } from 'react'
import { useAlert } from '../contexts/AlertContext'
import './SubscriptionManagementPage.css'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'
const API_URL = `${API_BASE}/api/subscription-management`
const COHORT_API_URL = `${API_BASE}/api/cohorts`

interface CohortOption {
  seq: number
  cohort_name: string
}

interface SubscriptionPayment {
  seq: number
  user_id: string
  user_name: string | null
  plan_type: string | null
  amount: number
  status: string
  order_id: string
  payment_key: string | null
  paid_at: string | null
  created_at: string | null
  next_pay_date: string | null
  sub_status: string | null
  end_date: string | null
  refund_amount: number
  refund_reason: string | null
  refunded_at: string | null
}

/** 플랜 코드 → 화면 라벨 */
function getPlanLabel(plan: string | null): string {
  if (plan === 'BASIC') return '기본 플랜'
  if (plan === 'EXTEND') return '1개월 연장'
  if (plan === 'EXTRA') return '추가 플랜'
  return plan || '-'
}

/** 결제상태 → 라벨 + 클래스 */
function getStatusBadge(status: string): { label: string; className: string } {
  switch (status) {
    case 'DONE':
      return { label: '결제완료', className: 'paid' }
    case 'FAILED':
      return { label: '결제실패', className: 'failed' }
    case 'CANCELED':
      return { label: '전액환불', className: 'canceled' }
    case 'PARTIAL_CANCELED':
      return { label: '부분환불', className: 'partial' }
    default:
      return { label: status || '-', className: 'unknown' }
  }
}

const API_REFUND = (seq: number) => `${API_URL}/${seq}/refund`

function SubscriptionManagementPage() {
  const { showAlert } = useAlert()
  const [payments, setPayments] = useState<SubscriptionPayment[]>([])
  const [loading, setLoading] = useState(false)

  // 환불 모달 상태
  const [refundTarget, setRefundTarget] = useState<SubscriptionPayment | null>(null)
  const [refundAmountInput, setRefundAmountInput] = useState('')
  const [refundReasonInput, setRefundReasonInput] = useState('')
  const [refunding, setRefunding] = useState(false)

  // 검색 입력/필터 상태
  const [userInput, setUserInput] = useState('')
  const [userFilter, setUserFilter] = useState('')
  const [startDateInput, setStartDateInput] = useState('')
  const [endDateInput, setEndDateInput] = useState('')
  const [startDateFilter, setStartDateFilter] = useState('')
  const [endDateFilter, setEndDateFilter] = useState('')
  const [cohorts, setCohorts] = useState<CohortOption[]>([])
  const [cohortSeq, setCohortSeq] = useState<number | ''>('')
  const [cohortFilter, setCohortFilter] = useState<number | ''>('')

  // 페이징 상태
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(20)

  useEffect(() => {
    loadCohorts()
  }, [])

  useEffect(() => {
    loadPayments()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userFilter, startDateFilter, endDateFilter, cohortFilter])

  const loadCohorts = async () => {
    try {
      const response = await fetch(COHORT_API_URL)
      const result = await response.json()
      if (result.success) {
        setCohorts(
          (result.data || []).map((row: { seq: number; cohort_name: string }) => ({
            seq: row.seq,
            cohort_name: row.cohort_name
          }))
        )
      }
    } catch (error) {
      console.error('기수 목록 조회 오류:', error)
    }
  }

  const loadPayments = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (userFilter) params.append('userKeyword', userFilter)
      if (startDateFilter) params.append('startDate', startDateFilter)
      if (endDateFilter) params.append('endDate', endDateFilter)
      if (cohortFilter) params.append('cohortSeq', String(cohortFilter))
      const url = params.toString() ? `${API_URL}?${params.toString()}` : API_URL

      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      const result = await response.json()
      if (result.success) {
        setPayments(result.data)
      } else {
        console.error('구독결제 목록 조회 실패:', result.message)
      }
    } catch (error) {
      console.error('구독결제 목록 조회 오류:', error)
      await showAlert('구독결제 목록을 불러오는 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = () => {
    setUserFilter(userInput.trim())
    setStartDateFilter(startDateInput)
    setEndDateFilter(endDateInput)
    setCohortFilter(cohortSeq)
    setCurrentPage(1)
  }

  const handleReset = () => {
    setUserInput('')
    setStartDateInput('')
    setEndDateInput('')
    setUserFilter('')
    setStartDateFilter('')
    setEndDateFilter('')
    setCohortSeq('')
    setCohortFilter('')
    setCurrentPage(1)
  }

  const handleUserKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }

  // 환불 가능 잔액
  const getRefundable = (payment: SubscriptionPayment) =>
    (payment.amount || 0) - (payment.refund_amount || 0)

  // 환불 가능 여부 (결제완료/부분환불 + 결제키 존재 + 잔액 있음)
  const canRefund = (payment: SubscriptionPayment) =>
    Boolean(payment.payment_key) &&
    (payment.status === 'DONE' || payment.status === 'PARTIAL_CANCELED') &&
    getRefundable(payment) > 0

  // 환불 모달 열기 (기본값: 잔액 전액)
  const openRefundModal = (payment: SubscriptionPayment) => {
    setRefundTarget(payment)
    setRefundAmountInput(String(getRefundable(payment)))
    setRefundReasonInput('')
  }

  const closeRefundModal = () => {
    if (refunding) return
    setRefundTarget(null)
    setRefundAmountInput('')
    setRefundReasonInput('')
  }

  // 환불 실행
  const handleRefund = async () => {
    if (!refundTarget) return

    const refundable = getRefundable(refundTarget)
    const amount = parseInt(refundAmountInput, 10)

    if (!amount || amount <= 0) {
      await showAlert('환불 금액을 올바르게 입력해주세요.')
      return
    }
    if (amount > refundable) {
      await showAlert(`환불 가능 금액(${refundable.toLocaleString()}원)을 초과할 수 없습니다.`)
      return
    }

    try {
      setRefunding(true)
      const response = await fetch(API_REFUND(refundTarget.seq), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cancelAmount: amount, cancelReason: refundReasonInput.trim() || '구독 환불' })
      })
      const result = await response.json()

      if (result.success) {
        setRefundTarget(null)
        setRefundAmountInput('')
        setRefundReasonInput('')
        await showAlert(`환불이 완료되었습니다. (환불액: ${amount.toLocaleString()}원)`)
        loadPayments()
      } else {
        await showAlert(result.message || '환불 처리에 실패했습니다.')
      }
    } catch (error) {
      console.error('환불 처리 오류:', error)
      await showAlert('환불 처리 중 오류가 발생했습니다.')
    } finally {
      setRefunding(false)
    }
  }

  // 날짜+시간 포맷 (YYYY-MM-DD HH:mm)
  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return '-'
    const dateStr = dateString.replace('Z', '')
    const date = new Date(dateStr)
    if (Number.isNaN(date.getTime())) return '-'
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    return `${year}-${month}-${day} ${hours}:${minutes}`
  }

  // 날짜만 포맷 (YYYY-MM-DD)
  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-'
    const dateStr = dateString.replace('Z', '')
    const date = new Date(dateStr)
    if (Number.isNaN(date.getTime())) return '-'
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const formatAmount = (amount: number) => {
    if (amount === null || amount === undefined) return '-'
    return `${amount.toLocaleString()}원`
  }

  // 집계: 총 결제완료 금액 (실패 제외, 환불액 차감 = 실수령액)
  const totalPaidAmount = payments
    .filter((p) => p.status !== 'FAILED')
    .reduce((sum, p) => sum + ((p.amount || 0) - (p.refund_amount || 0)), 0)

  // 페이징 계산
  const indexOfLastItem = currentPage * itemsPerPage
  const indexOfFirstItem = indexOfLastItem - itemsPerPage
  const currentPayments = payments.slice(indexOfFirstItem, indexOfLastItem)
  const totalPages = Math.ceil(payments.length / itemsPerPage)

  const handlePageChange = (pageNumber: number) => {
    setCurrentPage(pageNumber)
  }

  const handleItemsPerPageChange = (newItemsPerPage: number) => {
    setItemsPerPage(newItemsPerPage)
    setCurrentPage(1)
  }

  const getPageNumbers = () => {
    const pages = []
    const maxPagesToShow = 5
    let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2))
    const endPage = Math.min(totalPages, startPage + maxPagesToShow - 1)
    if (endPage - startPage + 1 < maxPagesToShow) {
      startPage = Math.max(1, endPage - maxPagesToShow + 1)
    }
    for (let i = startPage; i <= endPage; i++) {
      pages.push(i)
    }
    return pages
  }

  return (
    <div className="subscription-management-page">
      {/* 페이지 헤더 */}
      <div className="subscription-management-page-header">
        <h1 className="page-title">💳 구독결제관리</h1>
        <div className="summary-info">
          총 결제완료 금액: <strong>{totalPaidAmount.toLocaleString()}원</strong>
        </div>
      </div>

      {/* 목록 테이블 */}
      <div className="subscription-table-container">
        <div className="table-header">
          <h3>구독결제 목록 ({payments.length}건)</h3>
          <div className="filter-section">
            <label>기수:</label>
            <select
              className="sub-date-input"
              value={cohortSeq}
              onChange={(e) => setCohortSeq(e.target.value ? Number(e.target.value) : '')}
            >
              <option value="">전체</option>
              {cohorts.map((c) => (
                <option key={c.seq} value={c.seq}>{c.cohort_name}</option>
              ))}
            </select>
            <label>사용자:</label>
            <input
              type="text"
              className="sub-user-search-input"
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              onKeyDown={handleUserKeyPress}
              placeholder="사용자ID/이름"
            />
            <label>결제일자:</label>
            <input
              type="date"
              className="sub-date-input"
              value={startDateInput}
              onChange={(e) => setStartDateInput(e.target.value)}
            />
            <span className="date-tilde">~</span>
            <input
              type="date"
              className="sub-date-input"
              value={endDateInput}
              onChange={(e) => setEndDateInput(e.target.value)}
            />
            <button type="button" className="sub-search-btn" onClick={handleSearch}>
              검색
            </button>
            <button type="button" className="sub-reset-btn" onClick={handleReset}>
              초기화
            </button>
          </div>
          <div className="items-per-page">
            <label>페이지당 항목:</label>
            <select
              value={itemsPerPage}
              onChange={(e) => handleItemsPerPageChange(parseInt(e.target.value))}
            >
              <option value={20}>20개</option>
              <option value={30}>30개</option>
              <option value={50}>50개</option>
              <option value={100}>100개</option>
            </select>
          </div>
        </div>
        <div className="table-wrapper">
          <table className="subscription-table">
            <thead>
              <tr>
                <th>순번</th>
                <th>사용자</th>
                <th>플랜</th>
                <th>결제금액</th>
                <th>환불금액</th>
                <th>미환불금액</th>
                <th>결제상태</th>
                <th>결제일자</th>
                <th>다음결제일</th>
                <th>이용만료일</th>
                <th>주문번호</th>
                <th>환불</th>
              </tr>
            </thead>
            <tbody>
              {payments.length === 0 ? (
                <tr>
                  <td colSpan={12} className="no-data">
                    {loading ? '로딩 중...' : '구독결제 내역이 없습니다.'}
                  </td>
                </tr>
              ) : (
                currentPayments.map((payment, index) => {
                  const statusBadge = getStatusBadge(payment.status)
                  return (
                    <tr key={payment.seq}>
                      <td>{indexOfFirstItem + index + 1}</td>
                      <td className="user-cell" title={payment.user_id}>
                        {payment.user_name || payment.user_id}
                        <span className="user-id-sub">({payment.user_id})</span>
                      </td>
                      <td>{getPlanLabel(payment.plan_type)}</td>
                      <td className="amount-cell">{formatAmount(payment.amount)}</td>
                      <td className="amount-cell refund-amount-cell">
                        {payment.refund_amount > 0 ? `-${payment.refund_amount.toLocaleString()}원` : '-'}
                      </td>
                      <td className="amount-cell">
                        {formatAmount((payment.amount || 0) - (payment.refund_amount || 0))}
                      </td>
                      <td>
                        <span className={`sub-status-badge ${statusBadge.className}`}>
                          {statusBadge.label}
                        </span>
                      </td>
                      <td>{formatDateTime(payment.paid_at)}</td>
                      <td>{formatDate(payment.next_pay_date)}</td>
                      <td>{formatDate(payment.end_date)}</td>
                      <td className="order-id-cell" title={payment.order_id}>
                        {payment.order_id}
                      </td>
                      <td>
                        {canRefund(payment) ? (
                          <button
                            className="sub-refund-btn"
                            onClick={() => openRefundModal(payment)}
                          >
                            환불
                          </button>
                        ) : payment.status === 'CANCELED' ? (
                          <button className="sub-refund-btn completed" disabled>
                            환불완료
                          </button>
                        ) : (
                          <span style={{ color: '#999' }}>-</span>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* 페이징 */}
        {payments.length > 0 && (
          <div className="pagination">
            <button
              className="page-btn"
              onClick={() => handlePageChange(1)}
              disabled={currentPage === 1}
            >
              ≪
            </button>
            <button
              className="page-btn"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
            >
              ‹
            </button>

            {getPageNumbers().map((pageNum) => (
              <button
                key={pageNum}
                className={`page-btn ${currentPage === pageNum ? 'active' : ''}`}
                onClick={() => handlePageChange(pageNum)}
              >
                {pageNum}
              </button>
            ))}

            <button
              className="page-btn"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              ›
            </button>
            <button
              className="page-btn"
              onClick={() => handlePageChange(totalPages)}
              disabled={currentPage === totalPages}
            >
              ≫
            </button>

            <span className="page-info">
              {currentPage} / {totalPages} 페이지 (총 {payments.length}건)
            </span>
          </div>
        )}
      </div>

      {/* 환불 모달 */}
      {refundTarget && (
        <div className="refund-modal-overlay" onClick={closeRefundModal}>
          <div className="refund-modal" onClick={(e) => e.stopPropagation()}>
            <div className="refund-modal-header">
              <h3>환불 처리</h3>
              <button className="refund-modal-close" onClick={closeRefundModal} disabled={refunding}>
                ✕
              </button>
            </div>
            <div className="refund-modal-body">
              <div className="refund-info-row">
                <span className="refund-info-label">사용자</span>
                <span>{refundTarget.user_name || refundTarget.user_id} ({refundTarget.user_id})</span>
              </div>
              <div className="refund-info-row">
                <span className="refund-info-label">주문번호</span>
                <span className="refund-order-id">{refundTarget.order_id}</span>
              </div>
              <div className="refund-info-row">
                <span className="refund-info-label">결제금액</span>
                <span>{formatAmount(refundTarget.amount)}</span>
              </div>
              {refundTarget.refund_amount > 0 && (
                <div className="refund-info-row">
                  <span className="refund-info-label">기환불액</span>
                  <span>{refundTarget.refund_amount.toLocaleString()}원</span>
                </div>
              )}
              <div className="refund-info-row">
                <span className="refund-info-label">환불가능액</span>
                <span className="refund-available">{getRefundable(refundTarget).toLocaleString()}원</span>
              </div>

              <div className="refund-field">
                <label>환불 금액 (원)</label>
                <input
                  type="number"
                  min={1}
                  max={getRefundable(refundTarget)}
                  value={refundAmountInput}
                  onChange={(e) => setRefundAmountInput(e.target.value)}
                  placeholder="환불할 금액 입력"
                />
                <button
                  type="button"
                  className="refund-full-btn"
                  onClick={() => setRefundAmountInput(String(getRefundable(refundTarget)))}
                >
                  전액
                </button>
              </div>

              <div className="refund-field">
                <label>환불 사유</label>
                <input
                  type="text"
                  value={refundReasonInput}
                  onChange={(e) => setRefundReasonInput(e.target.value)}
                  placeholder="환불 사유 입력 (선택)"
                />
              </div>
            </div>
            <div className="refund-modal-footer">
              <button className="refund-cancel-btn" onClick={closeRefundModal} disabled={refunding}>
                취소
              </button>
              <button className="refund-submit-btn" onClick={handleRefund} disabled={refunding}>
                {refunding ? '처리 중...' : '환불 실행'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default SubscriptionManagementPage
