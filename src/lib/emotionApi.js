// 마이페이지 '감정상태' 탭 — 백엔드 GET /emotions/summary 호출.
// authFetch는 AuthContext가 주는 함수(로그인 토큰을 붙여서 요청)를 그대로 받아 씀.
// ※ chatApi.js의 fetchChatSessions와 같은 방식으로 authFetch를 부르도록 맞춰야 함.
//   - authFetch가 fetch처럼 Response를 돌려주면 아래 코드 그대로 동작
//   - authFetch가 이미 JSON을 돌려주면 그 값을 그대로 반환
export async function fetchEmotionSummary(authFetch) {
  const res = await authFetch('/emotions/summary')
  if (res && typeof res.json === 'function') {
    if (!res.ok) throw new Error(res.status === 401 ? 'SESSION_EXPIRED' : `HTTP_${res.status}`)
    return res.json()
  }
  return res
}
