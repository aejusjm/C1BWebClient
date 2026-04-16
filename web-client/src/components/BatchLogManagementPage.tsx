// 배치로그관리 페이지 컴포넌트
import { useState, useEffect } from 'react'
import { useAlert } from '../contexts/AlertContext'
import './BatchLogManagementPage.css'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'
const API_URL = `${API_BASE}/api/batch-logs`

interface BatchLog {
  seq: number
  start_date: string
  end_date: string
  run_time: number
  user_id: string
  user_name: string
  biz_idx: number
  get_cnt: number
  result_msg: string
}

function BatchLogManagementPage() {
  const { showAlert } = useAlert()
  const [logs, setLogs] = useState<BatchLog[]>([])
  const [loading, setLoading] = useState(false)
  
  // 페이징 상태
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(20)

  // 컴포넌트 마운트 시 목록 조회
  useEffect(() => {
    loadLogs()
  }, [])

  // 배치로그 목록 조회
  const loadLogs = async () => {
    try {
      setLoading(true)
      console.log('📋 배치로그 목록 조회 시작, API URL:', API_URL)
      const response = await fetch(API_URL)
      
      console.log('📋 응답 상태:', response.status, response.statusText)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const result = await response.json()
      console.log('📋 응답 데이터:', result)
      
      if (result.success) {
        console.log('📋 배치로그 개수:', result.data.length)
        setLogs(result.data)
      } else {
        console.error('📋 API 호출 실패:', result.message)
      }
    } catch (error) {
      console.error('📋 배치로그 목록 조회 오류:', error)
      await showAlert('배치로그 목록을 불러오는 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  // 날짜 포맷팅 (YYYY-MM-DD HH:mm)
  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return '-'
    
    // SQL Server에서 온 날짜는 한국시간이지만 'Z'가 붙어 UTC로 파싱됨
    // 'Z'를 제거하고 로컬 시간으로 파싱
    const dateStr = dateString.replace('Z', '')
    const date = new Date(dateStr)
    
    if (Number.isNaN(date.getTime())) return '-'
    
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    
    return `${year}-${month}-${day} ${hours}:${minutes}`
  }

  // 소요시간 포맷팅 (초 → 분:초)
  const formatRunTime = (seconds: number | null) => {
    if (seconds === null || seconds === undefined) return '-'
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}분 ${secs}초`
  }

  // 페이징 계산
  const indexOfLastItem = currentPage * itemsPerPage
  const indexOfFirstItem = indexOfLastItem - itemsPerPage
  const currentLogs = logs.slice(indexOfFirstItem, indexOfLastItem)
  const totalPages = Math.ceil(logs.length / itemsPerPage)

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
    <div className="batch-log-management-page">
      {/* 페이지 헤더 */}
      <div className="batch-log-management-page-header">
        <h1 className="page-title">📋 배치로그관리</h1>
      </div>

      {/* 목록 테이블 */}
      <div className="batch-log-table-container">
        <div className="table-header">
          <h3>배치 로그 목록 ({logs.length}개)</h3>
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
          <table className="batch-log-table">
            <thead>
              <tr>
                <th>순번</th>
                <th>시작일시</th>
                <th>종료일시</th>
                <th>소요시간</th>
                <th>사용자ID</th>
                <th>사용자명</th>
                <th>사업자순서</th>
                <th>수집건수</th>
                <th>처리결과</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={9} className="no-data">
                    {loading ? '로딩 중...' : '배치 로그가 없습니다.'}
                  </td>
                </tr>
              ) : (
                currentLogs.map((log, index) => (
                  <tr key={log.seq}>
                    <td>{logs.length - indexOfFirstItem - index}</td>
                    <td>{formatDateTime(log.start_date)}</td>
                    <td>{formatDateTime(log.end_date)}</td>
                    <td>{formatRunTime(log.run_time)}</td>
                    <td>{log.user_id}</td>
                    <td>{log.user_name}</td>
                    <td>{log.biz_idx}</td>
                    <td>{log.get_cnt}</td>
                    <td>
                      <span className={`result-badge ${log.result_msg === 'OK' ? 'result-ok' : 'result-error'}`}>
                        {log.result_msg}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* 페이징 */}
        {logs.length > 0 && (
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
              {currentPage} / {totalPages} 페이지 (총 {logs.length}개)
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

export default BatchLogManagementPage
