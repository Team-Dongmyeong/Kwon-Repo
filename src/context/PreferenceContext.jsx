import { createContext, useContext, useMemo, useState } from 'react'
import { SUB_JOBS_BY_CATEGORY, ALL_REGION, CAREER_LEVELS } from '../constants/jobCategories.js'

// "선호 추천 분야"(대분류 1개) · "선호 근무 지역" · "경력 구분" — 이 3개를 전부
// 마이페이지 "내 정보 수정하기"에서 사용자가 직접 고르고, 채용공고 스마트픽은
// 이 3개 값만 가지고 추론함. (2026-10-11 변경 전에는 선호 추천 분야가 적성
// 검사 70% + 채팅 분석 30%로 자동 계산됐었는데, 그 자동 계산 로직은 전부
// 삭제하고 마이페이지에서 직접 고르는 값으로 바꿨음. 적성 검사는 "진단하기"
// 퀴즈로 여전히 남아있지만, 이제는 결과를 보여주기만 하고 더 이상 이 값에
// 반영되지 않음 — Header.jsx/PreferenceQuiz.jsx 참고.)

// 대분류 하나를 고르면, 그 대분류에 속한 세부직무 중 "직무공통"을 뺀 나머지를
// 선언 순서 그대로 최대 3개까지 보여줌 — 예전처럼 검사/채팅 점수로 순위를 매기는
// 게 아니라, 그냥 그 대분류를 대표하는 세부직무 몇 개를 보여주는 용도라서
// 매칭률(%) 같은 건 더 이상 계산하지 않음. (대분류 안에 "직무공통" 제외하고
// 세부직무가 1~2개뿐인 경우—예: 공공·복지—는 1~2개만 반환됨, 억지로 3개를
// 채우지 않음.)
function representativeSubJobs(category) {
  if (!category) return []
  return (SUB_JOBS_BY_CATEGORY[category] ?? [])
    .filter((subJob) => subJob !== '직무공통')
    .slice(0, 3)
    .map((subJob) => ({ subJob, category }))
}

const PreferenceContext = createContext(null)

export function PreferenceProvider({ children }) {
  // 선호 추천 분야 — 마이페이지에서 직접 고름(대분류 5개 중 하나). 기본값 null =
  // 아직 고르지 않은 상태. 더 이상 검사/채팅 결과로 자동 계산되지 않음.
  const [preferredCategory, setPreferredCategory] = useState(null)

  // 선호 근무 지역 — 마이페이지에서 직접 고름(채용공고 검색탭과 같은
  // ALL_REGION/REGIONS/REMOTE_REGION 목록 사용). 기본값은 ALL_REGION('전체
  // 지역') = 아직 특정 지역을 고르지 않은 상태.
  const [preferredRegion, setPreferredRegion] = useState(ALL_REGION)

  // 경력 구분 — 선호 근무 지역과 같은 패턴으로 마이페이지에서 직접 고름
  // (CAREER_LEVELS = ['무관', '신입', '경력']). 기본값은 CAREER_LEVELS[0]('무관')
  // = 아직 특정 경력을 고르지 않은 상태.
  const [careerLevel, setCareerLevel] = useState(CAREER_LEVELS[0])

  // 선호 추천 분야를 실제로 하나 골랐는지 여부. false면 "추천 직업"
  // 영역(마이페이지 추천직업 탭 / Jobs.jsx 스마트픽)에 아무것도 없다는 뜻이라,
  // 이 값으로 "아직 선택 안 함" 안내문구와 실제 추천을 구분해서 보여줌.
  const hasPreferenceData = preferredCategory !== null

  // 선호 근무 지역을 실제로 하나 골랐는지 여부(기본값 ALL_REGION 상태면 미설정).
  const hasRegionPreference = preferredRegion !== ALL_REGION

  // 경력 구분을 실제로 하나 골랐는지 여부(기본값 '무관' 상태면 미설정 취급).
  // 스마트픽에서 지역과 같은 방식으로 이 값과 일치하는 공고를 우선 배치하는 데 씀.
  const hasCareerPreference = careerLevel !== CAREER_LEVELS[0]

  // 추천 직업(대표 세부직무, 최대 3개) — 채용공고 스마트픽 + 마이페이지
  // "추천직업" 탭이 공통으로 구독. preferredCategory가 바뀌면 자동으로 다시 계산됨.
  const recommendedJobs = useMemo(() => representativeSubJobs(preferredCategory), [preferredCategory])

  // 마이페이지 "선호 추천 분야" 항목의 초기화 버튼용.
  function resetPreference() {
    setPreferredCategory(null)
  }

  const value = useMemo(
    () => ({
      preferredCategory,
      hasPreferenceData,
      setPreferredCategory,

      recommendedJobs,

      // 선호 근무 지역 — 마이페이지에서 직접 고름(채용공고 검색탭과 같은 REGIONS 목록 사용).
      preferredRegion,
      hasRegionPreference,
      setPreferredRegion,

      // 경력 구분 — 마이페이지에서 직접 고름(선호 근무 지역과 같은 패턴).
      careerLevel,
      hasCareerPreference,
      setCareerLevel,

      resetPreference,
    }),
    [preferredCategory, hasPreferenceData, recommendedJobs, preferredRegion, hasRegionPreference, careerLevel, hasCareerPreference]
  )

  return <PreferenceContext.Provider value={value}>{children}</PreferenceContext.Provider>
}

// Header.jsx처럼 로그인 전(랜딩 페이지)과 로그인 후(AppLayout 안, PreferenceProvider
// 하위) 두 곳에서 전부 렌더링되는 컴포넌트가 있어서, 여기서는 Provider가 없다고
// 에러를 던지지 않고 "아무 값도 없는" 안전한 기본값을 돌려줌. 이 기본값 상태에서는
// hasPreferenceData가 항상 false라서, 관련 박스를 로그인 여부와 무관하게 무조건
// 렌더링해도 로그인 전 화면에서 깨지지 않음(값을 실제로 바꾸는 setPreferredCategory 등은
// Provider 밖에서 호출하면 아무 동작도 안 함).
const noopPreference = {
  preferredCategory: null,
  hasPreferenceData: false,
  setPreferredCategory: () => {},

  recommendedJobs: [],

  preferredRegion: ALL_REGION,
  hasRegionPreference: false,
  setPreferredRegion: () => {},

  careerLevel: CAREER_LEVELS[0],
  hasCareerPreference: false,
  setCareerLevel: () => {},

  resetPreference: () => {},
}

export function usePreference() {
  const ctx = useContext(PreferenceContext)
  return ctx ?? noopPreference
}
