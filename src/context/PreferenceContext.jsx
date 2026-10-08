import { createContext, useContext, useMemo, useState } from 'react'
import { JOB_CATEGORIES, ALL_SUB_JOBS, ALL_REGION, CAREER_LEVELS } from '../constants/jobCategories.js'

// "선호 추천 분야"(대분류 1개)와 "추천 직업 3개"(세부직무 단위, 채용공고 스마트픽용)를
// 앱 전체에서 공유하는 Context.
// 값 = 적성 검사 결과 70% + 챗봇 대화 분석 결과 30%를 합산해서 자동으로 결정됨
// (기존 60:40에서 70:30으로 확정 변경).
// 검사 페이지 / 채팅 페이지 어느 쪽에서든 결과가 나오는 시점에
//   - 대분류용: setTestResult(...) / setChatResult(...)
//   - 세부직무용(스마트픽용, 실제 분석 결과 연동): setTestSubJobResult(...) / setChatSubJobResult(...)
//   - 세부직무용(지금 Jobs.jsx에 있는 수동 테스트 칩 전용): toggleTestSubJob(...) / toggleChatSubJob(...)
// 를 호출해주기만 하면, 이 값을 구독하는 모든 화면(마이페이지, 채용공고 스마트픽 등)이
// 리렌더링되면서 실시간으로 같이 바뀜 — React Context의 기본 동작이라 화면마다
// "다시 불러오기" 로직을 따로 짤 필요가 없음.

const TEST_WEIGHT = 0.7
const CHAT_WEIGHT = 0.3

function emptyScores() {
  return Object.fromEntries(JOB_CATEGORIES.map((c) => [c, 0]))
}

function emptySubJobScores() {
  return Object.fromEntries(ALL_SUB_JOBS.map(({ subJob }) => [subJob, 0]))
}

// 인자로 카테고리 문자열 하나만 오면(예: 'IT/SW') 그 카테고리에 100% 몰아준 벡터로
// 취급하고, 이미 { 'IT/SW': 0.7, '디자인': 0.1, ... } 같은 확률 분포 객체가 오면
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

// toVector의 세부직무 버전. 문자열 하나(예: '백엔드개발자')가 오면 그 직무에 100%
// 몰아준 벡터로 취급하고, { '백엔드개발자': 0.8, 'UI/UX 디자이너': 0.2, ... } 같은
// 분포 객체가 오면 그대로 사용. 설문 채점 로직/채팅 분석(GPT+RAG 등)이 실제로 붙을 때
// setTestSubJobResult(...) / setChatSubJobResult(...)에 결과를 그대로 넘기면 됨.
function toSubJobVector(input) {
  if (typeof input === 'string') {
    const vector = emptySubJobScores()
    vector[input] = 1
    return vector
  }
  return { ...emptySubJobScores(), ...input }
}

function argmaxCategory(scores) {
  return JOB_CATEGORIES.reduce((best, c) => (scores[c] > scores[best] ? c : best), JOB_CATEGORIES[0])
}

// 세부직무 콤보 점수에서 상위 3개를 뽑아 [{ subJob, category }, ...]로 반환.
// 아직 진단 전(전부 0점)이어도 스마트픽이 항상 3건을 보여줄 수 있도록 ALL_SUB_JOBS
// 선언 순서로 상위 3개를 채움 — 동점 처리도 이 순서를 그대로 따름(Array.sort는
// 안정 정렬이라 점수가 같으면 원래 순서가 유지됨).
function top3SubJobs(scores) {
  return [...ALL_SUB_JOBS].sort((a, b) => scores[b.subJob] - scores[a.subJob]).slice(0, 3)
}

const PreferenceContext = createContext(null)

