// 금지어관리 페이지 컴포넌트
import { useState, useEffect } from 'react'
import { useAlert } from '../contexts/AlertContext'
import './NoWordManagementPage.css'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'
const API_URL = `${API_BASE}/api/no-words`

interface NoWord {
  seq: number
  no_word: string
  gubun: string | null
  apply_ym: string | null
  word_type: string | null
  use_yn: string
  input_date: string
}

function NoWordManagementPage() {
  const { showAlert, showConfirm } = useAlert()
  const [noWords, setNoWords] = useState<NoWord[]>([])
  const [loading, setLoading] = useState(false)
  const [keyword, setKeyword] = useState('')
  
  // 페이징 상태
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(20)
  const [totalPages, setTotalPages] = useState(0)
  const [totalItems, setTotalItems] = useState(0)
  
  // 모달 상태
  const [showModal, setShowModal] = useState(false)
  const [isEditMode, setIsEditMode] = useState(false)
  const [selectedNoWord, setSelectedNoWord] = useState<NoWord | null>(null)
  const [formData, setFormData] = useState({
    no_word: '',
    word_type: '수집제외',
    apply_ym: '',
    use_yn: 'Y'
  })

  // 컴포넌트 마운트 시 목록 로드
  useEffect(() => {
    loadNoWords()
  }, [currentPage, itemsPerPage])

  // 금지어 목록 로드
  const loadNoWords = async () => {
    try {
      setLoading(true)
      const response = await fetch(
        `${API_URL}?page=${currentPage}&limit=${itemsPerPage}&keyword=${keyword}`
      )
      const data = await response.json()

      if (data.success) {
        setNoWords(data.data)
        setTotalPages(data.pagination.totalPages)
        setTotalItems(data.pagination.total)
      } else {
        await showAlert(`금지어 목록을 불러오는 중 오류가 발생했습니다.\n\n${data.message}`)
      }
    } catch (error) {
      console.error('금지어 목록 로드 오류:', error)
      await showAlert(`금지어 목록을 불러오는 중 오류가 발생했습니다.\n\n오류: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setLoading(false)
    }
  }

  // 검색
  const handleSearch = () => {
    setCurrentPage(1)
    loadNoWords()
  }

  // 검색어 입력 시 엔터키 처리
  const handleKeywordKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }

  // 추가 모달 열기
  const handleAdd = () => {
    setIsEditMode(false)
    setSelectedNoWord(null)
    setFormData({
      no_word: '',
      word_type: '수집제외',
      apply_ym: '',
      use_yn: 'Y'
    })
    setShowModal(true)
  }

  // gubun 또는 word_type 값을 표시용 텍스트로 변환하는 함수
  const getWordTypeDisplay = (noWord: NoWord): string => {
    // word_type이 있으면 우선 사용
    if (noWord.word_type) {
      return noWord.word_type
    }
    // word_type이 없으면 gubun으로 변환
    if (noWord.gubun === '1') return '수집제외'
    if (noWord.gubun === '2') return '제품명제외'
    return '-'
  }

  // 수정 모달 열기
  const handleEdit = (noWord: NoWord) => {
    setIsEditMode(true)
    setSelectedNoWord(noWord)
    
    // word_type이 있으면 사용, 없으면 gubun으로부터 변환
    let wordType = noWord.word_type || '수집제외'
    if (!noWord.word_type && noWord.gubun) {
      if (noWord.gubun === '1') wordType = '수집제외'
      else if (noWord.gubun === '2') wordType = '제품명제외'
    }
    
    setFormData({
      no_word: noWord.no_word,
      word_type: wordType,
      apply_ym: noWord.apply_ym || '',
      use_yn: noWord.use_yn
    })
    setShowModal(true)
  }

  // 저장
  const handleSave = async () => {
    try {
      if (!formData.no_word.trim()) {
        await showAlert('금지어를 입력해주세요.')
        return
      }

      const url = isEditMode ? `${API_URL}/${selectedNoWord?.seq}` : API_URL
      const method = isEditMode ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      })

      const data = await response.json()

      if (data.success) {
        await showAlert(data.message)
        setShowModal(false)
        loadNoWords()
      } else {
        await showAlert(`저장 중 오류가 발생했습니다.\n\n${data.message}`)
      }
    } catch (error) {
      console.error('저장 오류:', error)
      await showAlert(`저장 중 오류가 발생했습니다.\n\n오류: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  // 삭제
  const handleDelete = async (seq: number) => {
    const confirmed = await showConfirm('정말 삭제하시겠습니까?')
    if (!confirmed) {
      return
    }

    try {
      const response = await fetch(`${API_URL}/${seq}`, {
        method: 'DELETE'
      })

      const data = await response.json()

      if (data.success) {
        await showAlert(data.message)
        loadNoWords()
      } else {
        await showAlert(`삭제 중 오류가 발생했습니다.\n\n${data.message}`)
      }
    } catch (error) {
      console.error('삭제 오류:', error)
      await showAlert(`삭제 중 오류가 발생했습니다.\n\n오류: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  // 페이지 변경
  const handlePageChange = (page: number) => {
    setCurrentPage(page)
  }

  // 페이지당 항목 수 변경
  const handleItemsPerPageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setItemsPerPage(Number(e.target.value))
    setCurrentPage(1)
  }

  // 페이지 번호 생성 (공지관리 스타일)
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
    <div className="no-word-management-page">
      {/* 페이지 헤더 */}
      <div className="no-word-management-page-header">
        <h2>금지어관리</h2>
        <button className="add-no-word-btn" onClick={handleAdd}>
          금지어 추가
        </button>
      </div>

      {/* 검색 영역 */}
      <div className="search-area">
        <div className="search-row-split">
          <div className="items-per-page">
            <label>페이지당 항목 수:</label>
            <select value={itemsPerPage} onChange={handleItemsPerPageChange}>
              <option value={20}>20</option>
              <option value={30}>30</option>
              <option value={50}>50</option>
            </select>
          </div>
          <div className="search-group-right">
            <label className="search-label-inline">검색어</label>
            <input
              type="text"
              className="search-input-large"
              placeholder="금지어 검색"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyPress={handleKeywordKeyPress}
            />
            <button className="search-btn" onClick={handleSearch}>
              검색
            </button>
          </div>
        </div>
      </div>

      {/* 테이블 컨테이너 */}
      <div className="no-word-table-container">

        {/* 금지어 테이블 */}
        <table className="no-word-table">
          <thead>
            <tr>
              <th style={{ width: '80px' }}>순번</th>
              <th>금지어</th>
              <th style={{ width: '120px' }}>제외구분</th>
              <th style={{ width: '100px' }}>적용년월</th>
              <th style={{ width: '100px' }}>사용여부</th>
              <th style={{ width: '150px' }}>관리</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '40px' }}>
                  로딩 중...
                </td>
              </tr>
            ) : noWords.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '40px' }}>
                  등록된 금지어가 없습니다.
                </td>
              </tr>
            ) : (
              noWords.map((noWord, index) => {
                // 내림차순 순번 계산
                const rowNumber = totalItems - ((currentPage - 1) * itemsPerPage + index);
                return (
                  <tr key={noWord.seq}>
                    <td>{rowNumber}</td>
                    <td>{noWord.no_word}</td>
                    <td>{getWordTypeDisplay(noWord)}</td>
                    <td>{noWord.apply_ym || '-'}</td>
                    <td>
                      <span className={`status-badge ${noWord.use_yn === 'N' ? 'inactive' : 'active'}`}>
                        {noWord.use_yn === 'N' ? '미사용' : '사용'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '5px', justifyContent: 'center' }}>
                        <button className="edit-btn" onClick={() => handleEdit(noWord)}>
                          수정
                        </button>
                        <button className="delete-btn" onClick={() => handleDelete(noWord.seq)}>
                          삭제
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {/* 페이징 (공지관리 스타일) */}
        {totalPages > 0 && (
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
              {currentPage} / {totalPages} 페이지 (총 {totalItems}개)
            </span>
          </div>
        )}
      </div>

      {/* 추가/수정 모달 */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 className="modal-title">
                {isEditMode ? '금지어 수정' : '금지어 추가'}
              </h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>
                ×
              </button>
            </div>

            <div className="modal-body">
              <div className="modal-field">
                <label>금지어 *</label>
                <input
                  type="text"
                  value={formData.no_word}
                  onChange={(e) => setFormData({ ...formData, no_word: e.target.value })}
                  placeholder="금지어 입력"
                />
              </div>

              <div className="modal-field">
                <label>제외구분 *</label>
                <select
                  value={formData.word_type}
                  onChange={(e) => setFormData({ ...formData, word_type: e.target.value })}
                >
                  <option value="수집제외">수집제외</option>
                  <option value="제품명제외">제품명제외</option>
                </select>
              </div>

              <div className="modal-field">
                <label>적용년월</label>
                <input
                  type="text"
                  value={formData.apply_ym}
                  onChange={(e) => setFormData({ ...formData, apply_ym: e.target.value })}
                  placeholder="YYYYMM (예: 202603)"
                />
              </div>

              <div className="modal-field">
                <label>사용여부 *</label>
                <select
                  value={formData.use_yn}
                  onChange={(e) => setFormData({ ...formData, use_yn: e.target.value })}
                >
                  <option value="Y">사용</option>
                  <option value="N">미사용</option>
                </select>
              </div>
            </div>

            <div className="modal-footer">
              <button className="modal-btn cancel-btn" onClick={() => setShowModal(false)}>
                취소
              </button>
              <button className="modal-btn save-btn" onClick={handleSave}>
                저장
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default NoWordManagementPage
