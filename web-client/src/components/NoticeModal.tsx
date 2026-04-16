// 공지사항 모달 컴포넌트 - 공지사항 상세 내용을 팝업으로 표시
import './NoticeModal.css'

interface NoticeModalProps {
  notice: {
    id: number
    title: string
    date: string
    content: string
  } | null
  onClose: () => void
}

function NoticeModal({ notice, onClose }: NoticeModalProps) {
  if (!notice) return null

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <button 
          className="modal-close-btn"
          onClick={onClose}
        >
          ✕
        </button>
        <div className="detail-header">
          <h2 className="detail-title">{notice.title}</h2>
          <p className="detail-date">작성일: {notice.date}</p>
        </div>
        <div 
          className="detail-content"
          dangerouslySetInnerHTML={{ __html: notice.content }}
        />
        <button 
          className="close-detail-btn"
          onClick={onClose}
        >
          닫기
        </button>
      </div>
    </div>
  )
}

export default NoticeModal
