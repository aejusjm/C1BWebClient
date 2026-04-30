// 상품등록 현황 (사용자·스토어별 스마트스토어/쿠팡 등록 건수)
import { useState, useEffect, useMemo } from 'react'
import { useUser } from '../contexts/UserContext'
import { useAlert } from '../contexts/AlertContext'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import './UserSalesStatsPage.css'
import './UploadProductStatsPage.css'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'
const API_URL = `${API_BASE}/api/stats`

/** 테스트계정 제외 시 제외할 user_id (사용자별 매출과 동일) */
const EXCLUDED_TEST_USER_IDS = new Set(['user1', 'user2', 'user3', 'ybin583', 'admin', 'payuser'])

interface FlatRow {
  user_id: string
  user_name: string
  store_idx: number | string
  smartsotre_cnt: number
  cupang_cnt: number
}

interface PivotedRow {
  user_id: string
  user_name: string
  ssByStore: Record<string, number>
  cpByStore: Record<string, number>
  ssTotal: number
  cpTotal: number
}

function sortStoreKeys(keys: string[]): string[] {
  return [...keys].sort((a, b) => {
    const na = Number(a)
    const nb = Number(b)
    if (!Number.isNaN(na) && !Number.isNaN(nb) && a === String(na) && b === String(nb)) {
      return na - nb
    }
    return a.localeCompare(b, 'ko', { numeric: true })
  })
}

