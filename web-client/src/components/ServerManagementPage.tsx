// 서버관리 페이지 컴포넌트 - 서버 정보 관리
import { useState, useEffect } from 'react'
import { useAlert } from '../contexts/AlertContext'
import './ServerManagementPage.css'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'
const API_URL = `${API_BASE}/api/servers`
const CUSTOM_SERVER_TYPE_VALUE = '__custom__'
const SERVER_TYPE_OPTIONS = [
  '업로드',
  '배치삭제',
  '즉시삭제',
  '주문정보수집',
  '스토어수집',
  '상품수집',
  '픽투셀업로드',
  '픽투셀다운로드'
]

interface Server {
  server_id: string
  server_ip: string
  server_port: string
  server_name: string
  server_type: string
  use_yn: string
  input_date: string
  update_date: string
}

function ServerManagementPage() {
  const { showAlert, showConfirm } = useAlert()
  const [servers, setServers] = useState<Server[]>([])
  const [selectedServer, setSelectedServer] = useState<Server | null>(null)
  const [loading, setLoading] = useState(false)
  const [isEditMode, setIsEditMode] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [serverTypeSelectValue, setServerTypeSelectValue] = useState('')
  
  // 정렬 상태
  const [sortConfig, setSortConfig] = useState<{
    key: keyof Server | null
    direction: 'asc' | 'desc' | null
  }>({
    key: null,
    direction: null
  })

  useEffect(() => {
    loadServers()
  }, [])

  const loadServers = async () => {
    try {
      setLoading(true)
      const response = await fetch(`${API_URL}`)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const result = await response.json()
      
      if (result.success) {
        setServers(result.data)
      }
    } catch (error) {
      console.error('서버 목록 로드 오류:', error)
      await showAlert('서버 목록을 불러오는 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

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

  const handleEdit = (server: Server) => {
    setSelectedServer({ ...server })
    setServerTypeSelectValue(getServerTypeSelectValue(server.server_type))
    setIsEditMode(true)
    setShowModal(true)
  }

  const handleAdd = () => {
    setSelectedServer({
      server_id: '',
      server_ip: '',
      server_port: '',
      server_name: '',
      server_type: '',
      use_yn: 'Y',
      input_date: '',
      update_date: ''
    })
    setServerTypeSelectValue('')
    setIsEditMode(false)
    setShowModal(true)
  }

  const handleDelete = async (serverId: string) => {
    const confirmed = await showConfirm('정말 삭제하시겠습니까?')
    if (!confirmed) {
      return
    }

    try {
      const response = await fetch(`${API_URL}/${serverId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result = await response.json()

      if (result.success) {
        await showAlert('삭제되었습니다.')
        loadServers()
      } else {
        await showAlert(result.message || '삭제 중 오류가 발생했습니다.')
      }
    } catch (error) {
      console.error('서버 삭제 오류:', error)
      await showAlert('삭제 중 오류가 발생했습니다.')
    }
  }

  const handleSave = async () => {
    if (!selectedServer) return

    if (!selectedServer.server_id || !selectedServer.server_ip || !selectedServer.server_name) {
      await showAlert('필수 항목을 모두 입력해주세요.')
      return
    }

    if (!isValidServerIp(selectedServer.server_ip)) {
      await showAlert('서버IP는 192.168.0.1 ~ 192.168.0.250 범위로 입력해주세요.')
      return
    }

    try {
      const url = isEditMode ? `${API_URL}/${selectedServer.server_id}` : API_URL
      const method = isEditMode ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(selectedServer)
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result = await response.json()

      if (result.success) {
        await showAlert(isEditMode ? '수정되었습니다.' : '등록되었습니다.')
        setShowModal(false)
        setSelectedServer(null)
        setServerTypeSelectValue('')
        loadServers()
      } else {
        await showAlert(result.message || '저장 중 오류가 발생했습니다.')
      }
    } catch (error) {
      console.error('서버 저장 오류:', error)
      await showAlert('저장 중 오류가 발생했습니다.')
    }
  }

  const handleModalClose = () => {
    setShowModal(false)
    setSelectedServer(null)
    setServerTypeSelectValue('')
  }

  const handleInputChange = (field: keyof Server, value: string) => {
    if (selectedServer) {
      setSelectedServer({
        ...selectedServer,
        [field]: value
      })
    }
  }

  const isValidServerIp = (ip: string) => {
    const match = ip.match(/^192\.168\.0\.(\d{1,3})$/)
    if (!match) return false
    const lastOctet = Number(match[1])
    return Number.isInteger(lastOctet) && lastOctet >= 1 && lastOctet <= 250
  }

  const getServerTypeSelectValue = (serverType: string) => {
    if (!serverType) return ''
    if (SERVER_TYPE_OPTIONS.includes(serverType)) return serverType
    return CUSTOM_SERVER_TYPE_VALUE
  }

  // 정렬 처리
  const handleSort = (key: keyof Server) => {
    let direction: 'asc' | 'desc' | null = 'desc'
    
    if (sortConfig.key === key) {
      if (sortConfig.direction === 'desc') {
        direction = 'asc'
      } else if (sortConfig.direction === 'asc') {
        direction = null
      }
    }
    
    setSortConfig({ key: direction ? key : null, direction })
  }

  // 정렬된 서버 목록
  const sortedServers = [...servers].sort((a, b) => {
    if (!sortConfig.key || !sortConfig.direction) {
      return 0
    }

    const aValue = a[sortConfig.key]
    const bValue = b[sortConfig.key]

    if (aValue === null || aValue === undefined) return 1
    if (bValue === null || bValue === undefined) return -1

    if (typeof aValue === 'string' && typeof bValue === 'string') {
      return sortConfig.direction === 'asc'
        ? aValue.localeCompare(bValue)
        : bValue.localeCompare(aValue)
    }

    return 0
  })

  // 정렬 아이콘 반환
  const getSortIcon = (key: keyof Server) => {
    if (sortConfig.key !== key) {
      return ' ⇅'
    }
    if (sortConfig.direction === 'desc') {
      return ' ↓'
    }
    if (sortConfig.direction === 'asc') {
      return ' ↑'
    }
    return ' ⇅'
  }

  if (loading) {
    return (
      <div className="server-management-page">
        <div className="server-page-header">
          <h1 className="page-title">🖥️ 서버관리</h1>
        </div>
        <div style={{ textAlign: 'center', padding: '40px' }}>
          데이터를 불러오는 중입니다...
        </div>
      </div>
    )
  }

  return (
    <div className="server-management-page">
      <div className="server-page-header">
        <h1 className="page-title">🖥️ 서버관리</h1>
        <button className="add-server-btn" onClick={handleAdd}>
          + 서버 추가
        </button>
      </div>

      <div className="server-content">
        <div className="server-grid-section">
          <table className="server-grid">
            <thead>
              <tr>
                <th style={{ width: '60px' }}>순번</th>
                <th 
                  style={{ width: '150px', cursor: 'pointer' }}
                  onClick={() => handleSort('server_id')}
                >
                  서버ID{getSortIcon('server_id')}
                </th>
                <th 
                  style={{ width: '150px', cursor: 'pointer' }}
                  onClick={() => handleSort('server_ip')}
                >
                  서버IP{getSortIcon('server_ip')}
                </th>
                <th 
                  style={{ width: '100px', cursor: 'pointer' }}
                  onClick={() => handleSort('server_port')}
                >
                  포트{getSortIcon('server_port')}
                </th>
                <th 
                  style={{ width: '200px', cursor: 'pointer' }}
                  onClick={() => handleSort('server_name')}
                >
                  서버명{getSortIcon('server_name')}
                </th>
                <th 
                  style={{ width: '120px', cursor: 'pointer' }}
                  onClick={() => handleSort('server_type')}
                >
                  서버타입{getSortIcon('server_type')}
                </th>
                <th 
                  style={{ width: '100px', cursor: 'pointer' }}
                  onClick={() => handleSort('use_yn')}
                >
                  사용여부{getSortIcon('use_yn')}
                </th>
                <th style={{ width: '120px' }}>입력일자</th>
                <th style={{ width: '120px' }}>수정일자</th>
                <th style={{ width: '80px' }}>수정</th>
                <th style={{ width: '80px' }}>삭제</th>
              </tr>
            </thead>
            <tbody>
              {sortedServers.length > 0 ? (
                sortedServers.map((server, index) => (
                  <tr key={server.server_id}>
                    <td className="text-center">{index + 1}</td>
                    <td>{server.server_id}</td>
                    <td>{server.server_ip}</td>
                    <td className="text-center">{server.server_port}</td>
                    <td>{server.server_name}</td>
                    <td className="text-center">{server.server_type}</td>
                    <td className="text-center">
                      <span className={`use-badge ${server.use_yn === 'Y' ? 'active' : 'inactive'}`}>
                        {server.use_yn === 'Y' ? '사용' : '미사용'}
                      </span>
                    </td>
                    <td className="text-center">{formatDate(server.input_date)}</td>
                    <td className="text-center">{formatDate(server.update_date)}</td>
                    <td className="text-center">
                      <button 
                        className="grid-btn edit-btn"
                        onClick={() => handleEdit(server)}
                      >
                        수정
                      </button>
                    </td>
                    <td className="text-center">
                      <button 
                        className="grid-btn delete-btn"
                        onClick={() => handleDelete(server.server_id)}
                      >
                        삭제
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={11} className="no-data-message">
                    등록된 서버가 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && selectedServer && (
        <div className="modal-overlay">
          <div className="modal-content">
            <button 
              className="modal-close-btn"
              onClick={handleModalClose}
            >
              ✕
            </button>
            <div className="modal-header">
              <h2 className="modal-title">
                {isEditMode ? '서버 수정' : '서버 추가'}
              </h2>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">서버ID <span className="required">*</span></label>
                <input
                  type="text"
                  className="form-input"
                  value={selectedServer.server_id}
                  onChange={(e) => handleInputChange('server_id', e.target.value)}
                  disabled={isEditMode}
                  placeholder="서버ID를 입력하세요"
                />
              </div>
              <div className="form-group">
                <label className="form-label">서버IP <span className="required">*</span></label>
                <input
                  type="text"
                  className="form-input"
                  value={selectedServer.server_ip}
                  onChange={(e) => handleInputChange('server_ip', e.target.value)}
                  placeholder="예: 192.168.0.10"
                />
              </div>
              <div className="form-group">
                <label className="form-label">포트</label>
                <input
                  type="text"
                  className="form-input"
                  value={selectedServer.server_port}
                  onChange={(e) => handleInputChange('server_port', e.target.value)}
                  placeholder="예: 3001"
                />
              </div>
              <div className="form-group">
                <label className="form-label">서버명 <span className="required">*</span></label>
                <input
                  type="text"
                  className="form-input"
                  value={selectedServer.server_name}
                  onChange={(e) => handleInputChange('server_name', e.target.value)}
                  placeholder="서버명을 입력하세요"
                />
              </div>
              <div className="form-group">
                <label className="form-label">서버타입</label>
                <select
                  className="form-select"
                  value={serverTypeSelectValue}
                  onChange={(e) => {
                    const selectedValue = e.target.value
                    setServerTypeSelectValue(selectedValue)
                    if (selectedValue === CUSTOM_SERVER_TYPE_VALUE) {
                      return
                    }
                    handleInputChange('server_type', selectedValue)
                  }}
                >
                  <option value="">선택하기</option>
                  {SERVER_TYPE_OPTIONS.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                  <option value={CUSTOM_SERVER_TYPE_VALUE}>직접입력</option>
                </select>
                {serverTypeSelectValue === CUSTOM_SERVER_TYPE_VALUE && (
                  <input
                    type="text"
                    className="form-input"
                    value={selectedServer.server_type}
                    onChange={(e) => handleInputChange('server_type', e.target.value)}
                    placeholder="서버타입을 직접 입력하세요"
                    style={{ marginTop: '8px' }}
                  />
                )}
              </div>
              <div className="form-group">
                <label className="form-label">사용여부</label>
                <select
                  className="form-select"
                  value={selectedServer.use_yn}
                  onChange={(e) => handleInputChange('use_yn', e.target.value)}
                >
                  <option value="Y">사용</option>
                  <option value="N">미사용</option>
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="modal-cancel-btn" onClick={handleModalClose}>
                취소
              </button>
              <button className="modal-save-btn" onClick={handleSave}>
                {isEditMode ? '수정' : '등록'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ServerManagementPage
