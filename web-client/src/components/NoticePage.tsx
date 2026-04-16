// 공지사항 페이지 컴포넌트 - 전체 공지사항 목록 표시
import { useState, useEffect } from 'react'
import './NoticePage.css'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'
const API_URL = `${API_BASE}/api/notices`

interface Notice {
  seq: number
  gubun: string
  title: string
  contents: string
  fix_yn: string
  notice_type: string
  popup_yn: string
  input_date: string
  use_yn: string
  update_date: string
}

function NoticePage() {
  const [notices, setNotices] = useState<Notice[]>([])
  const [selectedNotice, setSelectedNotice] = useState<Notice | null>(null)
  const [loading, setLoading] = useState(false)

  // 공지사항 목록 로드
  useEffect(() => {
    loadNotices()
  }, [])

  const loadNotices = async () => {
    try {
      setLoading(true)
      const response = await fetch(`${API_URL}`)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const result = await response.json()
      
      if (result.success) {
        // 사용 중인 공지사항만 필터링
        const filteredNotices = result.data.filter((notice: Notice) => notice.use_yn === 'Y')
        setNotices(filteredNotices)
      }
    } catch (error) {
      console.error('공지사항 로드 오류:', error)
    } finally {
      setLoading(false)
    }
  }

  // 날짜 포맷팅
  const formatDate = (dateStr: string) => {
    if (!dateStr) return ''
    try {
      const date = new Date(dateStr)
      return date.toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).replace(/\. /g, '.').replace(/\.$/, '')
    } catch {
      return dateStr
    }
  }

  if (loading) {
    return (
      <div className="notice-page">
        <div className="notice-page-header">
          <h1 className="page-title">📢 공지사항</h1>
        </div>
        <div style={{ textAlign: 'center', padding: '40px' }}>
          데이터를 불러오는 중입니다...
        </div>
      </div>
    )
  }

  return (
    <div className="notice-page">
      <div className="notice-page-header">
        <h1 className="page-title">📢 공지사항</h1>
        <p className="page-description">중요한 공지사항을 확인하세요</p>
      </div>

      <div className="notice-content">
        {/* 공지사항 목록 */}
        <div className="notice-list-section">
          <div className="notice-list-header">
            <span className="header-title">제목</span>
            <span className="header-date">작성일</span>
          </div>
          
          {notices.length > 0 ? (
            notices.map((notice) => (
              <div 
                key={notice.seq}
                className="notice-row"
                onClick={() => setSelectedNotice(notice)}
              >
                <div className="notice-row-title">
                  {notice.fix_yn === 'Y' && <span className="notice-badge fixed">고정</span>}
                  {notice.fix_yn !== 'Y' && <span className="notice-badge">공지</span>}
                  {notice.title}
                </div>
                <div className="notice-row-date">{formatDate(notice.input_date)}</div>
              </div>
            ))
          ) : (
            <div className="no-data-message">
              등록된 공지사항이 없습니다.
            </div>
          )}
        </div>
      </div>

      {/* 팝업 모달 - 선택된 공지사항 상세 */}
      {selectedNotice && (
        <div className="modal-overlay">
          <div className="modal-content">
            <button 
              className="modal-close-btn"
              onClick={() => setSelectedNotice(null)}
            >
              ✕
            </button>
            <div className="detail-header">
              <h2 className="detail-title">
                {selectedNotice.title}
              </h2>
              <p className="detail-date">
                작성일: {formatDate(selectedNotice.input_date)}
              </p>
            </div>
            <div 
              className="detail-content"
              dangerouslySetInnerHTML={{ __html: selectedNotice.contents }}
            />
            <button 
              className="close-detail-btn"
              onClick={() => setSelectedNotice(null)}
            >
              닫기
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default NoticePage
