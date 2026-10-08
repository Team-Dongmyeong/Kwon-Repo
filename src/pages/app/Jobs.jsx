import { useEffect, useMemo, useState } from 'react'
import {
  MagnifyingGlass,
  MapPin,
  Buildings,
  CalendarBlank,
  BookmarkSimple,
  Sparkle,
  Star,
  ArrowSquareOut,
} from '@phosphor-icons/react'
// 채용공고는 더 이상 정적 mock 파일(mocks/jobsReal.js)을 쓰지 않고, 백엔드
// FastAPI의 /api/jobs 엔드포인트에서 가져옴 — 백엔드가 재정경제부 공공데이터
// API를 서버 쪽에서 직접 호출/가공해주고(30분 캐시), 여기선 fetch만 하면 됨.
// (mocks/jobsReal.js, job-fetch/fetch_jobs_to_mock.py는 더 이상 쓰지 않지만
// 당장은 참고용으로 남겨둠 — 정리는 나중에.)
import { fetchJobs } from '../../lib/jobsApi.js'
import { usePreference } from '../../context/PreferenceContext.jsx'
import {
  JOB_CATEGORIES,
  ALL_SUB_JOBS,
  ALL_REGION,
  REMOTE_REGION,
  REGIONS,
  JOB_CAREER_LEVELS,
  NCS_GROUPS_BY_CATEGORY,
} from '../../constants/jobCategories.js'

// 지역/경력/카테고리 상수는 마이페이지 등 다른 화면과 공유하려고 constants/jobCategories.js로
// 옮겼음(예전엔 이 파일에만 있었음). 동작은 그대로라 여기서 할 일은 없음.

// 채용공고 리스트 전용 페이지네이션 — 스마트픽/필터 영역은 이 값과 무관하게
// 항상 그대로 있고, 리스트 섹션만 이 크기로 잘려서 페이지가 바뀜.
const JOBS_PER_PAGE = 10

// deadline('YYYY-MM-DD' | '상시채용')을 스마트픽 리스트용 'D-N' 표기로 변환.
// 오늘 날짜 기준으로 매번 계산되므로 새로고침할 때마다 자동으로 갱신됨.
function formatDday(deadline) {
  if (deadline === '상시채용') return '상시채용'
  const diff = Math.ceil((new Date(deadline) - new Date()) / (1000 * 60 * 60 * 24))
  if (diff < 0) return '마감'
  return diff === 0 ? '오늘마감' : `D-${diff}`
}

// 공공기관 채용정보 API가 실제 링크 대신 "없음"/"해당없음"/"." 같은 안내 텍스트를
// srcUrl에 넣어서 주는 경우가 있음(예: 한전KDN 공고들 — 눌러도 안 넘어가던 원인).
// job-fetch/fetch_jobs_to_mock.py 쪽에서 이런 값은 빈 문자열로 정리하도록
// 고쳐뒀지만, 이미 만들어진 jobsReal.js(재실행 전)에는 여전히 남아있을 수 있어서
// 프론트에서도 한 번 더 걸러줌 — http(s)로 시작하는 값만 "진짜 링크"로 인정.
function isValidJobUrl(url) {
  return typeof url === 'string' && /^https?:\/\//i.test(url.trim())
}

