import { createContext, useCallback, useContext, useEffect, useState } from 'react'

const AuthContext = createContext(null)
const STORAGE_KEY = 'maeum:auth-user'

// 백엔드(FastAPI 인증 API)가 아직 없어 로그인/회원가입 성공 시 사용자 정보만
// localStorage에 임시로 저장하는 모의(mock) 인증 컨텍스트.
// 실제 인증 연동 시 login()/logout() 내부만 API 호출로 교체하면 됨.
export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  })

  useEffect(() => {
    try {
      if (user) localStorage.setItem(STORAGE_KEY, JSON.stringify(user))
      else localStorage.removeItem(STORAGE_KEY)
    } catch {
      // 프라이빗 브라우징 등으로 storage 접근이 막혀도 앱은 계속 동작해야 함
    }
  }, [user])

  const login = useCallback(({ email, name }) => {
    setUser({ email, name: name?.trim() || email.split('@')[0] })
  }, [])

  const logout = useCallback(() => setUser(null), [])

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth는 AuthProvider 내부에서만 사용할 수 있습니다.')
  return ctx
}
