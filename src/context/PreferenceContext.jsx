import { createContext, useContext, useMemo, useState } from 'react'
import { JOB_CATEGORIES } from '../constants/jobCategories.js'

// "선호 추천 분야"를 앱 전체에서 공유하는 Context.
// 값 = 적성 검사 결과 60% + 챗봇 대화 분석 결과 40%를 합산해서 자동으로 결정됨.
// 검사 페이지 / 채팅 페이지 어느 쪽에서든 결과가 나오는 시점에 setTestResult(...) 나
// setChatResult(...)를 호출해주기만 하면, 이 값을 구독하는 모든 화면(채용공고
// 스마트픽 등)이 리렌더링되면서 실시간으로 같이 바뀜 — React Context의 기본 동작이라
// 화면마다 "다시 불러오기" 로직을 따로 짤 필요가 없음.

const TEST_WEIGHT = 0.6
const CHAT_WEIGHT = 0.4

function emptyScores() {
  return Object.fromEntries(JOB_CATEGORIES.map((c) => [c, 0]))
}

// 인자로 카테고리 문자열 하나만 오면(예: 'IT·개발') 그 카테고리에 100% 몰아준 벡터로
// 취급하고, 이미 { 'IT·개발': 0.7, '디자인': 0.1, ... } 같은 확률 분포 객체가 오면
// 그대로 사용. → 지금은 검사/채팅 쪽이 "카테고리 하나"만 던져줘도 동작하고, 나중에
// KcELECTRA/SBERT나 GPT+RAG 쪽이 신뢰도 분포까지 계산해주게 되면 그 객체를 그대로
// 넘기기만 하면 되고 이 파일은 손댈 필요가 없음.
function toVector(input) {
  if (typeof input === 'string') {
    const vector = emptyScores()
    vector[input] = 1
    return vector
  }
  return { ...emptyScores(), ...input }
}

function argmaxCategory(scores) {
  return JOB_CATEGORIES.reduce((best, c) => (scores[c] > scores[best] ? c : best), JOB_CATEGORIES[0])
}

const PreferenceContext = createContext(null)

export function PreferenceProvider({ children }) {
  // TODO: 적성 검사 결과가 나오는 시점에 setTestResult(...), 채팅 분석이 끝나는
  // 시점에 setChatResult(...)를 호출하도록 연동. 아직 둘 다 연동 전이라 초기값은
  // 전부 0(무응답) 상태 — 이 경우 preferredCategory는 JOB_CATEGORIES의 첫 번째 값으로
  // 떨어지도록 되어있음(아래 argmaxCategory 참고).
  const [testScores, setTestScores] = useState(emptyScores)
  const [chatScores, setChatScores] = useState(emptyScores)

  const combinedScores = useMemo(() => {
    const result = emptyScores()
    JOB_CATEGORIES.forEach((c) => {
      result[c] = testScores[c] * TEST_WEIGHT + chatScores[c] * CHAT_WEIGHT
    })
    return result
  }, [testScores, chatScores])

  const preferredCategory = useMemo(() => argmaxCategory(combinedScores), [combinedScores])

  // 검사·채팅 둘 다 아직 한 번도 결과를 안 준 상태(전부 0점)인지 여부.
  // preferredCategory는 이 경우에도 JOB_CATEGORIES[0]으로 뭔가 값을 반환하기 때문에
  // (스마트픽이 항상 3건을 보여줘야 하니까), 화면에 "아직 진단 전"이라고 정직하게
  // 보여주고 싶은 곳(마이페이지 등)에서는 preferredCategory 대신 이 값으로 분기하면 됨.
  const hasPreferenceData = useMemo(
    () => JOB_CATEGORIES.some((c) => testScores[c] > 0 || chatScores[c] > 0),
    [testScores, chatScores]
  )

  // 마이페이지의 "초기화" 버튼용 — 검사·채팅 점수를 전부 0으로 되돌려서
  // hasPreferenceData가 다시 false가 되고 preferredCategory 표시도 "미설정"으로
  // 돌아가게 함. 재진단을 처음부터 다시 받고 싶을 때 쓰는 기능.
  function resetPreference() {
    setTestScores(emptyScores())
    setChatScores(emptyScores())
  }

  const value = useMemo(
    () => ({
      preferredCategory,
      hasPreferenceData,
      combinedScores,
      testScores,
      chatScores,
      setTestResult: (categoryOrVector) => setTestScores(toVector(categoryOrVector)),
      setChatResult: (categoryOrVector) => setChatScores(toVector(categoryOrVector)),
      resetPreference,
    }),
    [preferredCategory, hasPreferenceData, combinedScores, testScores, chatScores]
  )

  return <PreferenceContext.Provider value={value}>{children}</PreferenceContext.Provider>
}

// Header.jsx처럼 로그인 전(랜딩 페이지)과 로그인 후(AppLayout 안, PreferenceProvider
// 하위) 두 곳에서 전부 렌더링되는 컴포넌트가 있어서, 여기서는 Provider가 없다고
// 에러를 던지지 않고 "아무 값도 없는" 안전한 기본값을 돌려줌. 이 기본값 상태에서는
// hasPreferenceData가 항상 false라서, "선호 추천 분야" 박스를 로그인 여부와 무관하게
// 무조건 렌더링해도 로그인 전 화면에서 깨지지 않음(값을 실제로 바꾸는
// setTestResult/resetPreference 등은 Provider 밖에서 호출하면 아무 동작도 안 함).
const noopPreference = {
  preferredCategory: undefined,
  hasPreferenceData: false,
  combinedScores: {},
  testScores: {},
  chatScores: {},
  setTestResult: () => {},
  setChatResult: () => {},
  resetPreference: () => {},
}

export function usePreference() {
  const ctx = useContext(PreferenceContext)
  return ctx ?? noopPreference
}
