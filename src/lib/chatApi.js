// // 백엔드(FastAPI) /chat 엔드포인트 호출용 최소 래퍼.
// // 로컬 개발 기본값은 uvicorn 기본 포트(8000). 나중에 Render에 배포하면
// // .env에 VITE_API_URL=https://your-backend.onrender.com 처럼 추가해서 교체하면 됨
// // (Vite는 VITE_ 접두사가 붙은 값만 프론트 번들에 노출하므로, 같은 .env 파일에
// // OPENAI_API_KEY가 같이 있어도 안전하게 무시됨).
// const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

// export async function sendChatMessage({ message, sessionId }) {
//   const res = await fetch(`${API_BASE_URL}/chat`, {
//     method: 'POST',
//     headers: { 'Content-Type': 'application/json' },
//     body: JSON.stringify({ message, session_id: sessionId ?? null }),
//   })

//   if (!res.ok) {
//     throw new Error(`백엔드 응답 오류 (status ${res.status})`)
//   }

//   return res.json() // { session_id, reply }
// }

// 백엔드(FastAPI) 채팅 API 호출 모음.
// 배포: Vercel 환경변수 VITE_API_URL(Render 주소) / 로컬: uvicorn 기본 포트(8000)
export const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '')

// 모든 함수는 AuthContext의 authFetch를 첫 번째 인자로 받음
// (authFetch가 로그인 토큰을 헤더에 붙이고, 만료되면 자동으로 갱신해줌)

async function readError(res) {
  const data = await res.json().catch(() => ({}))
  const err = new Error(typeof data.detail === 'string' ? data.detail : `백엔드 응답 오류 (status ${res.status})`)
  err.status = res.status
  return err
}

// 로그인한 사용자의 대화방 목록 + 메시지
// → [{ id, title, created_at, messages: [{ role, content, created_at }] }]
export async function fetchChatSessions(authFetch) {
  const res = await authFetch('/chat/sessions')
  if (!res.ok) throw await readError(res)
  return res.json()
}

// 메시지 전송 (sessionId가 없으면 서버가 새 대화방을 만들어서 id를 돌려줌)
export async function sendChatMessage(authFetch, { message, sessionId }) {
  const res = await authFetch('/chat', {
    method: 'POST',
    body: JSON.stringify({ message, session_id: sessionId ?? null }),
  })
  if (!res.ok) throw await readError(res)
  return res.json() // { session_id, reply }
}

// 대화방 삭제
export async function deleteChatSession(authFetch, sessionId) {
  const res = await authFetch(`/chat/sessions/${sessionId}`, { method: 'DELETE' })
  if (!res.ok) throw await readError(res)
  return res.json()
}