export function PreferenceProvider({ children }) {
  // TODO: 적성 검사 결과가 나오는 시점에 setTestResult(대분류), 채팅 분석이 끝나는
  // 시점에 setChatResult(대분류)를 호출하도록 연동. 세부직무 단위(스마트픽의 "추천
  // 직업 3개")도 같은 방식으로 검사/채팅 쪽에서 toggleTestSubJob / toggleChatSubJob을
  // 호출하거나, 향후 서버가 분포를 통째로 계산해주면 그 값을 바로 반영하는 setter로
  // 바꿔주면 됨. 아직 둘 다 연동 전이라 초기값은 전부 0(무응답) 상태.
  const [testScores, setTestScores] = useState(emptyScores)
  const [chatScores, setChatScores] = useState(emptyScores)
  const [testSubJobScores, setTestSubJobScores] = useState(emptySubJobScores)
  const [chatSubJobScores, setChatSubJobScores] = useState(emptySubJobScores)

  // 선호 근무 지역 — 선호 추천 분야(대분류)와 달리 검사/채팅 결과로 자동 계산되는
  // 값이 아니라 마이페이지에서 사용자가 직접 고르는 값. 채용공고 검색탭(Jobs.jsx)의
  // 지역 드롭다운과 똑같은 목록(ALL_REGION/REGIONS/REMOTE_REGION)을 그대로 씀.
  // 기본값은 ALL_REGION('전체 지역') = 아직 특정 지역을 고르지 않은 상태.
  const [preferredRegion, setPreferredRegion] = useState(ALL_REGION)

  // 경력 구분 — 선호 근무 지역과 마찬가지로 검사/채팅 결과가 아니라 마이페이지에서
  // 사용자가 직접 고르는 값(공유 레포 기준 CAREER_LEVELS = ['무관', '신입', '경력']).
  // 기본값은 CAREER_LEVELS[0]('무관') = 아직 특정 경력을 고르지 않은 상태.
  const [careerLevel, setCareerLevel] = useState(CAREER_LEVELS[0])

  const combinedScores = useMemo(() => {
    const result = emptyScores()
    JOB_CATEGORIES.forEach((c) => {
      result[c] = testScores[c] * TEST_WEIGHT + chatScores[c] * CHAT_WEIGHT
    })
    return result
  }, [testScores, chatScores])

  const preferredCategory = useMemo(() => argmaxCategory(combinedScores), [combinedScores])

  const combinedSubJobScores = useMemo(() => {
    const result = emptySubJobScores()
    ALL_SUB_JOBS.forEach(({ subJob }) => {
      result[subJob] = testSubJobScores[subJob] * TEST_WEIGHT + chatSubJobScores[subJob] * CHAT_WEIGHT
    })
    return result
  }, [testSubJobScores, chatSubJobScores])

  // 추천 직업 3개 — 채용공고 스마트픽 전용. 항상 [{ subJob, category }] 3건 고정 길이.
  const recommendedJobs = useMemo(() => top3SubJobs(combinedSubJobScores), [combinedSubJobScores])

  // 검사·채팅 둘 다 아직 한 번도 결과를 안 준 상태(전부 0점)인지 여부.
  // preferredCategory/recommendedJobs는 이 경우에도 뭔가 값을 반환하기 때문에(스마트픽이
  // 항상 결과를 보여줘야 하니까), 화면에 "아직 진단 전"이라고 정직하게 보여주고 싶은
  // 곳(마이페이지 등)에서는 이 값으로 분기하면 됨.
  const hasPreferenceData = useMemo(
    () => JOB_CATEGORIES.some((c) => testScores[c] > 0 || chatScores[c] > 0),
    [testScores, chatScores]
  )

  const hasSubJobPreferenceData = useMemo(
    () => ALL_SUB_JOBS.some(({ subJob }) => testSubJobScores[subJob] > 0 || chatSubJobScores[subJob] > 0),
    [testSubJobScores, chatSubJobScores]
  )

  // 선호 근무 지역을 실제로 하나 골랐는지 여부(기본값 ALL_REGION 상태면 미설정).
  const hasRegionPreference = preferredRegion !== ALL_REGION

  // 마이페이지의 "초기화" 버튼용 — 검사·채팅 점수(대분류+세부직무 전부)를 0으로
  // 되돌려서 hasPreferenceData/hasSubJobPreferenceData가 다시 false가 되고
  // preferredCategory/recommendedJobs 표시도 "미설정" 상태로 돌아가게 함.
  function resetPreference() {
    setTestScores(emptyScores())
    setChatScores(emptyScores())
    setTestSubJobScores(emptySubJobScores())
    setChatSubJobScores(emptySubJobScores())
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

      recommendedJobs,
      hasSubJobPreferenceData,
      combinedSubJobScores,
      testSubJobScores,
      chatSubJobScores,
      // 세부직무 하나를 켜고/끄는 토글(수동 테스트 칩 전용). 대분류용
      // setTestResult/setChatResult와 달리 기존 선택을 덮어쓰지 않아서, 여러 직무를
      // 동시에 켜보고 "추천 직업 3개"가 어떻게 뽑히는지 손으로 테스트해볼 수 있음.
      toggleTestSubJob: (subJob) =>
        setTestSubJobScores((prev) => ({ ...prev, [subJob]: prev[subJob] > 0 ? 0 : 1 })),
      toggleChatSubJob: (subJob) =>
        setChatSubJobScores((prev) => ({ ...prev, [subJob]: prev[subJob] > 0 ? 0 : 1 })),

      // 실제 연동용: 설문 채점 로직이 끝나면 setTestSubJobResult(...), 채팅 분석(GPT+RAG 등)이
      // 끝나면 setChatSubJobResult(...)를 호출. 세부직무 문자열 하나만 넘겨도 되고(그 직무에
      // 100% 몰아줌), { 세부직무: 점수, ... } 분포 객체를 통째로 넘겨도 됨(toSubJobVector 참고).
      // 호출 즉시 testSubJobScores/chatSubJobScores → combinedSubJobScores → recommendedJobs
      // 순서로 다시 계산되고, 이 값을 구독하는 모든 화면(Jobs.jsx 스마트픽 등)이 React
      // Context 특성상 자동으로 리렌더링됨 — 화면마다 "다시 불러오기"를 따로 짤 필요 없음.
      setTestSubJobResult: (subJobOrVector) => setTestSubJobScores(toSubJobVector(subJobOrVector)),
      setChatSubJobResult: (subJobOrVector) => setChatSubJobScores(toSubJobVector(subJobOrVector)),

      // 선호 근무 지역 — 마이페이지에서 직접 고름(채용공고 검색탭과 같은 REGIONS 목록 사용).
      preferredRegion,
      hasRegionPreference,
      setPreferredRegion,

      // 경력 구분 — 마이페이지에서 직접 고름(선호 근무 지역과 같은 패턴).
      careerLevel,
      setCareerLevel,

      resetPreference,
    }),
    [
      preferredCategory,
      hasPreferenceData,
      combinedScores,
      testScores,
      chatScores,
      recommendedJobs,
      hasSubJobPreferenceData,
      combinedSubJobScores,
      testSubJobScores,
      chatSubJobScores,
      preferredRegion,
      hasRegionPreference,
      careerLevel,
    ]
  )

  return <PreferenceContext.Provider value={value}>{children}</PreferenceContext.Provider>
}

