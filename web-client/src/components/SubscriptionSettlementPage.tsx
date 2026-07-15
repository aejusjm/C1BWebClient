// 구독료정산 페이지
import { useEffect, useMemo, useState } from 'react'
import { useAlert } from '../contexts/AlertContext'
import './SubscriptionSettlementPage.css'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'
const API_URL = `${API_BASE}/api/subscription-settlement`
const COHORT_API_URL = `${API_BASE}/api/cohorts`

interface CohortOption {
  seq: number
  cohort_name: string
  sub_base_start?: number | string | null
  sub_base_end?: number | string | null
  sub_fee?: number
}

interface SettlementRow {
  seq: number
  cohort_seq: number | null
  cohort_name: string | null
  settle_year: number
  settle_month: number
  period_start: string
  period_end: string
  user_id: string
  user_name: string | null
  total_sales: number
  subscription_fee: number
  base_sub_fee: number
  refund_amount: number
  created_at: string | null
}

type SortField =
  | 'cohort_name'
  | 'settle_year'
  | 'settle_month'
  | 'period'
  | 'user_name'
  | 'user_id'
  | 'total_sales'
  | 'net_profit'
  | 'subscription_fee'
  | 'refund_amount'
  | 'net_subscription_fee'

type SortOrder = 'asc' | 'desc' | null

function toDateInputValue(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function formatDateOnly(value: string | null) {
  if (!value) return '-'
  const s = String(value).replace('Z', '').slice(0, 10)
  return s || '-'
}

function formatAmount(amount: number) {
  return `${Math.floor(Number(amount || 0) / 10000).toLocaleString()} 만원`
}

function parseCohortDay(value: number | string | null | undefined): number | null {
  if (value === undefined || value === null || value === '') return null
  const s = String(value).trim()
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const d = Number(s.slice(8, 10))
    return d >= 1 && d <= 31 ? d : null
  }
  const n = parseInt(s, 10)
  return Number.isFinite(n) && n >= 1 && n <= 31 ? n : null
}

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate()
}

function buildYmd(year: number, month: number, day: number) {
  const dim = daysInMonth(year, month)
  const d = Math.min(Math.max(day, 1), dim)
  return `${year}-${pad2(month)}-${pad2(d)}`
}

/** 정산년월 + 구독기준 일(日)로 정산기간 산출 (시작일 > 종료일이면 시작은 전월) */
function buildPeriodFromCohortDays(
  year: number,
  month: number,
  startDay: number | null,
  endDay: number | null
): { start?: string; end?: string } {
  const result: { start?: string; end?: string } = {}
  if (endDay) result.end = buildYmd(year, month, endDay)
  if (startDay) {
    if (endDay && startDay > endDay) {
      let y = year
      let m = month - 1
      if (m < 1) {
        m = 12
        y -= 1
      }
      result.start = buildYmd(y, m, startDay)
    } else {
      result.start = buildYmd(year, month, startDay)
    }
  }
  return result
}

/** 구독료에서 부가세 10% 제외 (사용자별 매출과 동일) */
function getNetSubscriptionFee(fee: number) {
  return Math.round(Number(fee || 0) / 1.1)
}

/** 순이익 = 총매출의 30% */
function getNetProfit(totalSales: number) {
  return Math.round(Number(totalSales || 0) * 0.3)
}

function getSortValue(row: SettlementRow, field: SortField): string | number {
  switch (field) {
    case 'cohort_name':
      return (row.cohort_name || '').toLowerCase()
    case 'settle_year':
      return Number(row.settle_year) || 0
    case 'settle_month':
      return Number(row.settle_month) || 0
    case 'period':
      return `${formatDateOnly(row.period_start)}|${formatDateOnly(row.period_end)}`
    case 'user_name':
      return (row.user_name || '').toLowerCase()
    case 'user_id':
      return (row.user_id || '').toLowerCase()
    case 'total_sales':
      return Number(row.total_sales) || 0
    case 'net_profit':
      return getNetProfit(row.total_sales)
    case 'subscription_fee':
      return Number(row.subscription_fee) || 0
    case 'refund_amount':
      return Number(row.refund_amount) || 0
    case 'net_subscription_fee':
      return getNetSubscriptionFee(row.subscription_fee)
    default:
      return 0
  }
}

