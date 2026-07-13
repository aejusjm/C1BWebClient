// 기수관리 페이지 - 기수 정보 CRUD
import { useEffect, useState } from 'react'
import { useAlert } from '../contexts/AlertContext'
import './CohortManagementPage.css'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'
const API_URL = `${API_BASE}/api/cohorts`

interface Cohort {
  seq: number
  cohort_name: string
  ot_date: string
  start_date: string
  end_date: string
  signup_fee: number | string
  sub_base_start: string
  sub_base_end: string
  sub_fee: number | string
  sub_notice_start: string
  sub_notice_end: string
  created_at?: string
  updated_at?: string
}

type SortableKey = keyof Cohort

function toDateInputValue(value: string | null | undefined) {
  if (!value) return ''
  const s = String(value).replace('Z', '').slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : ''
}

function formatDate(value: string | null | undefined) {
  const s = toDateInputValue(value)
  if (!s) return '-'
  try {
    return new Date(s).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).replace(/\. /g, '.').replace(/\.$/, '')
  } catch {
    return s
  }
}

function formatAmount(value: number | string | null | undefined) {
  const n = Number(value || 0)
  return `${n.toLocaleString()}원`
}

function emptyCohort(): Cohort {
  return {
    seq: 0,
    cohort_name: '',
    ot_date: '',
    start_date: '',
    end_date: '',
    signup_fee: 0,
    sub_base_start: '',
    sub_base_end: '',
    sub_fee: 0,
    sub_notice_start: '',
    sub_notice_end: ''
  }
}

function normalizeCohort(row: Cohort): Cohort {
  return {
    ...row,
    ot_date: toDateInputValue(row.ot_date),
    start_date: toDateInputValue(row.start_date),
    end_date: toDateInputValue(row.end_date),
    sub_base_start: toDateInputValue(row.sub_base_start),
    sub_base_end: toDateInputValue(row.sub_base_end),
    sub_notice_start: toDateInputValue(row.sub_notice_start),
    sub_notice_end: toDateInputValue(row.sub_notice_end),
    signup_fee: Number(row.signup_fee || 0),
    sub_fee: Number(row.sub_fee || 0)
  }
}

