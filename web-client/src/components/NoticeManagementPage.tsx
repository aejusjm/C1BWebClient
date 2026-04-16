// 공지관리 페이지 컴포넌트 - 공지 CRUD 및 미리보기
import { useState, useEffect } from 'react'
import { useAlert } from '../contexts/AlertContext'
import './NoticeManagementPage.css'
import SimpleHtmlEditor from './SimpleHtmlEditor'

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
  update_date: string | null
}

function NoticeManagementPage() {
  const { showAlert, showConfirm } = useAlert()
  const [notices, setNotices] = useState<Notice[]>([])
  const [loading, setLoading] = useState(false)
  
  // 페이징 상태
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(20)
  
  // 모달 상태
  const [showEditModal, setShowEditModal] = useState(false)
  const [showPreviewModal, setShowPreviewModal] = useState(false)
  const [isNewNotice, setIsNewNotice] = useState(false)
  const [selectedNotice, setSelectedNotice] = useState<Notice | null>(null)
  const [editData, setEditData] = useState<Partial<Notice>>({})

  // 컴포넌트 마운트 시 공지 목록 조회
  useEffect(() => {
    loadNotices()
  }, [])

  // 공지 목록 조회
  const loadNotices = async () => {
    try {
      setLoading(true)
      const response = await fetch(API_URL)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const result = await response.json()
      
      if (result.success) {
        setNotices(result.data)
      }
    } catch (error) {
      console.error('공지 목록 조회 오류:', error)
      await showAlert('공지 목록을 불러오는 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  // 새 공지 추가 버튼
  const handleAddClick = () => {
    setIsNewNotice(true)
    setSelectedNotice(null)
    setEditData({
      gubun: '',
      title: '',
      contents: '',
      fix_yn: 'N',
      notice_type: '',
      popup_yn: 'N',
      use_yn: 'Y'
    })
    setShowEditModal(true)
  }

  // 수정 버튼 클릭
  const handleEditClick = (notice: Notice) => {
    setIsNewNotice(false)
    setSelectedNotice(notice)
    setEditData(notice)
    setShowEditModal(true)
  }

  // 미리보기 버튼 클릭
  const handlePreviewClick = (notice: Notice) => {
    setSelectedNotice(notice)
    setShowPreviewModal(true)
  }

  // 모달 닫기
  const closeEditModal = () => {
    setShowEditModal(false)
    setSelectedNotice(null)
    setEditData({})
    setIsNewNotice(false)
  }

  const closePreviewModal = () => {
    setShowPreviewModal(false)
    setSelectedNotice(null)
  }

  // 수정 데이터 변경
  const handleEditChange = (field: keyof Notice, value: any) => {
    setEditData({
      ...editData,
      [field]: value
    })
  }

  // 저장 (추가 또는 수정)
  const handleSave = async () => {
    if (!editData.title || !editData.contents) {
      await showAlert('제목과 내용을 입력해주세요.')
      return
    }

    try {
      setLoading(true)
      
      if (isNewNotice) {
        // 새 공지 추가
        const response = await fetch(API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(editData)
        })
        
        const result = await response.json()
        
        if (result.success) {
          await showAlert('공지가 등록되었습니다.')
          closeEditModal()
          loadNotices()
        } else {
          await showAlert(result.message || '등록 중 오류가 발생했습니다.')
        }
      } else {
        // 기존 공지 수정
        const response = await fetch(`${API_URL}/${selectedNotice?.seq}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(editData)
        })
        
        const result = await response.json()
        
        if (result.success) {
          await showAlert('공지가 수정되었습니다.')
          closeEditModal()
          loadNotices()
        } else {
          await showAlert(result.message || '수정 중 오류가 발생했습니다.')
        }
      }
    } catch (error) {
      console.error('공지 저장 오류:', error)
      await showAlert('저장 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  // 삭제
  const handleDelete = async (seq: number) => {
    const confirmed = await showConfirm('정말 삭제하시겠습니까?')
    if (!confirmed) return

    try {
      setLoading(true)
      const response = await fetch(`${API_URL}/${seq}`, {
        method: 'DELETE'
      })
      
      const result = await response.json()
      
      if (result.success) {
        await showAlert('공지가 삭제되었습니다.')
        loadNotices()
      } else {
        await showAlert(result.message || '삭제 중 오류가 발생했습니다.')
      }
    } catch (error) {
      console.error('공지 삭제 오류:', error)
      await showAlert('삭제 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  // 날짜 포맷팅
  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleString('ko-KR')
  }

  // 페이징 계산
  const indexOfLastItem = currentPage * itemsPerPage
  const indexOfFirstItem = indexOfLastItem - itemsPerPage
  const currentNotices = notices.slice(indexOfFirstItem, indexOfLastItem)
  const totalPages = Math.ceil(notices.length / itemsPerPage)

  // 페이지 변경
  const handlePageChange = (pageNumber: number) => {
    setCurrentPage(pageNumber)
  }

  // 페이지당 항목 수 변경
  const handleItemsPerPageChange = (newItemsPerPage: number) => {
    setItemsPerPage(newItemsPerPage)
    setCurrentPage(1)
  }

  // 페이지 번호 생성
  const getPageNumbers = () => {
    const pages = []
    const maxPagesToShow = 5
    
    let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2))
    let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1)
    
    if (endPage - startPage + 1 < maxPagesToShow) {
      startPage = Math.max(1, endPage - maxPagesToShow + 1)
    }
    
    for (let i = startPage; i <= endPage; i++) {
      pages.push(i)
    }
    
    return pages
  }

  return (
    <div className="notice-management-page">
      {/* 페이지 헤더 */}
      <div className="notice-management-page-header">
        <h1 className="page-title">📢 공지관리</h1>
        <button className="add-notice-btn" onClick={handleAddClick}>
          + 새 공지 추가
        </button>
      </div>

      {/* 공지 목록 테이블 */}
      <div className="notice-table-container">
        <div className="table-header">
          <h3>공지 목록 ({notices.length}개)</h3>
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
          <table className="notice-table">
            <thead>
              <tr>
                <th>순번</th>
                <th>공지구분</th>
                <th>제목</th>
                <th>공지유형</th>
                <th>고정</th>
                <th>팝업</th>
                <th>사용여부</th>
                <th>입력일자</th>
                <th>수정일자</th>
                <th>관리</th>
              </tr>
            </thead>
            <tbody>
              {notices.length === 0 ? (
                <tr>
                  <td colSpan={10} className="no-data">
                    {loading ? '로딩 중...' : '등록된 공지가 없습니다.'}
                  </td>
                </tr>
              ) : (
                currentNotices.map((notice, index) => (
                  <tr key={notice.seq}>
                    <td>{indexOfFirstItem + index + 1}</td>
                    <td>{notice.gubun}</td>
                    <td className="title-cell">{notice.title}</td>
                    <td>{notice.notice_type}</td>
                    <td>
                      <span className={`badge ${notice.fix_yn === 'Y' ? 'badge-yes' : 'badge-no'}`}>
                        {notice.fix_yn === 'Y' ? '고정' : '-'}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${notice.popup_yn === 'Y' ? 'badge-yes' : 'badge-no'}`}>
                        {notice.popup_yn === 'Y' ? '팝업' : '-'}
                      </span>
                    </td>
                    <td>
                      <span className={`status-badge ${notice.use_yn === 'Y' ? 'active' : 'inactive'}`}>
                        {notice.use_yn === 'Y' ? '사용' : '미사용'}
                      </span>
                    </td>
                    <td>{formatDateTime(notice.input_date)}</td>
                    <td>{formatDateTime(notice.update_date)}</td>
                    <td>
                      <div className="action-buttons">
                        <button 
                          className="preview-btn"
                          onClick={() => handlePreviewClick(notice)}
                        >
                          미리보기
                        </button>
                        <div className="action-buttons-tight">
                          <button 
                            className="edit-btn"
                            onClick={() => handleEditClick(notice)}
                          >
                            수정
                          </button>
                          <button 
                            className="delete-btn"
                            onClick={() => handleDelete(notice.seq)}
                          >
                            삭제
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* 페이징 */}
        {notices.length > 0 && (
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
              {currentPage} / {totalPages} 페이지 (총 {notices.length}개)
            </span>
          </div>
        )}
      </div>

      {/* 수정/추가 모달 */}
      {showEditModal && (
        <div className="modal-overlay">
          <div className="modal-content large-modal">
            <div className="modal-header">
              <h3 className="modal-title">{isNewNotice ? '새 공지 추가' : '공지 수정'}</h3>
              <button className="modal-close" onClick={closeEditModal}>✕</button>
            </div>

            <div className="modal-body">
              <div className="notice-form">
                {/* 공지구분 */}
                <div className="form-group">
                  <label>공지구분</label>
                  <select
                    value={editData.gubun || ''}
                    onChange={(e) => handleEditChange('gubun', e.target.value)}
                  >
                    <option value="">선택하기</option>
                    <option value="일반공지">일반공지</option>
                    <option value="긴급공지">긴급공지</option>
                  </select>
                </div>

                {/* 제목 */}
                <div className="form-group">
                  <label>제목 *</label>
                  <input
                    type="text"
                    value={editData.title || ''}
                    onChange={(e) => handleEditChange('title', e.target.value)}
                    placeholder="제목 입력"
                  />
                </div>

                {/* 공지유형 */}
                <div className="form-group">
                  <label>공지유형</label>
                  <select
                    value={editData.notice_type || ''}
                    onChange={(e) => handleEditChange('notice_type', e.target.value)}
                  >
                    <option value="">선택하기</option>
                    <option value="TXT">TXT</option>
                    <option value="IMG">IMG</option>
                  </select>
                </div>

                {/* 내용 - HTML 에디터 */}
                <div className="form-group full-width">
                  <label>내용 *</label>
                  <SimpleHtmlEditor
                    value={editData.contents || ''}
                    onChange={(value) => handleEditChange('contents', value)}
                    placeholder="내용을 입력하세요. 툴바를 사용하여 텍스트 서식, 색상, 이미지 등을 추가할 수 있습니다."
                  />
                </div>

                {/* 옵션들 */}
                <div className="options-row">
                  <div className="form-group">
                    <label>고정</label>
                    <select
                      value={editData.fix_yn || 'N'}
                      onChange={(e) => handleEditChange('fix_yn', e.target.value)}
                    >
                      <option value="Y">고정</option>
                      <option value="N">일반</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>팝업</label>
                    <select
                      value={editData.popup_yn || 'N'}
                      onChange={(e) => handleEditChange('popup_yn', e.target.value)}
                    >
                      <option value="Y">팝업</option>
                      <option value="N">일반</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>사용여부</label>
                    <select
                      value={editData.use_yn || 'Y'}
                      onChange={(e) => handleEditChange('use_yn', e.target.value)}
                    >
                      <option value="Y">사용</option>
                      <option value="N">미사용</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="modal-btn cancel-btn" onClick={closeEditModal}>
                취소
              </button>
              <button 
                className="modal-btn save-btn" 
                onClick={handleSave}
                disabled={loading}
              >
                {loading ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 미리보기 모달 */}
      {showPreviewModal && selectedNotice && (
        <div className="modal-overlay">
          <div className="modal-content preview-modal">
            <div className="modal-header">
              <h3 className="modal-title">공지 미리보기</h3>
              <button className="modal-close" onClick={closePreviewModal}>✕</button>
            </div>

            <div className="modal-body">
              <div className="preview-content">
                <div className="preview-header">
                  <h2 className="preview-title">{selectedNotice.title}</h2>
                  <div className="preview-meta">
                    <span className="meta-item">공지구분: {selectedNotice.gubun}</span>
                    <span className="meta-item">공지유형: {selectedNotice.notice_type}</span>
                    <span className="meta-item">작성일: {formatDateTime(selectedNotice.input_date)}</span>
                  </div>
                </div>
                <div className="preview-body">
                  <div 
                    className="preview-text" 
                    dangerouslySetInnerHTML={{ __html: selectedNotice.contents }}
                  />
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="modal-btn cancel-btn" onClick={closePreviewModal}>
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default NoticeManagementPage
