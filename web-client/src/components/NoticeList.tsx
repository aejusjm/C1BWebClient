// 공지사항 목록 컴포넌트 - 최근 공지사항을 표시
import { useState, useEffect } from 'react'
import './NoticeList.css'
import NoticeModal from './NoticeModal'

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

interface NoticeListProps {
  onViewAll?: () => void
}

function NoticeList({ onViewAll }: NoticeListProps) {
  const [notices, setNotices] = useState<Notice[]>([])
  const [selectedNotice, setSelectedNotice] = useState<Notice | null>(null)

  // 공지사항 목록 로드
  useEffect(() => {
    loadNotices()
  }, [])

  const loadNotices = async () => {
    try {
      console.log('공지사항 로드 시작:', `${API_URL}/list?page=1&limit=5`)
      const response = await fetch(`${API_URL}/list?page=1&limit=5`)
      
      console.log('응답 상태:', response.status)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const result = await response.json()
      console.log('공지사항 응답 데이터:', result)
      
      if (result.success) {
        console.log('받은 공지사항 개수:', result.data?.length)
        // 백엔드에서 이미 use_yn='Y'만 필터링되어 오므로 추가 필터링 불필요
        setNotices(result.data || [])
      } else {
        console.error('API 응답 실패:', result.message)
        setNotices([])
      }
    } catch (error) {
      console.error('공지사항 로드 오류:', error)
      setNotices([])
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

  return (
    <>
      <div className="notice-list-container">
        <div className="notice-header">
          <h3 className="notice-title">공지사항</h3>
          <button className="btn-more" onClick={onViewAll}>전체보기</button>
        </div>
        <ul className="notice-list">
          {notices.length > 0 ? (
            notices.map((notice) => (
              <li 
                key={notice.seq} 
                className="notice-item"
                onClick={() => setSelectedNotice(notice)}
              >
                <span className="notice-item-title">
                  {notice.fix_yn === 'Y' && <span className="notice-badge">고정</span>}
                  • {notice.title}
                </span>
                <span className="notice-item-date">{formatDate(notice.input_date)}</span>
              </li>
            ))
          ) : (
            <li className="notice-item no-data">
              <span className="notice-item-title">등록된 공지사항이 없습니다.</span>
            </li>
          )}
        </ul>
      </div>

      {/* 공지사항 상세 모달 */}
      {selectedNotice && (
        <NoticeModal 
          notice={{
            id: selectedNotice.seq,
            title: selectedNotice.title,
            date: formatDate(selectedNotice.input_date),
            content: selectedNotice.contents
          }}
          onClose={() => setSelectedNotice(null)}
        />
      )}
    </>
  )
}

export default NoticeList
