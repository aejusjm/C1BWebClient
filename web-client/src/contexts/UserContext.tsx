// 사용자 정보 전역 Context
import { createContext, useContext, type ReactNode } from 'react'

export interface UserInfo {
  userId: string
  userName: string
  userType: string
  endDate: string | null
}

interface UserContextType {
  userInfo: UserInfo
  setUserInfo: (userInfo: UserInfo) => void
}

const UserContext = createContext<UserContextType | undefined>(undefined)

export const useUser = () => {
  const context = useContext(UserContext)
  if (!context) {
    throw new Error('useUser must be used within UserProvider')
  }
  return context
}

interface UserProviderProps {
  children: ReactNode
  userInfo: UserInfo
  setUserInfo: (userInfo: UserInfo) => void
}

export const UserProvider = ({ children, userInfo, setUserInfo }: UserProviderProps) => {
  return (
    <UserContext.Provider value={{ userInfo, setUserInfo }}>
      {children}
    </UserContext.Provider>
  )
}
