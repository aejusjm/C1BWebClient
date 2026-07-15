// Alert 컨텍스트 - 전역 알림/확인 모달 관리
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import AlertModal from '../components/AlertModal'

interface AlertContextType {
  showAlert: (message: string, title?: string) => Promise<void>
  showConfirm: (message: string, title?: string) => Promise<boolean>
}

const AlertContext = createContext<AlertContextType | undefined>(undefined)

export function AlertProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const [modalType, setModalType] = useState<'alert' | 'confirm'>('alert')
  const [title, setTitle] = useState<string | undefined>()
  const [message, setMessage] = useState('')
  const resolveRef = useRef<((value: boolean) => void) | null>(null)

  // Alert 표시 (Promise 기반)
  const showAlert = useCallback((msg: string, ttl?: string): Promise<void> => {
    return new Promise<void>((resolve) => {
      setModalType('alert')
      setTitle(ttl)
      setMessage(msg)
      setIsOpen(true)
      resolveRef.current = () => {
        resolve()
      }
    })
  }, [])

  // Confirm 표시 (Promise 기반)
  const showConfirm = useCallback((msg: string, ttl?: string): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      setModalType('confirm')
      setTitle(ttl)
      setMessage(msg)
      setIsOpen(true)
      resolveRef.current = (value: boolean) => {
        resolve(value)
      }
    })
  }, [])

  // 확인 버튼 클릭
  const handleConfirm = useCallback(() => {
    setIsOpen(false)
    const resolve = resolveRef.current
    resolveRef.current = null
    resolve?.(true)
  }, [])

  // 취소 버튼 클릭
  const handleCancel = useCallback(() => {
    setIsOpen(false)
    const resolve = resolveRef.current
    resolveRef.current = null
    resolve?.(false)
  }, [])

  const value = useMemo(() => ({ showAlert, showConfirm }), [showAlert, showConfirm])

  return (
    <AlertContext.Provider value={value}>
      {children}
      <AlertModal
        isOpen={isOpen}
        type={modalType}
        title={title}
        message={message}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </AlertContext.Provider>
  )
}

// useAlert 훅
export function useAlert() {
  const context = useContext(AlertContext)
  if (!context) {
    throw new Error('useAlert must be used within AlertProvider')
  }
  return context
}
