// 백엔드(FastAPI) /chat 엔드포인트 호출용 최소 래퍼.
// 로컬 개발 기본값은 uvicorn 기본 포트(8000). 나중에 Render에 배포하면
// .env에 VITE_API_URL=https://your-backend.onrender.com 처럼 추가해서 교체하면 됨
// (Vite는 VITE_ 접두사가 붙은 값만 프론트 번들에 노출하므로, 같은 .env 파일에
// OPENAI_API_KEY가 같이 있어도 안전하게 무시됨).
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export async function sendChatMessage({ message, sessionId }) {
  const res = await fetch(`${API_BASE_URL}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, session_id: sessionId ?? null }),
  })

  if (!res.ok) {
    throw new Error(`백엔드 응답 오류 (status ${res.status})`)
  }

  return res.json() // { session_id, reply }
}