export default function Jobs() {
  const [keyword, setKeyword] = useState('')
  const [region, setRegion] = useState(ALL_REGION)
  // 대분류 -> 지역 -> 경력, 3단계 필터.
  // (예전엔 대분류 다음에 "세부직무" 단계가 하나 더 있었는데, 세부직무는 공고 제목
  // 키워드로 "추정"한 값이라 정확도가 낮아서 뺐음 — 재정경제부 API가 공고에 직접
  // 붙여주는 건 NCS 대분류뿐이라, 대분류 필터만 신뢰도 있게 걸러짐. 세부직무 단위
  // 추천은 스마트픽 쪽에서만 참고용으로 계속 씀.)
  const [activeCategory, setActiveCategory] = useState(null)
  const [careerLevel, setCareerLevel] = useState(null)
  // 대분류 안에서 실제 NCS 코드가 2개로 나뉘는 카테고리(디자인/식·음료/MD·상품기획)에서만
  // 쓰는 추가 필터. 공고 제목 추정이 아니라 fetch_jobs_to_mock.py가 어떤 NCS 코드로
  // 그 공고를 수집했는지 그대로 반영한 값(job.ncsGroup)과 비교하므로 신뢰도 있음.
  const [activeNcsGroup, setActiveNcsGroup] = useState(null)

  // 채용공고 데이터 — 백엔드 /api/jobs에서 받아옴. 마운트 시 한 번만 호출하고,
  // 백엔드가 30분 캐시를 들고 있어서 여기서 또 자주 다시 부를 필요는 없음.
  const [jobs, setJobs] = useState([])
  const [jobsLoading, setJobsLoading] = useState(true)
  const [jobsError, setJobsError] = useState(null)

  useEffect(() => {
    let ignore = false
    setJobsLoading(true)
    setJobsError(null)
    fetchJobs()
      .then((data) => {
        if (!ignore) setJobs(data)
      })
      .catch((err) => {
        if (!ignore) setJobsError(err.message || '채용공고를 불러오지 못했습니다.')
      })
      .finally(() => {
        if (!ignore) setJobsLoading(false)
      })
    return () => {
      ignore = true
    }
  }, [])

  const handleCategoryClick = (category) => {
    const isActive = activeCategory === category
    setActiveCategory(isActive ? null : category)
    // 대분류가 바뀌면(혹은 선택 해제되면) 이전 대분류 기준으로 골라둔 NCS 그룹은
    // 더 이상 의미가 없으니 같이 초기화.
    setActiveNcsGroup(null)
  }

  // 마이페이지의 "공고 확인하기"(/home/jobs?job=직업명) 같은 딥링크로 들어왔을 때,
  // 그 직업이 속한 대분류를 찾아서 위 필터를 미리 눌러놓은 상태로 만들어줌(세부직무까지는
  // 못 좁히지만 대분류는 신뢰도 있게 좁혀짐). 첫 렌더링 때 한 번만 확인하면 되므로
  // 의존성 배열은 비워둠.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const jobParam = params.get('job')
    if (!jobParam) return
    const found = ALL_SUB_JOBS.find((item) => item.subJob === jobParam)
    if (!found) return
    setActiveCategory(found.category)
  }, [])

  const filteredJobs = useMemo(() => {
    const trimmed = keyword.trim()
    return jobs.filter((job) => {
      const matchesKeyword =
        trimmed === '' || job.title.includes(trimmed) || job.company.includes(trimmed)
      const matchesRegion = region === ALL_REGION || job.location.includes(region)
      const matchesCategory = !activeCategory || job.category === activeCategory
      const matchesNcsGroup = !activeNcsGroup || job.ncsGroup === activeNcsGroup
      const matchesCareer = !careerLevel || job.type.includes(careerLevel)
      return matchesKeyword && matchesRegion && matchesCategory && matchesNcsGroup && matchesCareer
    })
  }, [jobs, keyword, region, activeCategory, activeNcsGroup, careerLevel])

  // 채용공고 리스트 페이지네이션. 필터 조건이 바뀌어서 결과가 달라지면 1페이지로
  // 되돌아감 — 그래야 필터 바꿨는데 화면엔 없는 4페이지에 머물러서 "결과 없음"처럼
  // 보이는 상황을 방지함.
  const [page, setPage] = useState(1)
  useEffect(() => {
    setPage(1)
  }, [keyword, region, activeCategory, activeNcsGroup, careerLevel])

  const totalPages = Math.max(1, Math.ceil(filteredJobs.length / JOBS_PER_PAGE))
  const pagedJobs = useMemo(
    () => filteredJobs.slice((page - 1) * JOBS_PER_PAGE, page * JOBS_PER_PAGE),
    [filteredJobs, page]
  )

  // 페이지 번호 버튼도 10개 단위로 끊어서 보여줌(전체 페이지가 많아도 번호가
  // 한 줄에 다 안 나오도록). 지금 보고 있는 page가 속한 묶음(1~10, 11~20, ...)만
  // 계산해서 보여주고, "이전/다음"으로 묶음 경계를 넘어가면 자동으로 다음 묶음의
  // 번호들로 바뀜.
  const PAGE_GROUP_SIZE = 10
  const pageGroupStart = Math.floor((page - 1) / PAGE_GROUP_SIZE) * PAGE_GROUP_SIZE + 1
  const pageGroupEnd = Math.min(pageGroupStart + PAGE_GROUP_SIZE - 1, totalPages)
  const pageNumbers = Array.from(
    { length: pageGroupEnd - pageGroupStart + 1 },
    (_, i) => pageGroupStart + i
  )

  // recommendedJobs = 적성 검사 70% + 채팅 분석 30%로 계산된 "추천 직업 3개"
  // ([{ subJob, category }, ...] 세부직무 단위). AppLayout에 올려둔 PreferenceProvider를
  // 앱 내 모든 화면이 같이 구독하기 때문에, 마이페이지 쪽에서 검사/채팅 결과가 반영돼
  // 이 값이 바뀌면 이 페이지를 벗어나지 않아도(혹은 나중에 다시 들어와도) 아래
  // smartPickJobs가 자동으로 다시 계산됨.
  const {
    recommendedJobs,
    combinedSubJobScores,
    // 마이페이지에서 고른 "선호 근무 지역" — 스마트픽 공고 3건을 추릴 때 이 지역과
    // 일치하는 공고를 우선 배치하는 데 씀(ALL_REGION 기본값일 땐 미설정 취급).
    preferredRegion,
    hasRegionPreference,
  } = usePreference()

  // 스마트픽에서 지금 선택된 "추천 직업" 하나 — 기본값은 추천 1순위.
  const [selectedJob, setSelectedJob] = useState(null)
  useEffect(() => {
    // recommendedJobs가 바뀌었는데(재진단 등) 지금 선택이 더 이상 추천 목록에 없으면
    // 1순위로 되돌림. 최초 렌더링 때도 이 분기를 타서 selectedJob이 채워짐.
    if (recommendedJobs.length > 0 && !recommendedJobs.some((j) => j.subJob === selectedJob)) {
      setSelectedJob(recommendedJobs[0].subJob)
    }
  }, [recommendedJobs, selectedJob])

  // 지금 선택된 추천 직업(selectedJob)이 속한 대분류 — "서울 + 디자인"처럼 지역과
  // 분야를 같이 맞추려면 선호 추천 분야(대분류) 기준으로 공고 풀을 좁혀야 해서 필요.
  const selectedCategory = recommendedJobs.find((j) => j.subJob === selectedJob)?.category

  // 스마트픽 공고 3건을 고르는 순서 (우선순위 높은 순):
  //   1순위: 세부직무까지 정확히 일치(matched)
  //   2순위: 같은 대분류(선호 추천 분야)지만 세부직무는 다름(sameCategoryRest) — 전에는
  //          이 2순위가 "전체 공고"였어서, 세부직무 매칭이 거의 없는 공공기관 공고
  //          특성상 엉뚱한 대분류(예: IT/SW) 공고가 지역만 맞다고 섞여 들어오는
  //          문제가 있었음. 대분류로 한 번 더 좁혀서 "서울 + 디자인"처럼 지역과
  //          분야가 같이 맞는 공고만 뜨도록 고침.
  //   3순위: 그래도 3건이 안 채워질 때만 전체 공고(globalRest)로 채움(항상 3건
  //          보여주기 위한 최후 보루 — 보통 대분류 공고 수가 충분해서 거의 안 씀)
  // 각 순위 묶음 안에서는 "선호 근무 지역"(마이페이지에서 설정)과 일치하는 공고를
  // 앞쪽으로 한 번 더 정렬함 — Array.sort는 안정 정렬이라 지역 일치 여부 외의
  // 원래 순서는 그대로 유지됨.
  const smartPickJobs = useMemo(() => {
    if (!selectedJob) return []
    const isRegionMatch = (job) => hasRegionPreference && job.location.includes(preferredRegion)
    const sortByRegion = (jobs) =>
      hasRegionPreference
        ? [...jobs].sort((a, b) => Number(isRegionMatch(b)) - Number(isRegionMatch(a)))
        : jobs
    const matched = jobs.filter((job) => job.subJob === selectedJob)
    const sameCategoryRest = jobs.filter(
      (job) => job.subJob !== selectedJob && job.category === selectedCategory
    )
    const combined = [...sortByRegion(matched), ...sortByRegion(sameCategoryRest)]
    if (combined.length >= 3) return combined.slice(0, 3)
    const globalRest = jobs.filter((job) => job.subJob !== selectedJob && job.category !== selectedCategory)
    return [...combined, ...sortByRegion(globalRest)].slice(0, 3)
  }, [jobs, selectedJob, selectedCategory, preferredRegion, hasRegionPreference])

  return (
    <div className="space-y-6">
      {/* 히어로 배너 — 브랜드 팔레트(ink → coral) 그라디언트로 참고 이미지의 구성을 재해석 */}
      <section className="relative overflow-hidden rounded-card bg-ink p-8 shadow-2 sm:p-10">
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: 'linear-gradient(120deg, #141413 0%, #2B2B2A 45%, #9A3A0A 100%)' }}
          aria-hidden="true"
        />
        <div className="relative flex flex-col items-start justify-between gap-8 sm:flex-row sm:items-center">
          <div className="max-w-xl">
            <span className="inline-flex items-center rounded-pill bg-white/15 px-3 py-1 text-eyebrow text-white">
              취업 준비를 한 번에
            </span>
            <h1 className="mt-4 text-h2 text-white sm:text-h2-md">
              자신에게 맞는 공고를
              <br />
              빠르게 찾아보세요.
            </h1>
            <p className="mt-3 text-body text-white/70">
              직무 키워드와 지역을 입력하면 신입·인턴 중심의 채용정보를 빠르게 검색할 수 있습니다.
            </p>
          </div>
        </div>
      </section>

      {/* 검색 / 필터 */}
      <section className="rounded-card bg-white p-6 shadow-1 sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <label className="flex-1">
            <span className="text-nav text-ink">키워드</span>
            <div className="mt-2 flex items-center gap-2 rounded-btn border-[1.5px] border-taupe px-4 py-2.5 focus-within:border-ink">
              <MagnifyingGlass size={18} className="shrink-0 text-slate" aria-hidden="true" />
              <input
                type="text"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="예: 개발자, 마케팅, 영상편집"
                className="w-full bg-transparent text-body text-ink placeholder:text-taupe focus:outline-none"
              />
            </div>
          </label>

          <label className="sm:w-48">
            <span className="text-nav text-ink">지역</span>
            <select
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              className="mt-2 w-full rounded-btn border-[1.5px] border-taupe bg-white px-4 py-2.5 text-body text-ink focus:border-ink focus:outline-none"
            >
              <option value={ALL_REGION}>{ALL_REGION}</option>
              {REGIONS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
              <option value={REMOTE_REGION}>{REMOTE_REGION}</option>
            </select>
          </label>

          <button type="button" className="btn-accent sm:w-auto">
            공고 검색
          </button>
        </div>

        {/* 1단계: 대분류 */}
        <div className="mt-4">
          <span className="text-footer text-slate">대분류</span>
          <div className="mt-2 flex flex-wrap gap-2">
            {JOB_CATEGORIES.map((c) => {
              const isActive = activeCategory === c
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => handleCategoryClick(c)}
                  aria-pressed={isActive}
                  className={`rounded-pill border-[1.5px] px-4 py-1.5 text-nav transition-colors ${
                    isActive
                      ? 'border-ink bg-ink text-white'
                      : 'border-taupe bg-white text-ink hover:border-ink'
                  }`}
                >
                  {c}
                </button>
              )
            })}
          </div>
        </div>

        {/* 대분류 안에서 NCS 코드가 2개로 나뉘는 경우에만 보여주는 추가 필터
            (예: '디자인' = 문화예술디자인방송 + 섬유의복(패션디자이너)). 코드가
            1개뿐인 대분류(IT/SW, 공공·복지)는 나눌 게 없어서 아예 안 보여줌. */}
        {activeCategory && NCS_GROUPS_BY_CATEGORY[activeCategory]?.length > 1 && (
          <div className="mt-4">
            <span className="text-footer text-slate">{activeCategory} 세부 분류</span>
            <div className="mt-2 flex flex-wrap gap-2">
              {NCS_GROUPS_BY_CATEGORY[activeCategory].map((group) => {
                const isActive = activeNcsGroup === group
                return (
                  <button
                    key={group}
                    type="button"
                    onClick={() => setActiveNcsGroup(isActive ? null : group)}
                    aria-pressed={isActive}
                    className={`rounded-pill border-[1.5px] px-4 py-1.5 text-nav transition-colors ${
                      isActive
                        ? 'border-ink bg-ink text-white'
                        : 'border-taupe bg-white text-ink hover:border-ink'
                    }`}
                  >
                    {group}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* 2단계: 경력 (지역은 위쪽 드롭다운에서 이미 선택) */}
        <div className="mt-4">
          <span className="text-footer text-slate">경력</span>
          <div className="mt-2 flex flex-wrap gap-2">
            {JOB_CAREER_LEVELS.map((c) => {
              const isActive = careerLevel === c
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCareerLevel(isActive ? null : c)}
                  aria-pressed={isActive}
                  className={`rounded-pill border-[1.5px] px-4 py-1.5 text-nav transition-colors ${
                    isActive
                      ? 'border-ink bg-ink text-white'
                      : 'border-taupe bg-white text-ink hover:border-ink'
                  }`}
                >
                  {c}
                </button>
              )
            })}
          </div>
        </div>
      </section>

      {/* 스마트픽 — 추천 직업 3개(적성 검사 70% + 채팅 분석 30%) 중 고른 직업의 공고 TOP 3 */}
      <section className="rounded-card bg-white p-6 shadow-1 sm:p-8">
        <div className="mb-2 flex items-center justify-between">
          <p className="flex items-center gap-2 text-nav text-ink">
            <Sparkle size={18} weight="fill" className="text-coral" aria-hidden="true" />
            스마트픽
          </p>
          <span className="rounded-pill bg-coral-bg px-3 py-1 text-footer text-coral-deep">
            추천 직업 맞춤 TOP 3
          </span>
        </div>

        {/* 추천 직업 3개 — 버튼으로 보여주고, 클릭한 직업에 맞는 공고 3건을 아래에 표시.
            매칭률(%)은 진단·채팅 결과가 그 세부직무에 얼마나 실렸는지를 그대로 보여줌. */}
        <div className="mb-4 flex flex-wrap gap-2">
          {recommendedJobs.map(({ subJob, category }) => {
            const isActive = selectedJob === subJob
            const rate = Math.round((combinedSubJobScores[subJob] ?? 0) * 100)
            return (
              <button
                key={subJob}
                type="button"
                onClick={() => setSelectedJob(subJob)}
                aria-pressed={isActive}
                className={`rounded-pill border-[1.5px] px-4 py-1.5 text-nav transition-colors ${
                  isActive
                    ? 'border-coral bg-coral text-white'
                    : 'border-taupe bg-white text-ink hover:border-coral'
                }`}
              >
                {subJob}
                <span className={`ml-1.5 text-footer ${isActive ? 'text-white/70' : 'text-taupe'}`}>
                  {category}
                </span>
                {rate > 0 && (
                  <span
                    className={`ml-1.5 text-footer font-semibold ${isActive ? 'text-white' : 'text-coral'}`}
                  >
                    {rate}%
                  </span>
                )}
              </button>
            )
          })}
        </div>

        <div className="divide-y divide-canvas-lift">
          {smartPickJobs.map((job) => {
            const isMatched = job.subJob === selectedJob
            const isRegionMatch = hasRegionPreference && job.location.includes(preferredRegion)
            // URL이 있으면 카드 전체를 새 탭 링크로, 없으면 그냥 div로 — Jobs.jsx
            // 아래쪽 채용공고 리스트처럼 클릭하면 바로 실제 공고 페이지로 이동함.
            const hasValidUrl = isValidJobUrl(job.url)
            const CardTag = hasValidUrl ? 'a' : 'div'
            return (
              <CardTag
                key={job.id}
                {...(hasValidUrl ? { href: job.url, target: '_blank', rel: 'noopener noreferrer' } : {})}
                className={`-mx-2 flex items-center gap-4 rounded-btn px-2 py-4 transition-colors first:pt-4 last:pb-4 ${
                  hasValidUrl ? 'cursor-pointer hover:bg-canvas-lift' : ''
                }`}
              >
                <div
                  className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-btn text-nav ${
                    isMatched ? 'bg-coral-bg text-coral-deep' : 'bg-canvas-lift text-ink-soft'
                  }`}
                  aria-hidden="true"
                >
                  {job.company.replace(/[()]/g, '').slice(0, 2)}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-1.5 text-footer text-slate">
                    {job.company}
                    {isMatched ? (
                      <span className="inline-flex items-center gap-0.5 rounded-pill bg-coral-bg px-2 py-0.5 text-[11px] font-semibold text-coral-deep">
                        <Star size={10} weight="fill" aria-hidden="true" />
                        {job.subJob} 매칭
                      </span>
                    ) : (
                      <span className="rounded-pill bg-canvas px-2 py-0.5 text-[11px] text-taupe">관련 공고</span>
                    )}
                    {isRegionMatch && (
                      <span className="inline-flex items-center gap-0.5 rounded-pill bg-ink/5 px-2 py-0.5 text-[11px] font-semibold text-ink">
                        <MapPin size={10} weight="fill" aria-hidden="true" />
                        선호 지역
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 truncate text-body text-ink">{job.title}</p>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-footer text-slate">
                    <span>{job.type}</span>
                    <span className={isRegionMatch ? 'font-semibold text-coral-deep' : undefined}>
                      {job.location}
                    </span>
                  </div>
                </div>

                <span className="shrink-0 text-footer text-taupe">{formatDday(job.deadline)}</span>
              </CardTag>
            )
          })}
        </div>
      </section>

      {/* 채용공고 리스트 */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <p className="eyebrow-label">
            <span className="h-1.5 w-1.5 rounded-full bg-coral" aria-hidden="true" />
            {jobsLoading ? '채용공고 불러오는 중…' : `채용공고 ${filteredJobs.length}건`}
          </p>
        </div>

        {jobsError ? (
          <div className="rounded-card bg-white p-10 text-center shadow-1">
            <p className="text-body text-slate">채용공고를 불러오지 못했어요. ({jobsError})</p>
          </div>
        ) : jobsLoading ? (
          <div className="rounded-card bg-white p-10 text-center shadow-1">
            <p className="text-body text-slate">채용공고를 불러오는 중이에요…</p>
          </div>
        ) : filteredJobs.length === 0 ? (
          <div className="rounded-card bg-white p-10 text-center shadow-1">
            <p className="text-body text-slate">조건에 맞는 공고가 없어요. 키워드나 지역을 바꿔보세요.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {pagedJobs.map((job) => (
              <article
                key={job.id}
                className="rounded-card bg-white p-6 shadow-1 transition-transform duration-150 hover:-translate-y-0.5 sm:p-8"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="flex items-center gap-1.5 text-footer text-slate">
                      <Buildings size={14} aria-hidden="true" />
                      {job.company}
                    </p>
                    <h2 className="mt-1 text-h3 text-ink">
                      {isValidJobUrl(job.url) ? (
                        <a
                          href={job.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:underline"
                        >
                          {job.title}
                        </a>
                      ) : (
                        job.title
                      )}
                    </h2>
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-footer text-slate">
                      <span className="flex items-center gap-1">
                        <MapPin size={14} aria-hidden="true" />
                        {job.location}
                      </span>
                      <span className="flex items-center gap-1">
                        <CalendarBlank size={14} aria-hidden="true" />
                        마감 {job.deadline}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    aria-label="공고 저장"
                    className="shrink-0 rounded-full p-2 text-taupe transition-colors hover:bg-canvas-lift hover:text-ink"
                  >
                    <BookmarkSimple size={20} aria-hidden="true" />
                  </button>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <span className="rounded-pill bg-coral-bg px-3 py-1 text-footer text-coral-deep">
                    {job.type}
                  </span>
                  {job.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-pill bg-canvas-lift px-3 py-1 text-footer text-ink-soft"
                    >
                      {tag}
                    </span>
                  ))}

                  {isValidJobUrl(job.url) && (
                    <a
                      href={job.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-auto flex items-center gap-1 text-footer font-medium text-coral hover:underline"
                    >
                      지원하러 가기
                      <ArrowSquareOut size={14} aria-hidden="true" />
                    </a>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}

        {/* 페이지네이션 — 리스트 섹션 안에서만 동작. 위쪽 스마트픽/검색·필터 영역은
            그대로 있고 이 카드 목록만 페이지가 바뀜. */}
        {totalPages > 1 && (
          <div className="mt-6 flex items-center justify-center gap-2">
            {/* 묶음(10페이지) 단위로 한 번에 앞으로/뒤로 이동 — 번호 묶음이 많을 때만 노출 */}
            {pageGroupStart > 1 && (
              <button
                type="button"
                onClick={() => setPage(pageGroupStart - 1)}
                className="rounded-btn border-[1.5px] border-taupe px-3 py-1.5 text-nav text-ink transition-colors hover:border-ink"
              >
                «
              </button>
            )}
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="rounded-btn border-[1.5px] border-taupe px-3 py-1.5 text-nav text-ink transition-colors hover:border-ink disabled:cursor-not-allowed disabled:opacity-40"
            >
              이전
            </button>
            {pageNumbers.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPage(p)}
                aria-current={page === p ? 'page' : undefined}
                className={`h-9 w-9 rounded-btn border-[1.5px] text-nav transition-colors ${
                  page === p
                    ? 'border-ink bg-ink text-white'
                    : 'border-taupe bg-white text-ink hover:border-ink'
                }`}
              >
                {p}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="rounded-btn border-[1.5px] border-taupe px-3 py-1.5 text-nav text-ink transition-colors hover:border-ink disabled:cursor-not-allowed disabled:opacity-40"
            >
              다음
            </button>
            {pageGroupEnd < totalPages && (
              <button
                type="button"
                onClick={() => setPage(pageGroupEnd + 1)}
                className="rounded-btn border-[1.5px] border-taupe px-3 py-1.5 text-nav text-ink transition-colors hover:border-ink"
              >
                »
              </button>
            )}
          </div>
        )}
      </section>
    </div>
  )
}
