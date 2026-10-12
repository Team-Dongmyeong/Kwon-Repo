import { useCallback, useEffect, useState } from 'react'
import {
  MagnifyingGlass,
  MapPin,
  Buildings,
  CalendarBlank,
  ArrowSquareOut,
  CaretDown,
  CaretUp,
  UsersThree,
} from '@phosphor-icons/react'
import { fetchPolicies } from '../../lib/policiesApi.js'
import { ALL_REGION, REGIONS } from '../../constants/jobCategories.js'

// 청년정책 페이지 — 온통청년 청년정책 Open API를 백엔드(/api/policies)가 호출/가공해주고,
// 여기선 필터를 백엔드로 넘겨서 결과를 받아 보여주기만 함(채용공고 화면과 같은 구조).

// 온통청년 사이트에 보이는 정책 분류명(금융·복지·문화 / 참여·기반 — 코드정의서의
// '복지문화'/'참여권리'는 예전 이름). 실제 API 필터에 쓸 철자는 백엔드가 알아서
// 맞춰주므로(_youth_resolve_category) 여기선 사이트와 같은 이름만 보내면 됨.
const POLICY_CATEGORIES = ['일자리', '주거', '교육·직업훈련', '금융·복지·문화', '참여·기반']

// 화면 표시용 지역명(value) -> 정책 zipCd 앞 2자리(시도 코드). 강원/전북은 개편 전후
// 코드가 달라서 둘 다 넣어둠.
const REGION_CODES = {
  서울: '11', 부산: '26', 대구: '27', 인천: '28', 광주: '29', 대전: '30', 울산: '31',
  세종: '36', 경기: '41', 강원: '51,42', 충북: '43', 충남: '44', 전북: '52,45',
  전남: '46', 경북: '47', 경남: '48', 제주: '50',
}

function formatStatus(policy) {
  if (policy.applyStatus === '상시') return { text: '상시 신청', tone: 'normal' }
  if (policy.applyStatus === '마감') return { text: '마감', tone: 'closed' }
  if (policy.applyStatus === '진행중' && policy.dDay !== null) {
    if (policy.dDay === 0) return { text: '오늘 마감', tone: 'urgent' }
    return { text: `D-${policy.dDay}`, tone: policy.dDay <= 7 ? 'urgent' : 'normal' }
  }
  return { text: '신청기간 확인', tone: 'normal' }
}

function formatAge(policy) {
  if (policy.ageMin === null) return '연령 제한 없음'
  return policy.ageMax ? `만 ${policy.ageMin}~${policy.ageMax}세` : `만 ${policy.ageMin}세 이상`
}

const STATUS_TONE_CLASS = {
  urgent: 'bg-coral-bg text-coral-deep',
  closed: 'bg-canvas-lift text-taupe',
  normal: 'bg-canvas-lift text-ink-soft',
}

function DetailRow({ label, value }) {
  if (!value) return null
  return (
    <div>
      <dt className="text-footer font-semibold text-ink">{label}</dt>
      <dd className="mt-1 whitespace-pre-line text-footer text-slate">{value}</dd>
    </div>
  )
}