function UploadProductStatsPage() {
  const { userInfo } = useUser()
  const { showAlert } = useAlert()

  const [dateFilter, setDateFilter] = useState('all')
  const [userName, setUserName] = useState('')
  const [useCustomDate, setUseCustomDate] = useState(false)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const [showDateModal, setShowDateModal] = useState(false)
  const [tempStartDate, setTempStartDate] = useState<Date | null>(null)
  const [tempEndDate, setTempEndDate] = useState<Date | null>(null)

  const [rawRows, setRawRows] = useState<FlatRow[]>([])
  const [loading, setLoading] = useState(false)
  const [excludeTestAccounts, setExcludeTestAccounts] = useState(true)

  const [sortField, setSortField] = useState('user_name')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')

  const formatDateToString = (date: Date): string => {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }

  const openDateModal = () => {
    const today = new Date()
    if (startDate && endDate) {
      setTempStartDate(new Date(startDate))
      setTempEndDate(new Date(endDate))
    } else {
      setTempStartDate(today)
      setTempEndDate(today)
    }
    setShowDateModal(true)
  }

  const closeDateModal = () => {
    setShowDateModal(false)
    setTempStartDate(null)
    setTempEndDate(null)
  }

  const handleCustomDateApply = async () => {
    if (!tempStartDate || !tempEndDate) {
      await showAlert('시작일과 종료일을 모두 선택해주세요.')
      return
    }
    if (tempStartDate > tempEndDate) {
      await showAlert('시작일은 종료일보다 이전이어야 합니다.')
      return
    }
    setStartDate(formatDateToString(tempStartDate))
    setEndDate(formatDateToString(tempEndDate))
    setUseCustomDate(true)
    setShowDateModal(false)
  }

  const handleDateFilterChange = (filter: string) => {
    setDateFilter(filter)
    setUseCustomDate(false)
  }

  const loadStats = async () => {
    setLoading(true)
    try {
      let url = `${API_URL}/upload-product?dateFilter=${dateFilter}`
      if (userName.trim()) {
        url += `&userName=${encodeURIComponent(userName.trim())}`
      }
      if (dateFilter !== 'all' && useCustomDate && startDate && endDate) {
        url += `&startDate=${startDate}&endDate=${endDate}`
      }
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      const result = await response.json()
      if (result.success) {
        setRawRows(result.data || [])
      } else {
        setRawRows([])
      }
    } catch (e) {
      console.error('상품등록 현황 로드 오류:', e)
      await showAlert('데이터를 불러오는 중 오류가 발생했습니다.')
      setRawRows([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (userInfo?.userId) {
      loadStats()
    }
  }, [dateFilter, useCustomDate, startDate, endDate, userInfo?.userId])

  const { storeKeys, rows } = useMemo(() => {
    const inputRows = excludeTestAccounts
      ? rawRows.filter((r) => !EXCLUDED_TEST_USER_IDS.has(r.user_id))
      : rawRows

    const keySet = new Set<string>()
    for (const r of inputRows) {
      keySet.add(String(r.store_idx))
    }
    const storeKeys = sortStoreKeys([...keySet])

    const byUser = new Map<string, { user_id: string; user_name: string; ss: Record<string, number>; cp: Record<string, number> }>()
    for (const r of inputRows) {
      const k = String(r.store_idx)
      const ss = Number(r.smartsotre_cnt) || 0
      const cp = Number(r.cupang_cnt) || 0
      if (!byUser.has(r.user_id)) {
        byUser.set(r.user_id, { user_id: r.user_id, user_name: r.user_name, ss: {}, cp: {} })
      }
      const u = byUser.get(r.user_id)!
      u.user_name = r.user_name
      u.ss[k] = (u.ss[k] || 0) + ss
      u.cp[k] = (u.cp[k] || 0) + cp
    }

    const rows: PivotedRow[] = []
    for (const u of byUser.values()) {
      let ssTotal = 0
      let cpTotal = 0
      for (const sk of storeKeys) {
        const sv = u.ss[sk] || 0
        const cv = u.cp[sk] || 0
        ssTotal += sv
        cpTotal += cv
      }
      rows.push({
        user_id: u.user_id,
        user_name: u.user_name,
        ssByStore: u.ss,
        cpByStore: u.cp,
        ssTotal,
        cpTotal
      })
    }
    return { storeKeys, rows }
  }, [rawRows, excludeTestAccounts])

  const comparePivoted = (a: PivotedRow, b: PivotedRow, field: string, order: 'asc' | 'desc'): number => {
    const m = order === 'asc' ? 1 : -1
    if (field === 'user_name') {
      const c = a.user_name.localeCompare(b.user_name, 'ko')
      if (c !== 0) return m * c
      return a.user_id.localeCompare(b.user_id, 'ko')
    }
    if (field === 'ssTotal') {
      const d = a.ssTotal - b.ssTotal
      if (d !== 0) return m * d
      return a.user_id.localeCompare(b.user_id, 'ko')
    }
    if (field === 'cpTotal') {
      const d = a.cpTotal - b.cpTotal
      if (d !== 0) return m * d
      return a.user_id.localeCompare(b.user_id, 'ko')
    }
    if (field.startsWith('ss:')) {
      const k = field.slice(3)
      const d = (a.ssByStore[k] ?? 0) - (b.ssByStore[k] ?? 0)
      if (d !== 0) return m * d
      return a.user_id.localeCompare(b.user_id, 'ko')
    }
    if (field.startsWith('cp:')) {
      const k = field.slice(3)
      const d = (a.cpByStore[k] ?? 0) - (b.cpByStore[k] ?? 0)
      if (d !== 0) return m * d
      return a.user_id.localeCompare(b.user_id, 'ko')
    }
    return a.user_id.localeCompare(b.user_id, 'ko')
  }

  const displayRows = useMemo(() => {
    const list = [...rows]
    list.sort((a, b) => comparePivoted(a, b, sortField, sortOrder))
    return list
  }, [rows, sortField, sortOrder])

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder(o => (o === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortOrder('desc')
    }
  }

  const getSortIcon = (field: string) => {
    if (sortField !== field) return '↕️'
    return sortOrder === 'asc' ? '↑' : '↓'
  }

  const handleSearch = () => {
    loadStats()
  }

  const formatCount = (n: number) => n.toLocaleString('ko-KR')

  const storeColspan = storeKeys.length + 1

  return (
    <div className="user-sales-stats-page upload-product-stats-page">
      <div className="page-header">
        <h1 className="page-title">📦 상품등록 현황</h1>
      </div>

      <div className="search-section">
        <div className="date-filters">
          <button
            type="button"
            className={dateFilter === 'all' && !useCustomDate ? 'active' : ''}
            onClick={() => handleDateFilterChange('all')}
          >
            전체
          </button>
          <button
            type="button"
            className={dateFilter === 'today' && !useCustomDate ? 'active' : ''}
            onClick={() => handleDateFilterChange('today')}
          >
            오늘
          </button>
          <button
            type="button"
            className={dateFilter === 'yesterday' && !useCustomDate ? 'active' : ''}
            onClick={() => handleDateFilterChange('yesterday')}
          >
            어제
          </button>
          <button
            type="button"
            className={dateFilter === 'thisWeek' && !useCustomDate ? 'active' : ''}
            onClick={() => handleDateFilterChange('thisWeek')}
          >
            이번주
          </button>
          <button
            type="button"
            className={dateFilter === 'lastWeek' && !useCustomDate ? 'active' : ''}
            onClick={() => handleDateFilterChange('lastWeek')}
          >
            지난주
          </button>
          <button
            type="button"
            className={dateFilter === 'thisMonth' && !useCustomDate ? 'active' : ''}
            onClick={() => handleDateFilterChange('thisMonth')}
          >
            이번달
          </button>
          <button
            type="button"
            className={dateFilter === 'lastMonth' && !useCustomDate ? 'active' : ''}
            onClick={() => handleDateFilterChange('lastMonth')}
          >
            지난달
          </button>
          <button
            type="button"
            className={`date-picker-btn ${useCustomDate ? 'active' : ''}`}
            onClick={openDateModal}
          >
            📅 기간선택
          </button>
          {useCustomDate && startDate && endDate && (
            <span className="selected-date-range">
              {startDate} ~ {endDate}
            </span>
          )}
        </div>

        <div className="filter-divider" />

        <div className="filter-section">
          <span className="filter-label">제외:</span>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={excludeTestAccounts}
              onChange={e => setExcludeTestAccounts(e.target.checked)}
            />
            <span className="checkbox-text">테스트계정</span>
          </label>
        </div>

        <div className="filter-divider" />

        <div className="search-group">
          <span className="filter-label">사용자:</span>
          <input
            type="text"
            className="user-search-input"
            placeholder="이름 입력"
            value={userName}
            onChange={e => setUserName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
          />
          <button type="button" className="search-btn" onClick={handleSearch}>
            🔍 검색
          </button>
        </div>
      </div>

      <div className="stats-table-container">
        {loading ? (
          <div className="loading-message">데이터를 불러오는 중입니다...</div>
        ) : rows.length === 0 ? (
          <div className="no-data-message">조회된 데이터가 없습니다.</div>
        ) : (
          <table className="stats-table upload-product-stats-table">
            <thead>
              <tr className="header-row-1">
                <th rowSpan={2} className="header-basic">
                  순번
                </th>
                <th rowSpan={2} className="header-basic">
                  사용자ID
                </th>
                <th
                  rowSpan={2}
                  className="header-basic sortable"
                  onClick={() => handleSort('user_name')}
                >
                  이름 {getSortIcon('user_name')}
                </th>
                <th colSpan={storeColspan} className="header-group-smartstore">
                  스마트스토어
                </th>
                <th colSpan={storeColspan} className="header-group-coupang">
                  쿠팡
                </th>
              </tr>
              <tr className="header-row-2">
                {storeKeys.map((sk, i) => {
                  const sf = `ss:${sk}`
                  return (
                    <th
                      key={`ss-${sk}`}
                      className="header-sub-smartstore sortable"
                      onClick={() => handleSort(sf)}
                    >
                      스토어{i + 1} {getSortIcon(sf)}
                    </th>
                  )
                })}
                <th
                  className="header-total-ss platform-total sortable"
                  onClick={() => handleSort('ssTotal')}
                >
                  합계 {getSortIcon('ssTotal')}
                </th>
                {storeKeys.map((sk, i) => {
                  const sf = `cp:${sk}`
                  return (
                    <th
                      key={`cp-${sk}`}
                      className="header-sub-coupang sortable"
                      onClick={() => handleSort(sf)}
                    >
                      스토어{i + 1} {getSortIcon(sf)}
                    </th>
                  )
                })}
                <th
                  className="header-total-c platform-total sortable"
                  onClick={() => handleSort('cpTotal')}
                >
                  합계 {getSortIcon('cpTotal')}
                </th>
              </tr>
            </thead>
            <tbody>
              {displayRows.map((row, index) => (
                <tr key={row.user_id}>
                  <td className="center">{formatCount(index + 1)}</td>
                  <td className="center">{row.user_id}</td>
                  <td className="center">{row.user_name}</td>
                  {storeKeys.map(sk => (
                    <td key={`d-ss-${sk}`} className="right cell-ss cell-num">
                      {formatCount(row.ssByStore[sk] ?? 0)}
                    </td>
                  ))}
                  <td className="right cell-ss-total cell-num">{formatCount(row.ssTotal)}</td>
                  {storeKeys.map(sk => (
                    <td key={`d-cp-${sk}`} className="right cell-cp cell-num">
                      {formatCount(row.cpByStore[sk] ?? 0)}
                    </td>
                  ))}
                  <td className="right cell-cp-total cell-num">{formatCount(row.cpTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showDateModal && (
        <div className="date-modal-overlay">
          <div className="date-modal-content">
            <div className="date-modal-header">
              <h3>기간 선택</h3>
              <button type="button" className="date-modal-close" onClick={closeDateModal}>
                ✕
              </button>
            </div>
            <div className="date-modal-body">
              <div className="date-input-group">
                <span className="date-label">시작일</span>
                <DatePicker
                  selected={tempStartDate}
                  onChange={(d: Date | null) => setTempStartDate(d)}
                  dateFormat="yyyy-MM-dd"
                  dateFormatCalendar="yyyy년 M월"
                  className="date-input-modal"
                  placeholderText="시작일을 선택하세요"
                  showMonthDropdown
                  showYearDropdown
                  dropdownMode="select"
                />
              </div>
              <div className="date-input-group">
                <span className="date-label">종료일</span>
                <DatePicker
                  selected={tempEndDate}
                  onChange={(d: Date | null) => setTempEndDate(d)}
                  dateFormat="yyyy-MM-dd"
                  dateFormatCalendar="yyyy년 M월"
                  className="date-input-modal"
                  placeholderText="종료일을 선택하세요"
                  showMonthDropdown
                  showYearDropdown
                  dropdownMode="select"
                  minDate={tempStartDate || undefined}
                />
              </div>
            </div>
            <div className="date-modal-footer">
              <button type="button" className="date-modal-cancel" onClick={closeDateModal}>
                취소
              </button>
              <button type="button" className="date-modal-apply" onClick={handleCustomDateApply}>
                적용
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default UploadProductStatsPage
