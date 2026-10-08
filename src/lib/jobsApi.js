// 백엔드(FastAPI) /api/jobs 엔드포인트 호출용 최소 래퍼. chatApi.js와 같은 패턴 —
// VITE_API_URL이 없으면 로컬 uvicorn 기본 포트(8000)를 그대로 사용.
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export async function fetchJobs() {
  const res = await fetch(`${API_BASE_URL}/api/jobs`)

  if (!res.ok) {
    throw new Error(`채용공고 백엔드 응답 오류 (status ${res.status})`)
  }

  const data = await res.json()
  return data.jobs ?? [] // 백엔드는 { jobs, count, cachedAt } 형태로 응답
}
