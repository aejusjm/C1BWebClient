// 필터 컨텍스트 - 대시보드와 주문관리 페이지 간 필터 상태 공유
import { createContext, useContext, useState, type ReactNode } from 'react'

interface FilterContextType {
  dateFilter: string
  smartStore: boolean
  coupang: boolean
  selectedStores: number[]
  statusFilter: string | null
  useCustomDate: boolean
  startDate: string
  endDate: string
  setDateFilter: (filter: string) => void
  setSmartStore: (value: boolean) => void
  setCoupang: (value: boolean) => void
  setSelectedStores: (stores: number[]) => void
  setStatusFilter: (status: string | null) => void
  setUseCustomDate: (value: boolean) => void
  setStartDate: (date: string) => void
  setEndDate: (date: string) => void
  navigateToOrdersWithFilter: (status: string | null) => void
}

const FilterContext = createContext<FilterContextType | undefined>(undefined)

export function FilterProvider({ children }: { children: ReactNode }) {
  const [dateFilter, setDateFilter] = useState('today')
  const [smartStore, setSmartStore] = useState(true)
  const [coupang, setCoupang] = useState(true)
  const [selectedStores, setSelectedStores] = useState<number[]>([])
  const [statusFilter, setStatusFilter] = useState<string | null>(null)
  const [useCustomDate, setUseCustomDate] = useState(false)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const navigateToOrdersWithFilter = (status: string | null) => {
    setStatusFilter(status)
  }

  return (
    <FilterContext.Provider
      value={{
        dateFilter,
        smartStore,
        coupang,
        selectedStores,
        statusFilter,
        useCustomDate,
        startDate,
        endDate,
        setDateFilter,
        setSmartStore,
        setCoupang,
        setSelectedStores,
        setStatusFilter,
        setUseCustomDate,
        setStartDate,
        setEndDate,
        navigateToOrdersWithFilter
      }}
    >
      {children}
    </FilterContext.Provider>
  )
}

export function useFilter() {
  const context = useContext(FilterContext)
  if (context === undefined) {
    throw new Error('useFilter must be used within a FilterProvider')
  }
  return context
}