function SubscriptionSettlementPage() {
  const { showAlert, showConfirm } = useAlert()
  const now = new Date()

  const [settleCohortSeq, setSettleCohortSeq] = useState<number | ''>('')
  const [settleYear, setSettleYear] = useState(now.getFullYear())
  const [settleMonth, setSettleMonth] = useState(now.getMonth() + 1)
  const [periodStart, setPeriodStart] = useState(() => {
    const d = new Date(now.getFullYear(), now.getMonth(), 1)
    return toDateInputValue(d)
  })
  const [periodEnd, setPeriodEnd] = useState(() => toDateInputValue(now))

  const [listCohortSeq, setListCohortSeq] = useState<number | ''>('')
  const [listYear, setListYear] = useState<number | ''>(now.getFullYear())
  const [listMonth, setListMonth] = useState<number | ''>(now.getMonth() + 1)
  const [userKeyword, setUserKeyword] = useState('')

  const [cohorts, setCohorts] = useState<CohortOption[]>([])
  const [rows, setRows] = useState<SettlementRow[]>([])
  const [loading, setLoading] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [sortField, setSortField] = useState<SortField | null>(null)
  const [sortOrder, setSortOrder] = useState<SortOrder>(null)

  const yearOptions = Array.from({ length: 8 }, (_, i) => now.getFullYear() - i)
  const monthOptions = Array.from({ length: 12 }, (_, i) => i + 1)

  useEffect(() => {
    loadCohorts()
  }, [])

  useEffect(() => {
    loadList()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listCohortSeq, listYear, listMonth])

  const loadCohorts = async () => {
    try {
      const response = await fetch(COHORT_API_URL)
      const result = await response.json()
      if (result.success) {
        setCohorts(
          (result.data || []).map((row: {
            seq: number
            cohort_name: string
            sub_base_start?: number | string | null
            sub_base_end?: number | string | null
            sub_fee?: number
          }) => ({
            seq: row.seq,
            cohort_name: row.cohort_name,
            sub_base_start: parseCohortDay(row.sub_base_start),
            sub_base_end: parseCohortDay(row.sub_base_end),
            sub_fee: Number(row.sub_fee || 0)
          }))
        )
      }
    } catch (error) {
      console.error('기수 목록 조회 오류:', error)
    }
  }

  const applyCohortPeriod = (cohort: CohortOption, year: number, month: number) => {
    const period = buildPeriodFromCohortDays(
      year,
      month,
      parseCohortDay(cohort.sub_base_start),
      parseCohortDay(cohort.sub_base_end)
    )
    if (period.start) setPeriodStart(period.start)
    if (period.end) setPeriodEnd(period.end)
  }

  const handleCohortChange = (value: string) => {
    const seq = value ? Number(value) : ''
    setSettleCohortSeq(seq)
    if (!seq) return
    const selected = cohorts.find((c) => c.seq === seq)
    if (!selected) return
    applyCohortPeriod(selected, settleYear, settleMonth)
  }

  const loadList = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (listCohortSeq) params.append('cohortSeq', String(listCohortSeq))
      if (listYear) params.append('settleYear', String(listYear))
      if (listMonth) params.append('settleMonth', String(listMonth))
      if (userKeyword.trim()) params.append('userName', userKeyword.trim())

      const url = params.toString() ? `${API_URL}?${params}` : API_URL
      const response = await fetch(url)
      const result = await response.json()
      if (result.success) {
        setRows(result.data || [])
      } else {
        await showAlert(result.message || '정산 목록 조회에 실패했습니다.')
      }
    } catch (error) {
      console.error('구독료정산 목록 조회 오류:', error)
      await showAlert('정산 목록 조회 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  /** 오름차순 → 내림차순 → 정렬제거 */
  const handleSort = (field: SortField) => {
    if (sortField !== field) {
      setSortField(field)
      setSortOrder('asc')
      return
    }
    if (sortOrder === 'asc') {
      setSortOrder('desc')
      return
    }
    if (sortOrder === 'desc') {
      setSortField(null)
      setSortOrder(null)
      return
    }
    setSortField(field)
    setSortOrder('asc')
  }

  const getSortIcon = (field: SortField) => {
    if (sortField !== field || !sortOrder) return '↕'
    return sortOrder === 'asc' ? '↑' : '↓'
  }

  const sortedRows = useMemo(() => {
    if (!sortField || !sortOrder) return rows
    const sorted = [...rows]
    sorted.sort((a, b) => {
      const av = getSortValue(a, sortField)
      const bv = getSortValue(b, sortField)
      let cmp = 0
      if (typeof av === 'number' && typeof bv === 'number') {
        cmp = av - bv
      } else {
        cmp = String(av).localeCompare(String(bv), 'ko')
      }
      return sortOrder === 'asc' ? cmp : -cmp
    })
    return sorted
  }, [rows, sortField, sortOrder])

  const handleSettle = async () => {
    if (!settleCohortSeq) {
      await showAlert('기수를 선택해주세요.')
      return
    }
    if (!settleYear || !settleMonth || !periodStart || !periodEnd) {
      await showAlert('정산월과 정산기간을 모두 선택해주세요.')
      return
    }
    if (periodStart > periodEnd) {
      await showAlert('정산기간 시작일이 종료일보다 클 수 없습니다.')
      return
    }

    const cohortName = cohorts.find((c) => c.seq === settleCohortSeq)?.cohort_name || ''
    const ok = await showConfirm(
      `기수: ${cohortName}\n${settleYear}년 ${settleMonth}월\n기간: ${periodStart} ~ ${periodEnd}\n\n정산을 실행하시겠습니까?`
    )
    if (!ok) return

    try {
      setProcessing(true)
      const response = await fetch(`${API_URL}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cohortSeq: settleCohortSeq,
          settleYear,
          settleMonth,
          periodStart,
          periodEnd
        })
      })
      const result = await response.json()
      if (result.success) {
        await showAlert(result.message || '정산이 완료되었습니다.')
        setListCohortSeq(settleCohortSeq)
        setListYear(settleYear)
        setListMonth(settleMonth)
        setUserKeyword('')
        try {
          setLoading(true)
          const params = new URLSearchParams()
          params.append('cohortSeq', String(settleCohortSeq))
          params.append('settleYear', String(settleYear))
          params.append('settleMonth', String(settleMonth))
          const listRes = await fetch(`${API_URL}?${params}`)
          const listResult = await listRes.json()
          if (listResult.success) setRows(listResult.data || [])
        } finally {
          setLoading(false)
        }
      } else {
        await showAlert(result.message || '정산에 실패했습니다.')
      }
    } catch (error) {
      console.error('구독료정산 실행 오류:', error)
      await showAlert('정산 실행 중 오류가 발생했습니다.')
    } finally {
      setProcessing(false)
    }
  }

  const handleCancel = async () => {
    if (!settleCohortSeq) {
      await showAlert('기수를 선택해주세요.')
      return
    }
    if (!settleYear || !settleMonth || !periodStart || !periodEnd) {
      await showAlert('정산월과 정산기간을 모두 선택해주세요.')
      return
    }

    const cohortName = cohorts.find((c) => c.seq === settleCohortSeq)?.cohort_name || ''
    const ok = await showConfirm(
      `기수: ${cohortName}\n${settleYear}년 ${settleMonth}월\n기간: ${periodStart} ~ ${periodEnd}\n\n해당 정산 내역을 모두 삭제(초기화)하시겠습니까?`
    )
    if (!ok) return

    try {
      setProcessing(true)
      const response = await fetch(`${API_URL}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cohortSeq: settleCohortSeq,
          settleYear,
          settleMonth,
          periodStart,
          periodEnd
        })
      })

      let result: { success?: boolean; message?: string } = {}
      try {
        result = await response.json()
      } catch {
        await showAlert(
          response.status === 404
            ? '정산취소 API를 찾을 수 없습니다. 백엔드 배포/재시작 후 다시 시도해주세요.'
            : `정산취소 중 오류가 발생했습니다. (HTTP ${response.status})`
        )
        return
      }

      if (result.success) {
        await showAlert(result.message || '정산이 취소되었습니다.')
        await loadList()
      } else {
        await showAlert(result.message || '정산취소에 실패했습니다.')
      }
    } catch (error) {
      console.error('구독료정산 취소 오류:', error)
      await showAlert('정산취소 중 오류가 발생했습니다.')
    } finally {
      setProcessing(false)
    }
  }

  const handleSearch = () => {
    loadList()
  }

  const resetAndLoad = async () => {
    const year = now.getFullYear()
    const month = now.getMonth() + 1
    setListCohortSeq('')
    setListYear(year)
    setListMonth(month)
    setUserKeyword('')
    try {
      setLoading(true)
      const params = new URLSearchParams()
      params.append('settleYear', String(year))
      params.append('settleMonth', String(month))
      const response = await fetch(`${API_URL}?${params}`)
      const result = await response.json()
      if (result.success) setRows(result.data || [])
    } finally {
      setLoading(false)
    }
  }

  const totalSalesSum = rows.reduce((s, r) => s + Number(r.total_sales || 0), 0)
  const netProfitSum = rows.reduce((s, r) => s + getNetProfit(r.total_sales), 0)
  const feeSum = rows.reduce((s, r) => s + Number(r.subscription_fee || 0), 0)
  const refundSum = rows.reduce((s, r) => s + Number(r.refund_amount || 0), 0)
  const netFeeSum = rows.reduce((s, r) => s + getNetSubscriptionFee(r.subscription_fee), 0)

  return (
    <div className="subscription-settlement-page">
      <div className="subscription-settlement-header">
        <h1 className="page-title">
          <span className="page-title-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
              <path d="M7 2h10a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm0 2v4h10V4H7zm1 6v2h2v-2H8zm4 0v2h2v-2h-2zm4 0v2h2v-2h-2zM8 14v2h2v-2H8zm4 0v2h2v-2h-2zm4 0v2h2v-2h-2zM8 18v2h2v-2H8zm4 0v2h2v-2h-2zm4 0v2h2v-2h-2z" />
            </svg>
          </span>
          구독료정산
        </h1>
      </div>

      <div className="settlement-form-card">
        <h2 className="form-title">정산 실행</h2>
        <div className="settlement-form-grid">
          <div className="settlement-field">
            <label>기수</label>
            <select
              value={settleCohortSeq}
              onChange={(e) => handleCohortChange(e.target.value)}
              disabled={processing}
            >
              <option value="">선택하세요</option>
              {cohorts.map((c) => (
                <option key={c.seq} value={c.seq}>{c.cohort_name}</option>
              ))}
            </select>
          </div>
          <div className="settlement-field">
            <label>정산년</label>
            <select
              value={settleYear}
              onChange={(e) => {
                const year = Number(e.target.value)
                setSettleYear(year)
                if (settleCohortSeq) {
                  const selected = cohorts.find((c) => c.seq === settleCohortSeq)
                  if (selected) applyCohortPeriod(selected, year, settleMonth)
                }
              }}
              disabled={processing}
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>{y}년</option>
              ))}
            </select>
          </div>
          <div className="settlement-field">
            <label>정산월</label>
            <select
              value={settleMonth}
              onChange={(e) => {
                const month = Number(e.target.value)
                setSettleMonth(month)
                if (settleCohortSeq) {
                  const selected = cohorts.find((c) => c.seq === settleCohortSeq)
                  if (selected) applyCohortPeriod(selected, settleYear, month)
                }
              }}
              disabled={processing}
            >
              {monthOptions.map((m) => (
                <option key={m} value={m}>{m}월</option>
              ))}
            </select>
          </div>
          <div className="settlement-field">
            <label>정산기간 시작</label>
            <input
              type="date"
              value={periodStart}
              onChange={(e) => setPeriodStart(e.target.value)}
              disabled={processing}
            />
          </div>
          <div className="settlement-field">
            <label>정산기간 종료</label>
            <input
              type="date"
              value={periodEnd}
              onChange={(e) => setPeriodEnd(e.target.value)}
              disabled={processing}
            />
          </div>
        </div>

        <div className="settlement-actions">
          <button type="button" className="settle-run-btn" onClick={handleSettle} disabled={processing}>
            {processing ? '처리 중...' : '정산'}
          </button>
          <button type="button" className="settle-cancel-btn" onClick={handleCancel} disabled={processing}>
            정산취소
          </button>
        </div>
        <p className="settlement-hint">
          선택한 기수의 사용자(사용여부 &apos;사용&apos;)만 대상으로 정산기간 총매출/구독료를 계산합니다.
          환급금 = 기수 구독료(없으면 기준정보 구독료) − 계산 구독료.
          기수 선택 시 구독기준 시작/종료일(일)과 정산년월로 정산기간이 반영됩니다.
        </p>
      </div>

      <div className="settlement-list-card">
        <div className="settlement-list-header">
          <h3>구독료정산 목록 ({rows.length}건)</h3>
          <div className="settlement-filter">
            <label>기수</label>
            <select
              value={listCohortSeq}
              onChange={(e) => setListCohortSeq(e.target.value ? Number(e.target.value) : '')}
            >
              <option value="">전체</option>
              {cohorts.map((c) => (
                <option key={c.seq} value={c.seq}>{c.cohort_name}</option>
              ))}
            </select>
            <label>년</label>
            <select value={listYear} onChange={(e) => setListYear(e.target.value ? Number(e.target.value) : '')}>
              <option value="">전체</option>
              {yearOptions.map((y) => (
                <option key={y} value={y}>{y}년</option>
              ))}
            </select>
            <label>월</label>
            <select value={listMonth} onChange={(e) => setListMonth(e.target.value ? Number(e.target.value) : '')}>
              <option value="">전체</option>
              {monthOptions.map((m) => (
                <option key={m} value={m}>{m}월</option>
              ))}
            </select>
            <label>사용자</label>
            <input
              type="text"
              value={userKeyword}
              onChange={(e) => setUserKeyword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="사용자명/ID"
            />
            <button type="button" className="settle-search-btn" onClick={handleSearch}>검색</button>
            <button type="button" className="settle-reset-btn" onClick={resetAndLoad}>초기화</button>
          </div>
        </div>

        <div className="settlement-summary">
          <span className="summary-item">총매출 합계: <strong>{formatAmount(totalSalesSum)}</strong></span>
          <span className="summary-item">순이익 합계: <strong>{formatAmount(netProfitSum)}</strong></span>
          <span className="summary-item">구독료 합계: <strong>{formatAmount(feeSum)}</strong></span>
          <span className="summary-item">환급금 합계: <strong>{formatAmount(refundSum)}</strong></span>
          <span className="summary-item">실구독료 합계: <strong>{formatAmount(netFeeSum)}</strong></span>
        </div>

        <div className="settlement-table-wrapper">
          <table className="settlement-table">
            <thead>
              <tr>
                <th className="center-cell">순번</th>
                <th
                  className={`center-cell sortable ${sortField === 'cohort_name' ? 'sorted' : ''}`}
                  onClick={() => handleSort('cohort_name')}
                >
                  기수명 <span className="sort-icon">{getSortIcon('cohort_name')}</span>
                </th>
                <th
                  className={`center-cell sortable ${sortField === 'settle_year' ? 'sorted' : ''}`}
                  onClick={() => handleSort('settle_year')}
                >
                  년 <span className="sort-icon">{getSortIcon('settle_year')}</span>
                </th>
                <th
                  className={`center-cell sortable ${sortField === 'settle_month' ? 'sorted' : ''}`}
                  onClick={() => handleSort('settle_month')}
                >
                  월 <span className="sort-icon">{getSortIcon('settle_month')}</span>
                </th>
                <th
                  className={`center-cell sortable ${sortField === 'period' ? 'sorted' : ''}`}
                  onClick={() => handleSort('period')}
                >
                  정산기간 <span className="sort-icon">{getSortIcon('period')}</span>
                </th>
                <th
                  className={`center-cell sortable ${sortField === 'user_name' ? 'sorted' : ''}`}
                  onClick={() => handleSort('user_name')}
                >
                  사용자명 <span className="sort-icon">{getSortIcon('user_name')}</span>
                </th>
                <th
                  className={`center-cell sortable ${sortField === 'user_id' ? 'sorted' : ''}`}
                  onClick={() => handleSort('user_id')}
                >
                  사용자ID <span className="sort-icon">{getSortIcon('user_id')}</span>
                </th>
                <th
                  className={`sortable ${sortField === 'total_sales' ? 'sorted' : ''}`}
                  onClick={() => handleSort('total_sales')}
                >
                  총매출 <span className="sort-icon">{getSortIcon('total_sales')}</span>
                </th>
                <th
                  className={`sortable ${sortField === 'net_profit' ? 'sorted' : ''}`}
                  onClick={() => handleSort('net_profit')}
                >
                  순이익 <span className="sort-icon">{getSortIcon('net_profit')}</span>
                </th>
                <th
                  className={`sortable ${sortField === 'subscription_fee' ? 'sorted' : ''}`}
                  onClick={() => handleSort('subscription_fee')}
                >
                  구독료 <span className="sort-icon">{getSortIcon('subscription_fee')}</span>
                </th>
                <th
                  className={`sortable ${sortField === 'refund_amount' ? 'sorted' : ''}`}
                  onClick={() => handleSort('refund_amount')}
                >
                  환급금 <span className="sort-icon">{getSortIcon('refund_amount')}</span>
                </th>
                <th
                  className={`header-net-fee sortable ${sortField === 'net_subscription_fee' ? 'sorted' : ''}`}
                  onClick={() => handleSort('net_subscription_fee')}
                >
                  실구독료 <span className="sort-icon">{getSortIcon('net_subscription_fee')}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedRows.length === 0 ? (
                <tr>
                  <td colSpan={12} className="no-data">
                    {loading ? '로딩 중...' : '정산 내역이 없습니다.'}
                  </td>
                </tr>
              ) : (
                sortedRows.map((row, index) => (
                  <tr key={row.seq}>
                    <td className="center-cell">{index + 1}</td>
                    <td className="center-cell">{row.cohort_name || '-'}</td>
                    <td className="center-cell">{row.settle_year}</td>
                    <td className="center-cell">{row.settle_month}</td>
                    <td className="center-cell">
                      {formatDateOnly(row.period_start)} ~ {formatDateOnly(row.period_end)}
                    </td>
                    <td className="center-cell">{row.user_name || '-'}</td>
                    <td className="center-cell">{row.user_id}</td>
                    <td className="amount-cell">{formatAmount(row.total_sales)}</td>
                    <td className="amount-cell">{formatAmount(getNetProfit(row.total_sales))}</td>
                    <td className="amount-cell">{formatAmount(row.subscription_fee)}</td>
                    <td className={`amount-cell refund-cell ${row.refund_amount > 0 ? 'positive' : ''}`}>
                      {formatAmount(row.refund_amount)}
                    </td>
                    <td className="amount-cell net-fee-cell">
                      {formatAmount(getNetSubscriptionFee(row.subscription_fee))}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default SubscriptionSettlementPage