// Header.jsx처럼 로그인 전(랜딩 페이지)과 로그인 후(AppLayout 안, PreferenceProvider
// 하위) 두 곳에서 전부 렌더링되는 컴포넌트가 있어서, 여기서는 Provider가 없다고
// 에러를 던지지 않고 "아무 값도 없는" 안전한 기본값을 돌려줌. 이 기본값 상태에서는
// hasPreferenceData/hasSubJobPreferenceData가 항상 false라서, 관련 박스를 로그인
// 여부와 무관하게 무조건 렌더링해도 로그인 전 화면에서 깨지지 않음(값을 실제로
// 바꾸는 setTestResult/toggleTestSubJob/resetPreference 등은 Provider 밖에서
// 호출하면 아무 동작도 안 함).
const noopPreference = {
  preferredCategory: undefined,
  hasPreferenceData: false,
  combinedScores: {},
  testScores: {},
  chatScores: {},
  setTestResult: () => {},
  setChatResult: () => {},

  recommendedJobs: [],
  hasSubJobPreferenceData: false,
  combinedSubJobScores: {},
  testSubJobScores: {},
  chatSubJobScores: {},
  toggleTestSubJob: () => {},
  toggleChatSubJob: () => {},
  setTestSubJobResult: () => {},
  setChatSubJobResult: () => {},

  preferredRegion: ALL_REGION,
  hasRegionPreference: false,
  setPreferredRegion: () => {},

  careerLevel: CAREER_LEVELS[0],
  setCareerLevel: () => {},

  resetPreference: () => {},
}

export function usePreference() {
  const ctx = useContext(PreferenceContext)
  return ctx ?? noopPreference
}
