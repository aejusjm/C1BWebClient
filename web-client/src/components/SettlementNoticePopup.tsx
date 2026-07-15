// 로그인 후 이번달 구독료정산 안내 팝업
// - 기수 구독공지 시작일~종료일 안에만 표시
// - 이번달 정산 데이터가 있을 때만 표시
// - '오늘 그만보기' 체크 후 확인 시 당일 재표시 안 함
import { useEffect, useState } from 'react'
import { useUser } from '../contexts/UserContext'
import { authenticatedFetch } from '../utils/api'
import './SettlementNoticePopup.css'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'
const API_URL = `${API_BASE}/api/subscription-settlement/my-monthly-notice`
const STANDARD_INFO_URL = `${API_BASE}/api/standard-info`
const HIDDEN_KEY = 'hiddenSettlementNotice'

interface SettlementNoticeData {
  settle_year: number
  settle_month: number
  has_settlement: boolean
  period_start: string | null
  period_end: string | null
  user_id: string
  user_name: string | null
  cohort_name: string | null
  total_sales: number
  subscription_fee: number
  base_sub_fee: number
  refund_amount: number
  base_sub_amt: number
  setting_sub_fee: number
  rate_of_return: number
}

interface StandardInfoValues {
  rateOfReturn: number
  baseSubAmt: number
  subFee: number
}

function formatWon(amount: number) {
  return `${Math.round(Number(amount) || 0).toLocaleString('ko-KR')}원`
}

function formatDateOnly(value: string | null) {
  if (!value) return '-'
  return String(value).replace('Z', '').slice(0, 10)
}