function CohortManagementPage() {
  const { showAlert, showConfirm } = useAlert()
  const [cohorts, setCohorts] = useState<Cohort[]>([])
  const [selected, setSelected] = useState<Cohort | null>(null)
  const [loading, setLoading] = useState(false)
  const [isEditMode, setIsEditMode] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [sortConfig, setSortConfig] = useState<{
    key: SortableKey | null
    direction: 'asc' | 'desc' | null
  }>({ key: 'start_date', direction: 'desc' })

  useEffect(() => {
    loadCohorts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadCohorts = async () => {
    try {
      setLoading(true)
      const response = await fetch(API_URL)
      const result = await response.json()
      if (result.success) {
        setCohorts((result.data || []).map((row: Cohort) => normalizeCohort(row)))
      } else {
        await showAlert(result.message || '기수 목록을 불러오지 못했습니다.')
      }
    } catch (error) {
      console.error('기수 목록 로드 오류:', error)
      await showAlert('기수 목록을 불러오는 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleAdd = () => {
    setSelected(emptyCohort())
    setIsEditMode(false)
    setShowModal(true)
  }

  const handleEdit = (row: Cohort) => {
    setSelected(normalizeCohort(row))
    setIsEditMode(true)
    setShowModal(true)
  }

  const handleDelete = async (seq: number) => {
    const confirmed = await showConfirm('정말 삭제하시겠습니까?')
    if (!confirmed) return

    try {
      const response = await fetch(`${API_URL}/${seq}`, { method: 'DELETE' })
      const result = await response.json()
      if (result.success) {
        await showAlert('삭제되었습니다.')
        loadCohorts()
      } else {
        await showAlert(result.message || '삭제 중 오류가 발생했습니다.')
      }
    } catch (error) {
      console.error('기수 삭제 오류:', error)
      await showAlert('삭제 중 오류가 발생했습니다.')
    }
  }

  const handleSave = async () => {
    if (!selected) return
    if (!selected.cohort_name.trim()) {
      await showAlert('기수명을 입력해주세요.')
      return
    }

    try {
      const url = isEditMode ? `${API_URL}/${selected.seq}` : API_URL
      const method = isEditMode ? 'PUT' : 'POST'
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...selected,
          signup_fee: Number(selected.signup_fee || 0),
          sub_fee: Number(selected.sub_fee || 0)
        })
      })
      const result = await response.json()
      if (result.success) {
        await showAlert(isEditMode ? '수정되었습니다.' : '등록되었습니다.')
        setShowModal(false)
        setSelected(null)
        loadCohorts()
      } else {
        await showAlert(result.message || '저장 중 오류가 발생했습니다.')
      }
    } catch (error) {
      console.error('기수 저장 오류:', error)
      await showAlert('저장 중 오류가 발생했습니다.')
    }
  }

  const handleModalClose = () => {
    setShowModal(false)
    setSelected(null)
  }

  const handleInputChange = (field: keyof Cohort, value: string) => {
    if (!selected) return
    setSelected({ ...selected, [field]: value })
  }

  const handleSort = (key: SortableKey) => {
    let direction: 'asc' | 'desc' | null = 'desc'
    if (sortConfig.key === key) {
      if (sortConfig.direction === 'desc') direction = 'asc'
      else if (sortConfig.direction === 'asc') direction = null
    }
    setSortConfig({ key: direction ? key : null, direction })
  }

  const getSortIcon = (key: SortableKey) => {
    if (sortConfig.key !== key || !sortConfig.direction) return ' ⇅'
    return sortConfig.direction === 'desc' ? ' ↓' : ' ↑'
  }

  const sortedCohorts = [...cohorts].sort((a, b) => {
    if (!sortConfig.key || !sortConfig.direction) return 0
    const aValue = a[sortConfig.key]
    const bValue = b[sortConfig.key]
    if (aValue === null || aValue === undefined || aValue === '') return 1
    if (bValue === null || bValue === undefined || bValue === '') return -1

    const aNum = Number(aValue)
    const bNum = Number(bValue)
    if (!Number.isNaN(aNum) && !Number.isNaN(bNum) && String(aValue) !== '' && String(bValue) !== '') {
      if (typeof aValue === 'number' || typeof bValue === 'number' || /^\d+$/.test(String(aValue))) {
        return sortConfig.direction === 'asc' ? aNum - bNum : bNum - aNum
      }
    }

    return sortConfig.direction === 'asc'
      ? String(aValue).localeCompare(String(bValue), 'ko')
      : String(bValue).localeCompare(String(aValue), 'ko')
  })

  if (loading) {
    return (
      <div className="cohort-management-page">
        <div className="cohort-page-header">
          <h1 className="page-title">🎓 기수관리</h1>
        </div>
        <div style={{ textAlign: 'center', padding: '40px' }}>
          데이터를 불러오는 중입니다...
        </div>
      </div>
    )
  }

  return (
    <div className="cohort-management-page">
      <div className="cohort-page-header">
        <h1 className="page-title">🎓 기수관리</h1>
        <button type="button" className="add-cohort-btn" onClick={handleAdd}>
          + 기수 추가
        </button>
      </div>

      <div className="cohort-content">
        <div className="cohort-grid-section">
          <table className="cohort-grid">
            <thead>
              <tr>
                <th style={{ width: '60px' }}>순번</th>
                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('cohort_name')}>
                  기수명{getSortIcon('cohort_name')}
                </th>
                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('ot_date')}>
                  OT일자{getSortIcon('ot_date')}
                </th>
                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('start_date')}>
                  시작일{getSortIcon('start_date')}
                </th>
                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('end_date')}>
                  종료일{getSortIcon('end_date')}
                </th>
                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('signup_fee')}>
                  가입비{getSortIcon('signup_fee')}
                </th>
                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('sub_base_start')}>
                  구독기준 시작일{getSortIcon('sub_base_start')}
                </th>
                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('sub_base_end')}>
                  구독기준 종료일{getSortIcon('sub_base_end')}
                </th>
                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('sub_fee')}>
                  구독료{getSortIcon('sub_fee')}
                </th>
                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('sub_notice_start')}>
                  구독공지 시작일{getSortIcon('sub_notice_start')}
                </th>
                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('sub_notice_end')}>
                  구독공지 종료일{getSortIcon('sub_notice_end')}
                </th>
                <th style={{ width: '80px' }}>수정</th>
                <th style={{ width: '80px' }}>삭제</th>
              </tr>
            </thead>
            <tbody>
              {sortedCohorts.length > 0 ? (
                sortedCohorts.map((row, index) => (
                  <tr key={row.seq}>
                    <td>{index + 1}</td>
                    <td>{row.cohort_name}</td>
                    <td>{formatDate(row.ot_date)}</td>
                    <td>{formatDate(row.start_date)}</td>
                    <td>{formatDate(row.end_date)}</td>
                    <td className="amount-cell">{formatAmount(row.signup_fee)}</td>
                    <td>{formatDate(row.sub_base_start)}</td>
                    <td>{formatDate(row.sub_base_end)}</td>
                    <td className="amount-cell">{formatAmount(row.sub_fee)}</td>
                    <td>{formatDate(row.sub_notice_start)}</td>
                    <td>{formatDate(row.sub_notice_end)}</td>
                    <td>
                      <button type="button" className="grid-btn edit-btn" onClick={() => handleEdit(row)}>
                        수정
                      </button>
                    </td>
                    <td>
                      <button type="button" className="grid-btn delete-btn" onClick={() => handleDelete(row.seq)}>
                        삭제
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={13} className="no-data-message">
                    등록된 기수가 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && selected && (
        <div className="modal-overlay">
          <div className="modal-content cohort-modal">
            <button type="button" className="modal-close-btn" onClick={handleModalClose}>
              ✕
            </button>
            <div className="modal-header">
              <h2 className="modal-title">{isEditMode ? '기수 수정' : '기수 추가'}</h2>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">기수명 <span className="required">*</span></label>
                <input
                  type="text"
                  className="form-input"
                  value={selected.cohort_name}
                  onChange={(e) => handleInputChange('cohort_name', e.target.value)}
                  placeholder="예: 1기, 2026-1기"
                />
              </div>

              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label">OT일자</label>
                  <input
                    type="date"
                    className="form-input"
                    value={selected.ot_date}
                    onChange={(e) => handleInputChange('ot_date', e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">가입비</label>
                  <input
                    type="number"
                    className="form-input"
                    value={selected.signup_fee}
                    onChange={(e) => handleInputChange('signup_fee', e.target.value)}
                    min={0}
                    step={1}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">시작일</label>
                  <input
                    type="date"
                    className="form-input"
                    value={selected.start_date}
                    onChange={(e) => handleInputChange('start_date', e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">종료일</label>
                  <input
                    type="date"
                    className="form-input"
                    value={selected.end_date}
                    onChange={(e) => handleInputChange('end_date', e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">구독기준 시작일</label>
                  <input
                    type="date"
                    className="form-input"
                    value={selected.sub_base_start}
                    onChange={(e) => handleInputChange('sub_base_start', e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">구독기준 종료일</label>
                  <input
                    type="date"
                    className="form-input"
                    value={selected.sub_base_end}
                    onChange={(e) => handleInputChange('sub_base_end', e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">구독료</label>
                  <input
                    type="number"
                    className="form-input"
                    value={selected.sub_fee}
                    onChange={(e) => handleInputChange('sub_fee', e.target.value)}
                    min={0}
                    step={1}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">구독공지 시작일</label>
                  <input
                    type="date"
                    className="form-input"
                    value={selected.sub_notice_start}
                    onChange={(e) => handleInputChange('sub_notice_start', e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">구독공지 종료일</label>
                  <input
                    type="date"
                    className="form-input"
                    value={selected.sub_notice_end}
                    onChange={(e) => handleInputChange('sub_notice_end', e.target.value)}
                  />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="modal-cancel-btn" onClick={handleModalClose}>
                취소
              </button>
              <button type="button" className="modal-save-btn" onClick={handleSave}>
                {isEditMode ? '수정' : '등록'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default CohortManagementPage