export default function Policies() {
  // 입력 중인 값(draft)과 실제 조회에 쓰는 값(applied)을 분리 — 키워드/나이는 타이핑할
  // 때마다 API를 부르지 않고 "검색" 버튼(또는 Enter)을 눌렀을 때만 반영.
  const [draftKeyword, setDraftKeyword] = useState('')
  const [draftAge, setDraftAge] = useState('')
  const [keyword, setKeyword] = useState('')
  const [age, setAge] = useState('')
  const [region, setRegion] = useState(ALL_REGION)
  const [category, setCategory] = useState('')
  const [includeClosed, setIncludeClosed] = useState(false)

  const [policies, setPolicies] = useState([])
  const [nextPage, setNextPage] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState(null)
  const [expandedId, setExpandedId] = useState(null)

  const buildQuery = useCallback(
    (page) => ({
      page,
      q: keyword,
      category,
      region: region === ALL_REGION ? '' : REGION_CODES[region] || '',
      age,
      includeClosed,
    }),
    [keyword, category, region, age, includeClosed]
  )

  // 필터가 바뀌면 처음(1페이지)부터 다시 조회
  useEffect(() => {
    let ignore = false
    setLoading(true)
    setError(null)
    setExpandedId(null)
    fetchPolicies(buildQuery(1))
      .then((data) => {
        if (ignore) return
        setPolicies(data.policies)
        setNextPage(data.nextPage)
      })
      .catch((err) => {
        if (!ignore) setError(err.message || '청년정책을 불러오지 못했습니다.')
      })
      .finally(() => {
        if (!ignore) setLoading(false)
      })
    return () => {
      ignore = true
    }
  }, [buildQuery])

  const handleLoadMore = async () => {
    if (!nextPage || loadingMore) return
    setLoadingMore(true)
    try {
      const data = await fetchPolicies(buildQuery(nextPage))
      setPolicies((prev) => {
        // 같은 정책이 중복으로 들어오는 경우를 대비해 id 기준으로 한 번 걸러줌
        const seen = new Set(prev.map((p) => p.id))
        return [...prev, ...data.policies.filter((p) => !seen.has(p.id))]
      })
      setNextPage(data.nextPage)
    } catch (err) {
      setError(err.message || '청년정책을 더 불러오지 못했습니다.')
    } finally {
      setLoadingMore(false)
    }
  }

  const handleSearch = (e) => {
    e.preventDefault()
    setKeyword(draftKeyword.trim())
    setAge(draftAge.trim())
  }

  return (
    <div className="space-y-6">
      {/* 히어로 배너 — 채용공고 화면과 같은 브랜드 그라디언트 */}
      <section className="relative overflow-hidden rounded-card bg-ink p-8 shadow-2 sm:p-10">
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: 'linear-gradient(120deg, #141413 0%, #2B2B2A 45%, #9A3A0A 100%)' }}
          aria-hidden="true"
        />
        <div className="relative max-w-xl">
          <span className="inline-flex items-center rounded-pill bg-white/15 px-3 py-1 text-eyebrow text-white">
            놓치기 쉬운 지원 혜택
          </span>
          <h1 className="mt-4 text-h2 text-white sm:text-h2-md">
            나에게 맞는 청년정책을
            <br />
            한곳에서 찾아보세요.
          </h1>
          <p className="mt-3 text-body text-white/70">
            일자리, 주거, 교육, 복지문화까지 — 지역과 나이에 맞는 정책을 검색하고 신청 페이지로 바로 이동할 수 있어요.
          </p>
        </div>
      </section>

      {/* 검색 / 필터 */}
      <section className="rounded-card bg-white p-6 shadow-1 sm:p-8">
        <form onSubmit={handleSearch} className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <label className="flex-1">
            <span className="text-nav text-ink">키워드</span>
            <div className="mt-2 flex items-center gap-2 rounded-btn border-[1.5px] border-taupe px-4 py-2.5 focus-within:border-ink">
              <MagnifyingGlass size={18} className="shrink-0 text-slate" aria-hidden="true" />
              <input
                type="text"
                value={draftKeyword}
                onChange={(e) => setDraftKeyword(e.target.value)}
                placeholder="정책명 예: 월세, 면접, 청년도약"
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
            </select>
          </label>

          <label className="sm:w-32">
            <span className="text-nav text-ink">나이(만)</span>
            <input
              type="number"
              min="15"
              max="60"
              value={draftAge}
              onChange={(e) => setDraftAge(e.target.value)}
              placeholder="예: 24"
              className="mt-2 w-full rounded-btn border-[1.5px] border-taupe bg-white px-4 py-2.5 text-body text-ink placeholder:text-taupe focus:border-ink focus:outline-none"
            />
          </label>

          <button type="submit" className="btn-accent sm:w-auto">
            정책 검색
          </button>
        </form>

        <div className="mt-4">
          <span className="text-footer text-slate">분야</span>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setCategory('')}
              className={`rounded-pill border-[1.5px] px-4 py-1.5 text-nav transition-colors ${
                category === ''
                  ? 'border-coral bg-coral text-white'
                  : 'border-taupe bg-white text-ink hover:border-coral'
              }`}
            >
              전체
            </button>
            {POLICY_CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(category === c ? '' : c)}
                className={`rounded-pill border-[1.5px] px-4 py-1.5 text-nav transition-colors ${
                  category === c
                    ? 'border-coral bg-coral text-white'
                    : 'border-taupe bg-white text-ink hover:border-coral'
                }`}
              >
                {c}
              </button>
            ))}

            <label className="ml-auto flex cursor-pointer items-center gap-2 text-footer text-slate">
              <input
                type="checkbox"
                checked={includeClosed}
                onChange={(e) => setIncludeClosed(e.target.checked)}
                className="h-4 w-4 accent-[#CF4500]"
              />
              마감된 정책도 보기
            </label>
          </div>
        </div>
      </section>

      {/* 정책 리스트 */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <p className="eyebrow-label">
            <span className="h-1.5 w-1.5 rounded-full bg-coral" aria-hidden="true" />
            {loading ? '청년정책 불러오는 중…' : `청년정책 ${policies.length}건${nextPage ? ' 이상' : ''}`}
          </p>
        </div>

        {error ? (
          <div className="rounded-card bg-white p-10 text-center shadow-1">
            <p className="text-body text-slate">청년정책을 불러오지 못했어요. ({error})</p>
          </div>
        ) : loading ? (
          <div className="rounded-card bg-white p-10 text-center shadow-1">
            <p className="text-body text-slate">청년정책을 불러오는 중이에요…</p>
          </div>
        ) : policies.length === 0 ? (
          <div className="rounded-card bg-white p-10 text-center shadow-1">
            <p className="text-body text-slate">
              조건에 맞는 정책이 없어요. 키워드, 지역, 나이를 바꾸거나 ‘마감된 정책도 보기’를 켜보세요.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {policies.map((policy) => {
              const status = formatStatus(policy)
              const isOpen = expandedId === policy.id
              const link = policy.applyUrl || policy.refUrl
              return (
                <article
                  key={policy.id}
                  className="rounded-card bg-white p-6 shadow-1 transition-transform duration-150 hover:-translate-y-0.5 sm:p-8"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-1.5 text-footer text-slate">
                        <Buildings size={14} aria-hidden="true" />
                        {policy.org || '운영기관 미상'}
                        {policy.category && (
                          <span className="rounded-pill bg-coral-bg px-2 py-0.5 text-[11px] font-semibold text-coral-deep">
                            {policy.category}
                          </span>
                        )}
                        {policy.subCategory && (
                          <span className="rounded-pill bg-canvas-lift px-2 py-0.5 text-[11px] text-ink-soft">
                            {policy.subCategory}
                          </span>
                        )}
                      </p>
                      <h2 className="mt-1 text-h3 text-ink">{policy.name}</h2>
                      {policy.summary && (
                        <p className="mt-2 line-clamp-2 text-body text-slate">{policy.summary}</p>
                      )}
                      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-footer text-slate">
                        <span className="flex items-center gap-1">
                          <MapPin size={14} aria-hidden="true" />
                          {policy.regionLabel}
                        </span>
                        <span className="flex items-center gap-1">
                          <UsersThree size={14} aria-hidden="true" />
                          {formatAge(policy)}
                        </span>
                        {policy.applyPeriod && (
                          <span className="flex items-center gap-1">
                            <CalendarBlank size={14} aria-hidden="true" />
                            {policy.applyPeriod}
                          </span>
                        )}
                      </div>
                    </div>
                    <span
                      className={`shrink-0 rounded-pill px-3 py-1 text-footer font-semibold ${STATUS_TONE_CLASS[status.tone]}`}
                    >
                      {status.text}
                    </span>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    {policy.keywords.map((kw) => (
                      <span key={kw} className="rounded-pill bg-canvas-lift px-3 py-1 text-footer text-ink-soft">
                        {kw}
                      </span>
                    ))}
                    {policy.targetTags.map((tag) => (
                      <span key={tag} className="rounded-pill border border-taupe px-3 py-1 text-footer text-slate">
                        {tag}
                      </span>
                    ))}

                    <div className="ml-auto flex items-center gap-4">
                      <button
                        type="button"
                        onClick={() => setExpandedId(isOpen ? null : policy.id)}
                        aria-expanded={isOpen}
                        className="flex items-center gap-1 text-footer font-medium text-ink hover:underline"
                      >
                        {isOpen ? '접기' : '자세히 보기'}
                        {isOpen ? <CaretUp size={14} aria-hidden="true" /> : <CaretDown size={14} aria-hidden="true" />}
                      </button>
                      {link && (
                        <a
                          href={link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-footer font-medium text-coral hover:underline"
                        >
                          {policy.applyUrl ? '신청하러 가기' : '자세한 안내'}
                          <ArrowSquareOut size={14} aria-hidden="true" />
                        </a>
                      )}
                    </div>
                  </div>

                  {isOpen && (
                    <dl className="mt-5 space-y-4 border-t border-canvas-lift pt-5">
                      <DetailRow label="지원 내용" value={policy.support} />
                      <DetailRow label="사업 기간" value={policy.bizPeriod} />
                      <DetailRow label="소득 조건" value={policy.income} />
                      <DetailRow label="추가 자격 조건" value={policy.addQualification} />
                      <DetailRow label="신청 방법" value={policy.applyMethod} />
                      <DetailRow label="심사 방법" value={policy.screening} />
                      <DetailRow label="제출 서류" value={policy.documents} />
                      <DetailRow label="기타 안내" value={policy.etc} />
                      {policy.refUrl && policy.applyUrl && policy.refUrl !== policy.applyUrl && (
                        <a
                          href={policy.refUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-footer font-medium text-coral hover:underline"
                        >
                          참고 사이트
                          <ArrowSquareOut size={14} aria-hidden="true" />
                        </a>
                      )}
                    </dl>
                  )}
                </article>
              )
            })}
          </div>
        )}

        {!loading && !error && nextPage && (
          <div className="mt-6 flex justify-center">
            <button
              type="button"
              onClick={handleLoadMore}
              disabled={loadingMore}
              className="rounded-btn border-[1.5px] border-taupe px-6 py-2.5 text-nav text-ink transition-colors hover:border-ink disabled:cursor-not-allowed disabled:opacity-40"
            >
              {loadingMore ? '불러오는 중…' : '정책 더 보기'}
            </button>
          </div>
        )}

        <p className="mt-6 text-center text-footer text-taupe">
          정책 정보 출처: 온통청년(한국청소년정책연구원 청년정책 Open API) · 신청 전 반드시 운영기관의 최신 공고를 확인해주세요.
        </p>
      </section>
    </div>
  )
}