function todayKey() {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function isHiddenToday(userId: string): boolean {
  try {
    const raw = localStorage.getItem(HIDDEN_KEY)
    if (!raw) return false
    const map = JSON.parse(raw) as Record<string, string>
    return map[userId] === todayKey()
  } catch {
    return false
  }
}

function hideForToday(userId: string) {
  try {
    const raw = localStorage.getItem(HIDDEN_KEY)
    const map = raw ? (JSON.parse(raw) as Record<string, string>) : {}
    map[userId] = todayKey()
    localStorage.setItem(HIDDEN_KEY, JSON.stringify(map))
  } catch (error) {
    console.error('오늘 그만보기 저장 오류:', error)
  }
}

function toPositiveNumber(value: unknown): number {
  const n = Number(value)
  return Number.isFinite(n) && n >= 0 ? n : 0
}

/** 만원 미만 절삭 (예: 719000 → 710000, 25250 → 25000) */
function truncateToManwon(amount: number): number {
  return Math.floor(Math.max(0, Number(amount) || 0) / 10000) * 10000
}

function resolveHasSettlement(data: Record<string, unknown>): boolean {
  if (data.has_settlement === true || data.has_settlement === 1 || data.has_settlement === 'true') {
    return true
  }
  if (data.has_settlement === false || data.has_settlement === 0 || data.has_settlement === 'false') {
    return false
  }
  if (data.period_start != null && String(data.period_start).trim() !== '') return true
  if (toPositiveNumber(data.total_sales) > 0) return true
  if (toPositiveNumber(data.subscription_fee) > 0) return true
  return false
}

async function fetchStandardInfo(): Promise<StandardInfoValues> {
  const empty = { rateOfReturn: 0, baseSubAmt: 0, subFee: 0 }
  try {
    const response = await fetch(STANDARD_INFO_URL)
    const result = await response.json()
    if (result.success && result.data) {
      return {
        rateOfReturn: toPositiveNumber(result.data.rateOfReturn),
        baseSubAmt: toPositiveNumber(result.data.baseSubAmt),
        subFee: toPositiveNumber(result.data.subFee)
      }
    }
  } catch (error) {
    console.error('기준정보 조회 오류:', error)
  }
  return empty
}

async function fetchMonthlyNotice(userId: string): Promise<{
  ok: boolean
  show?: boolean
  data?: Record<string, unknown>
  error?: string
}> {
  const noticeUrl = `${API_URL}?userId=${encodeURIComponent(userId)}`
  try {
    const response = await authenticatedFetch(noticeUrl)
    const result = await response.json()
    if (result.success && result.data) {
      return {
        ok: true,
        show: result.show !== false,
        data: result.data as Record<string, unknown>
      }
    }
    if (result.success && result.show === false) {
      return { ok: true, show: false, data: result.data as Record<string, unknown> | undefined }
    }
    return { ok: false, error: result.message || `HTTP ${response.status}` }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

/** 오늘(일)이 기수 구독공지 시작일~종료일 범위 안인지 */
function isDayInNoticeRange(todayDay: number, startDay: unknown, endDay: unknown): boolean {
  if (startDay == null || endDay == null) return false
  const s = Number(startDay)
  const e = Number(endDay)
  const d = Number(todayDay)
  if (!Number.isFinite(s) || !Number.isFinite(e) || !Number.isFinite(d)) return false
  if (s < 1 || s > 31 || e < 1 || e > 31 || d < 1 || d > 31) return false
  if (s <= e) return d >= s && d <= e
  return d >= s || d <= e
}

function buildNoticeFromApi(
  raw: Record<string, unknown>,
  userId: string,
  fallbackName: string | null,
  standard: StandardInfoValues
): SettlementNoticeData {
  const rate = toPositiveNumber(raw.rate_of_return) || standard.rateOfReturn
  const baseSubAmt = toPositiveNumber(raw.base_sub_amt) || standard.baseSubAmt
  const settingSubFee = toPositiveNumber(raw.setting_sub_fee) || standard.subFee
  const hasSettlement = resolveHasSettlement(raw)
  const totalSales = toPositiveNumber(raw.total_sales)
  const baseSubFee = toPositiveNumber(raw.base_sub_fee) || settingSubFee

  return {
    settle_year: Number(raw.settle_year) || new Date().getFullYear(),
    settle_month: Number(raw.settle_month) || new Date().getMonth() + 1,
    has_settlement: hasSettlement,
    period_start: (raw.period_start as string | null) ?? null,
    period_end: (raw.period_end as string | null) ?? null,
    user_id: String(raw.user_id || userId),
    user_name: (raw.user_name as string | null) ?? fallbackName,
    cohort_name: (raw.cohort_name as string | null) ?? null,
    total_sales: totalSales,
    subscription_fee: hasSettlement ? truncateToManwon(toPositiveNumber(raw.subscription_fee)) : 0,
    base_sub_fee: baseSubFee,
    refund_amount: hasSettlement ? truncateToManwon(toPositiveNumber(raw.refund_amount)) : 0,
    base_sub_amt: baseSubAmt,
    setting_sub_fee: settingSubFee,
    rate_of_return: rate
  }
}

function SettlementNoticePopup() {
  const { userInfo } = useUser()
  const [visible, setVisible] = useState(false)
  const [data, setData] = useState<SettlementNoticeData | null>(null)
  const [hideToday, setHideToday] = useState(false)

  useEffect(() => {
    const userId = userInfo?.userId?.trim()
    if (!userId) return

    let cancelled = false

    const load = async () => {
      if (isHiddenToday(userId)) return

      const standard = await fetchStandardInfo()
      if (cancelled) return

      let notice = await fetchMonthlyNotice(userId)
      if (!notice.ok && !cancelled) {
        await new Promise((r) => setTimeout(r, 400))
        if (cancelled) return
        notice = await fetchMonthlyNotice(userId)
      }
      if (cancelled) return

      if (!notice.ok || !notice.data) {
        console.warn('[구독료안내] 조회 실패:', notice.error)
        return
      }

      // API에서 구독공지 기간 외로 판단한 경우
      if (notice.show === false) {
        console.log('[구독료안내] 표시 안 함 (공지기간 외 또는 정산없음)', notice.data)
        return
      }

      const built = buildNoticeFromApi(
        notice.data,
        userId,
        userInfo.userName || null,
        standard
      )

      const todayDay = Number(notice.data.today_day) || new Date().getDate()
      const inNoticePeriod = isDayInNoticeRange(
        todayDay,
        notice.data.notice_start,
        notice.data.notice_end
      )

      console.log('[구독료안내]', {
        userId,
        has_settlement: built.has_settlement,
        in_notice_period: inNoticePeriod,
        today_day: todayDay,
        notice_start: notice.data.notice_start,
        notice_end: notice.data.notice_end,
        total_sales: built.total_sales,
        subscription_fee: built.subscription_fee
      })

      // 구독공지 기간이 아니거나, 이번달 정산 데이터가 없으면 팝업 표시 안 함
      if (!inNoticePeriod || !built.has_settlement) return

      setData(built)
      setHideToday(false)
      setVisible(true)
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [userInfo?.userId, userInfo?.userName])

  const handleClose = () => {
    const userId = userInfo?.userId?.trim()
    if (hideToday && userId) {
      hideForToday(userId)
    }
    setVisible(false)
  }

  if (!visible || !data || !data.has_settlement) return null

  const reachedThreshold = Number(data.total_sales) >= Number(data.base_sub_amt)
  const rateLabel = Number(data.rate_of_return) || 0

  return (
    <div className="settlement-notice-overlay">
      <div className="settlement-notice-content" role="dialog" aria-labelledby="settlement-notice-title">
        <button type="button" className="settlement-notice-close" onClick={handleClose} aria-label="닫기">
          ✕
        </button>
        <div className="settlement-notice-header">
          <h2 id="settlement-notice-title">
            {data.settle_year}년 {data.settle_month}월 구독료 안내
          </h2>
          <p className="settlement-notice-subtitle">
            {data.user_name || data.user_id}
            {data.cohort_name ? ` · ${data.cohort_name}` : ''}
          </p>
        </div>

        <div className="settlement-notice-body">
          <div className="settlement-notice-summary">
            <div className="settlement-notice-item">
              <span className="label">총매출</span>
              <span className="value">{formatWon(data.total_sales)}</span>
            </div>
            <div className="settlement-notice-item">
              <span className="label">구독료</span>
              <span className="value highlight">{formatWon(data.subscription_fee)}</span>
            </div>
            <div className="settlement-notice-item">
              <span className="label">환급금</span>
              <span className="value refund">{formatWon(data.refund_amount)}</span>
            </div>
          </div>

          {Number(data.refund_amount) > 0 && (
            <p className="settlement-notice-refund-hint">
              환급금은 결제 후 2일 이내에 자동 환급처리 됩니다.
            </p>
          )}

          <div className="settlement-notice-period">
            정산기간: {formatDateOnly(data.period_start)} ~ {formatDateOnly(data.period_end)}
          </div>

          <div className="settlement-notice-formula">
            <h3>구독료 계산식</h3>
            <ul>
              <li>
                총매출이 기준금액(<strong>{formatWon(data.base_sub_amt)}</strong>) 이상이면
                <br />
                구독료 = 기준 구독료(<strong>{formatWon(data.setting_sub_fee)}</strong>)
              </li>
              <li>
                기준금액 미만이면
                <br />
                구독료 = 총매출 × <strong>{rateLabel}%</strong> ÷ 2
              </li>
              <li>
                환급금 = 기준 구독료(<strong>{formatWon(data.base_sub_fee)}</strong>) − 구독료
              </li>
            </ul>
            <p className="settlement-notice-result">
              이번 정산: 총매출이 기준금액
              {reachedThreshold ? ' 이상이므로 기준 구독료가 적용' : ' 미만이므로 비율 계산식이 적용'}
              되었습니다.
            </p>
          </div>
        </div>

        <div className="settlement-notice-footer">
          <label className="settlement-notice-checkbox-label">
            <input
              type="checkbox"
              className="settlement-notice-checkbox"
              checked={hideToday}
              onChange={(e) => setHideToday(e.target.checked)}
            />
            오늘 그만보기
          </label>
          <button type="button" className="settlement-notice-confirm-btn" onClick={handleClose}>
            확인
          </button>
        </div>
      </div>
    </div>
  )
}

export default SettlementNoticePopup
