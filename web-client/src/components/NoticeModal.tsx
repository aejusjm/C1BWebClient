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
    <div className="notice-modal-overlay" onClick={onClose}>
      <div
        className="notice-modal-content"
        role="dialog"
        aria-labelledby="notice-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="notice-modal-close-x"
          onClick={onClose}
          aria-label="닫기"
        >
          ✕
        </button>

        <div className="notice-modal-header">
          <h2 id="notice-modal-title" className="notice-modal-title">
            {notice.title}
          </h2>
          <p className="notice-modal-date">작성일: {notice.date}</p>
        </div>

        <div
          className="notice-modal-body"
          dangerouslySetInnerHTML={{ __html: notice.content }}
        />

        <div className="notice-modal-footer">
          <button type="button" className="notice-modal-close-btn" onClick={onClose}>
            닫기
          </button>
        </div>
      </div>
    </div>
  )
}

export default NoticeModal
