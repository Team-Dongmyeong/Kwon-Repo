// 백엔드(FastAPI) /api/policies 엔드포인트 호출용 최소 래퍼. jobsApi.js와 같은 패턴 —
// VITE_API_URL이 없으면 로컬 uvicorn 기본 포트(8000)를 그대로 사용.
// 온통청년 인증키(YOUTH_API_KEY)는 백엔드 환경변수에만 있고, 프론트에는 노출되지 않음.
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

// 반환: { policies, count, totalCount, nextPage }
//  - nextPage가 null이면 더 불러올 정책이 없다는 뜻("더 보기" 버튼 숨김 기준)
export async function fetchPolicies({ page = 1, q = '', category = '', region = '', age = '', includeClosed = false } = {}) {
  const params = new URLSearchParams()
  params.set('page', String(page))
  if (q) params.set('q', q)
  if (category) params.set('category', category)
  if (region) params.set('region', region)
  if (age !== '' && age !== null && !Number.isNaN(Number(age))) params.set('age', String(age))
  if (includeClosed) params.set('include_closed', 'true')

  const res = await fetch(`${API_BASE_URL}/api/policies?${params.toString()}`)

  if (!res.ok) {
    throw new Error(`청년정책 백엔드 응답 오류 (status ${res.status})`)
  }

  const data = await res.json()
  return {
    policies: data.policies ?? [],
    count: data.count ?? 0,
    totalCount: data.totalCount ?? 0,
    nextPage: data.nextPage ?? null,
  }
}