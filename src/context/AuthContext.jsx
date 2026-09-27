// import { createContext, useCallback, useContext, useEffect, useState } from 'react'

// const AuthContext = createContext(null)
// const STORAGE_KEY = 'maeum:auth-user'

// // 백엔드(FastAPI 인증 API)가 아직 없어 로그인/회원가입 성공 시 사용자 정보만
// // localStorage에 임시로 저장하는 모의(mock) 인증 컨텍스트.
// // 실제 인증 연동 시 login()/logout() 내부만 API 호출로 교체하면 됨.
// export function AuthProvider({ children }) {
//   const [user, setUser] = useState(() => {
//     try {
//       const raw = localStorage.getItem(STORAGE_KEY)
//       return raw ? JSON.parse(raw) : null
//     } catch {
//       return null
//     }
//   })

//   useEffect(() => {
//     try {
//       if (user) localStorage.setItem(STORAGE_KEY, JSON.stringify(user))
//       else localStorage.removeItem(STORAGE_KEY)
//     } catch {
//       // 프라이빗 브라우징 등으로 storage 접근이 막혀도 앱은 계속 동작해야 함
//     }
//   }, [user])

//   const login = useCallback(({ email, name }) => {
//     setUser({ email, name: name?.trim() || email.split('@')[0] })
//   }, [])

//   const logout = useCallback(() => setUser(null), [])

//   return (
//     <AuthContext.Provider value={{ user, isAuthenticated: !!user, login, logout }}>
//       {children}
//     </AuthContext.Provider>
//   )
// }

// export function useAuth() {
//   const ctx = useContext(AuthContext)
//   if (!ctx) throw new Error('useAuth는 AuthProvider 내부에서만 사용할 수 있습니다.')
//   return ctx
// }

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { API_BASE_URL } from '../lib/chatApi.js'

const AuthContext = createContext(null)
const STORAGE_KEY = 'maeum:auth-user'

// 실제 로그인(/auth/login) 성공 시 받은 사용자 정보 + 토큰을 저장.
// user = { id, email, name, accessToken, refreshToken }
// 채팅 기록은 더 이상 브라우저가 아니라 Supabase DB에 계정별로 저장됨.
export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      const saved = raw ? JSON.parse(raw) : null
      // 예전 가짜 로그인으로 저장된 정보(id/토큰 없음)는 버리고 다시 로그인하게 함
      return saved?.id && saved?.accessToken ? saved : null
    } catch {
      return null
    }
  })

  // authFetch 안에서 항상 최신 토큰을 쓰기 위한 ref
  const userRef = useRef(user)
  useEffect(() => {
    userRef.current = user
  }, [user])

  useEffect(() => {
    try {
      if (user) localStorage.setItem(STORAGE_KEY, JSON.stringify(user))
      else localStorage.removeItem(STORAGE_KEY)
    } catch {
      // 프라이빗 브라우징 등으로 storage 접근이 막혀도 앱은 계속 동작해야 함
    }
  }, [user])

  const login = useCallback(({ id, email, name, accessToken, refreshToken }) => {
    const next = {
      id,
      email,
      name: name?.trim() || email.split('@')[0],
      accessToken,
      refreshToken,
    }
    userRef.current = next
    setUser(next)
  }, [])

  const logout = useCallback(() => {
    try {
      // 예전 버전이 브라우저에 저장해둔 채팅 기록 정리
      localStorage.removeItem('maeum:chat-sessions')
    } catch {
      // 무시
    }
    userRef.current = null
    setUser(null)
  }, [])

  // 로그인 토큰을 붙여서 백엔드를 호출하는 fetch.
  // 토큰이 만료(401)되면 refresh_token으로 한 번 갱신 후 재시도하고, 그것도 실패하면 로그아웃.
  const authFetch = useCallback(
    async (path, options = {}) => {
      const request = (token) =>
        fetch(`${API_BASE_URL}${path}`, {
          ...options,
          headers: {
            'Content-Type': 'application/json',
            ...(options.headers || {}),
            Authorization: `Bearer ${token}`,
          },
        })

      const current = userRef.current
      if (!current) {
        const err = new Error('SESSION_EXPIRED')
        err.status = 401
        throw err
      }

      const res = await request(current.accessToken)
      if (res.status !== 401) return res

      if (current.refreshToken) {
        const r = await fetch(`${API_BASE_URL}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: current.refreshToken }),
        })
        if (r.ok) {
          const tokens = await r.json()
          const next = { ...current, accessToken: tokens.access_token, refreshToken: tokens.refresh_token }
          userRef.current = next
          setUser(next)
          return request(next.accessToken)
        }
      }

      logout()
      const err = new Error('SESSION_EXPIRED')
      err.status = 401
      throw err
    },
    [logout],
  )

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, login, logout, authFetch }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth는 AuthProvider 내부에서만 사용할 수 있습니다.')
  return ctx
}
