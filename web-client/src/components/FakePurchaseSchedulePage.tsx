// 가구매 일정관리 페이지 컴포넌트
import { useState, useEffect } from 'react'
import { useAlert } from '../contexts/AlertContext'
import './FakePurchaseSchedulePage.css'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'
const API_URL = `${API_BASE}/api/fake-purchase-schedule`

interface GaGroup {
  seq: number
  grp_name: string
  use_yn: string
}

interface GaSchedule {
  seq: number
  grp_seq: number
  buy_date: string
  use_yn: string
  grp_name: string
}

interface ModalState {
  isOpen: boolean
  date: string | null
}

function FakePurchaseSchedulePage() {
  const { showAlert, showConfirm } = useAlert()
  
  // 가구매그룹 목록
  const [groups, setGroups] = useState<GaGroup[]>([])
  const [selectedGroup, setSelectedGroup] = useState<number>(0)
  
  // 가구매일자
  const [selectedDate, setSelectedDate] = useState<string>('')
  
  // 달력 상태
  const [currentYear, setCurrentYear] = useState<number>(new Date().getFullYear())
  const [currentMonth, setCurrentMonth] = useState<number>(new Date().getMonth() + 1)
  const [schedules, setSchedules] = useState<GaSchedule[]>([])
  
  // 모달 상태
  const [modal, setModal] = useState<ModalState>({ isOpen: false, date: null })
  const [modalSelectedGroup, setModalSelectedGroup] = useState<number>(0)
  
  const [loading, setLoading] = useState(false)

  // 그룹별 색상 매핑
  const groupColors: { [key: string]: string } = {
    '그룹1': '#ff6b6b',
    '그룹2': '#4dabf7',
    '그룹3': '#ffd43b',
    '그룹4': '#51cf66',
    '그룹5': '#a5d8ff',
  }

  // 컴포넌트 마운트 시 그룹 목록 조회
  useEffect(() => {
    loadGroups()
  }, [])

  // 월 변경 시 일정 조회
  useEffect(() => {
    loadSchedules()
  }, [currentYear, currentMonth])

  // 가구매그룹 목록 조회
  const loadGroups = async () => {
    try {
      const response = await fetch(`${API_URL}/groups`)
      const result = await response.json()
      
      if (result.success) {
        setGroups(result.data)
        if (result.data.length > 0) {
          setSelectedGroup(result.data[0].seq)
        }
      }
    } catch (error) {
      console.error('가구매그룹 목록 조회 오류:', error)
      await showAlert('가구매그룹 목록을 불러오는 중 오류가 발생했습니다.')
    }
  }

  // 월별 가구매 일정 조회
  const loadSchedules = async () => {
    try {
      setLoading(true)
      const response = await fetch(`${API_URL}?year=${currentYear}&month=${currentMonth}`)
      const result = await response.json()
      
      if (result.success) {
        setSchedules(result.data)
      }
    } catch (error) {
      console.error('가구매 일정 조회 오류:', error)
      await showAlert('가구매 일정을 불러오는 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  // 일정 저장
  const handleSave = async () => {
    if (!selectedGroup) {
      await showAlert('가구매그룹을 선택해주세요.')
      return
    }
    
    if (!selectedDate) {
      await showAlert('가구매일자를 선택해주세요.')
      return
    }

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          grp_seq: selectedGroup,
          buy_date: selectedDate,
        }),
      })

      const result = await response.json()

      if (result.success) {
        await showAlert('가구매 일정이 저장되었습니다.')
        setSelectedDate('')
        // 저장된 날짜의 월로 달력 이동
        const date = new Date(selectedDate)
        setCurrentYear(date.getFullYear())
        setCurrentMonth(date.getMonth() + 1)
        loadSchedules()
      } else {
        await showAlert(result.message || '일정 저장에 실패했습니다.')
      }
    } catch (error) {
      console.error('일정 저장 오류:', error)
      await showAlert('일정 저장 중 오류가 발생했습니다.')
    }
  }

  // 일정 삭제
  const handleDelete = async (schedule: GaSchedule) => {
    const confirmed = await showConfirm(
      `'${schedule.grp_name}' 일정을 삭제하시겠습니까?`,
      '일정 삭제 확인'
    )
    
    if (!confirmed) {
      return
    }

    try {
      const response = await fetch(`${API_URL}/${schedule.seq}`, {
        method: 'DELETE',
      })

      const result = await response.json()

      if (result.success) {
        await showAlert('가구매 일정이 삭제되었습니다.')
        loadSchedules()
      } else {
        await showAlert(result.message || '일정 삭제에 실패했습니다.')
      }
    } catch (error) {
      console.error('일정 삭제 오류:', error)
      await showAlert('일정 삭제 중 오류가 발생했습니다.')
    }
  }

  // 모달 열기
  const openModal = (day: number) => {
    const dateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    setModal({ isOpen: true, date: dateStr })
    setModalSelectedGroup(groups.length > 0 ? groups[0].seq : 0)
  }

  // 모달 닫기
  const closeModal = () => {
    setModal({ isOpen: false, date: null })
    setModalSelectedGroup(0)
  }

  // 모달에서 일정 저장
  const handleModalSave = async () => {
    if (!modalSelectedGroup || !modal.date) {
      await showAlert('그룹을 선택해주세요.')
      return
    }

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          grp_seq: modalSelectedGroup,
          buy_date: modal.date,
        }),
      })

      const result = await response.json()

      if (result.success) {
        await showAlert('가구매 일정이 저장되었습니다.')
        closeModal()
        loadSchedules()
      } else {
        await showAlert(result.message || '일정 저장에 실패했습니다.')
      }
    } catch (error) {
      console.error('일정 저장 오류:', error)
      await showAlert('일정 저장 중 오류가 발생했습니다.')
    }
  }

  // 이전 달로 이동
  const handlePrevMonth = () => {
    if (currentMonth === 1) {
      setCurrentYear(currentYear - 1)
      setCurrentMonth(12)
    } else {
      setCurrentMonth(currentMonth - 1)
    }
  }

  // 다음 달로 이동
  const handleNextMonth = () => {
    if (currentMonth === 12) {
      setCurrentYear(currentYear + 1)
      setCurrentMonth(1)
    } else {
      setCurrentMonth(currentMonth + 1)
    }
  }

  // 달력 생성
  const generateCalendar = () => {
    const firstDay = new Date(currentYear, currentMonth - 1, 1)
    const lastDay = new Date(currentYear, currentMonth, 0)
    const daysInMonth = lastDay.getDate()
    const startDayOfWeek = firstDay.getDay() // 0: 일요일, 1: 월요일, ...

    const calendar: (number | null)[] = []
    
    // 첫 주의 빈 칸 채우기
    for (let i = 0; i < startDayOfWeek; i++) {
      calendar.push(null)
    }
    
    // 날짜 채우기
    for (let day = 1; day <= daysInMonth; day++) {
      calendar.push(day)
    }

    return calendar
  }

  // 날짜별 일정 가져오기
  const getSchedulesForDate = (day: number) => {
    const dateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return schedules.filter(s => s.buy_date.startsWith(dateStr))
  }

  const calendar = generateCalendar()
  const weeks: (number | null)[][] = []
  for (let i = 0; i < calendar.length; i += 7) {
    weeks.push(calendar.slice(i, i + 7))
  }

  return (
    <div className="fake-purchase-schedule-page">
      {/* 페이지 헤더 */}
      <div className="fake-purchase-schedule-header">
        <h1 className="page-title">📅 가구매 일정관리</h1>
      </div>

      {/* 입력 영역 */}
      <div className="schedule-input-section">
        <div className="input-row">
          <div className="input-group">
            <label className="input-label">가구매그룹</label>
            <select
              className="group-select"
              value={selectedGroup}
              onChange={(e) => setSelectedGroup(Number(e.target.value))}
            >
              <option value={0}>선택하세요</option>
              {groups.map((group) => (
                <option key={group.seq} value={group.seq}>
                  {group.grp_name}
                </option>
              ))}
            </select>
          </div>

          <div className="input-group">
            <label className="input-label">가구매일자</label>
            <input
              type="date"
              className="date-input"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </div>

          <button className="btn-primary" onClick={handleSave}>
            저장
          </button>
        </div>
      </div>

      {/* 달력 영역 */}
      <div className="calendar-section">
        <div className="calendar-header">
          <button className="month-nav-btn" onClick={handlePrevMonth}>
            &lt; {currentMonth === 1 ? 12 : currentMonth - 1}월
          </button>
          <h2 className="calendar-title">
            [{currentYear}년 {currentMonth}월]
          </h2>
          <button className="month-nav-btn" onClick={handleNextMonth}>
            {currentMonth === 12 ? 1 : currentMonth + 1}월 &gt;
          </button>
        </div>

        {loading ? (
          <div className="calendar-loading">로딩 중...</div>
        ) : (
          <table className="calendar-table">
            <thead>
              <tr>
                <th className="calendar-header-cell day-sun">일</th>
                <th className="calendar-header-cell">월</th>
                <th className="calendar-header-cell">화</th>
                <th className="calendar-header-cell">수</th>
                <th className="calendar-header-cell">목</th>
                <th className="calendar-header-cell">금</th>
                <th className="calendar-header-cell day-sat">토</th>
              </tr>
            </thead>
            <tbody>
              {weeks.map((week, weekIdx) => (
                <tr key={weekIdx}>
                  {week.map((day, dayIdx) => {
                    const daySchedules = day ? getSchedulesForDate(day) : []
                    const isToday = 
                      day !== null &&
                      currentYear === new Date().getFullYear() &&
                      currentMonth === new Date().getMonth() + 1 &&
                      day === new Date().getDate()

                    return (
                      <td
                        key={dayIdx}
                        className={`calendar-cell ${
                          dayIdx === 0 ? 'day-sun' : dayIdx === 6 ? 'day-sat' : ''
                        } ${isToday ? 'today' : ''}`}
                      >
                        {day !== null && (
                          <>
                            <div className="calendar-day-header">
                              <div className="calendar-day-number">{day}</div>
                              <button
                                className="add-schedule-btn"
                                onClick={() => openModal(day)}
                                title="일정 추가"
                              >
                                +
                              </button>
                            </div>
                            <div className="calendar-schedules">
                              {daySchedules.map((schedule, idx) => (
                                <div
                                  key={idx}
                                  className="schedule-item"
                                  style={{
                                    backgroundColor: groupColors[schedule.grp_name] || '#adb5bd',
                                  }}
                                  onClick={() => handleDelete(schedule)}
                                  title="클릭하여 삭제"
                                >
                                  {schedule.grp_name}
                                </div>
                              ))}
                            </div>
                          </>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* 그룹 선택 모달 */}
      {modal.isOpen && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>가구매 일정 추가</h3>
              <button className="modal-close-btn" onClick={closeModal}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="modal-info">
                <span className="modal-label">날짜:</span>
                <span className="modal-value">{modal.date}</span>
              </div>
              <div className="modal-group-selection">
                <label className="modal-label">가구매그룹 선택:</label>
                <div className="modal-group-list">
                  {groups.map((group) => (
                    <button
                      key={group.seq}
                      className={`modal-group-btn ${
                        modalSelectedGroup === group.seq ? 'active' : ''
                      }`}
                      style={{
                        backgroundColor:
                          modalSelectedGroup === group.seq
                            ? groupColors[group.grp_name] || '#adb5bd'
                            : 'white',
                        color: modalSelectedGroup === group.seq ? 'white' : '#333',
                        borderColor: groupColors[group.grp_name] || '#adb5bd',
                      }}
                      onClick={() => setModalSelectedGroup(group.seq)}
                    >
                      {group.grp_name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={closeModal}>
                취소
              </button>
              <button className="btn-primary" onClick={handleModalSave}>
                저장
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default FakePurchaseSchedulePage
