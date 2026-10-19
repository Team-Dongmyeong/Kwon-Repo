import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Heartbeat, ChatCircleDots, Briefcase, UserCircle, Megaphone, Compass } from '@phosphor-icons/react'
import { useAuth } from '../../context/AuthContext.jsx'
import { usePreference } from '../../context/PreferenceContext.jsx'
import { JOB_CATEGORIES, ALL_REGION, REMOTE_REGION, REGIONS, CAREER_LEVELS } from '../../constants/jobCategories.js'
import { fetchEmotionSummary } from '../../lib/emotionApi.js'
import { fetchChatSessions } from '../../lib/chatApi.js'

// [감정상태 탭] 더미 데이터 → 백엔드 GET /emotions/summary 실제 데이터로 교체 (2026-10-12)
// - 최근 주요 감정 패턴: 최근 30일 채팅에서 KcELECTRA가 분류한 감정 6종(중립 제외) 빈도
// - 심리상태 리포트: 메시지 감정을 0(나쁨)~100(좋음) 점수로 바꿔 기간별 평균
const EMOTION_AXES = ['공포', '놀람', '분노', '슬픔', '행복', '혐오']
const PERIODS = [
  { key: 'week', label: '일주일' },
  { key: 'month', label: '한달' },
  { key: 'year', label: '1년' },
]

// 날짜 표기 — 채팅로그 세션의 createdAt(ms)을 'YYYY.MM.DD'로.
function formatSessionDate(timestamp) {
  const d = new Date(timestamp)
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}.${mm}.${dd}`
}

// 개인정보를 맨 앞으로 — 마이페이지에 들어오면 이 탭이 먼저 보이도록.
const tabs = [
  { key: 'profile', label: '개인정보', Icon: UserCircle },
  { key: 'emotion', label: '감정상태', Icon: Heartbeat },
  { key: 'chatlog', label: '채팅로그', Icon: ChatCircleDots },
  { key: 'jobs', label: '추천직업', Icon: Briefcase },
]

// 빠른 메뉴 카드 — 참고 자료(병철)의 "빠른 메뉴" 구조는 그대로 가져오되, 우리
// 사이트 안에서 실제로 이동 가능한 경로 + coral/ink 톤 아이콘으로 채움.
const quickMenu = [
  { to: '/home/chat', label: '대화 시작하기', Icon: ChatCircleDots },
  { to: '/home/notice', label: '공지사항 확인', Icon: Megaphone },
  { to: '/home/jobs', label: '채용공고 확인', Icon: Briefcase },
  { to: '/home/guide', label: '이용가이드 보기', Icon: Compass },
]

// 6축 육각형 레이더 차트 — 새 npm 패키지(Chart.js 등) 설치 없이 순수 SVG로 구현.
// (이 device 연결은 npm install을 대신 실행해줄 방법이 없어서, 의존성 추가 없는
// 방식을 택함.)
function EmotionRadar({ data }) {
  const size = 240
  const center = size / 2
  const maxRadius = 78
  const levels = [25, 50, 75, 100]
  const angleStep = (Math.PI * 2) / data.length

  function pointAt(radius, index) {
    const angle = -Math.PI / 2 + index * angleStep
    return { x: center + radius * Math.cos(angle), y: center + radius * Math.sin(angle) }
  }

  function polygonPoints(radiusRatio) {
    return data.map((_, index) => pointAt(maxRadius * radiusRatio, index)).map(({ x, y }) => `${x},${y}`).join(' ')
  }

  const dataPoints = data.map((item, index) => pointAt((maxRadius * item.value) / 100, index))

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="mx-auto h-64 w-64">
      {levels.map((level) => (
        <polygon key={level} points={polygonPoints(level / 100)} fill="none" stroke="#E4E1DC" strokeWidth="1" />
      ))}

      {data.map((_, index) => {
        const outer = pointAt(maxRadius, index)
        return <line key={index} x1={center} y1={center} x2={outer.x} y2={outer.y} stroke="#E4E1DC" strokeWidth="1" />
      })}

      <polygon
        points={dataPoints.map(({ x, y }) => `${x},${y}`).join(' ')}
        fill="#CF4500"
        fillOpacity="0.18"
        stroke="#CF4500"
        strokeWidth="2"
        strokeLinejoin="round"
      />

      {dataPoints.map(({ x, y }, index) => (
        <circle key={index} cx={x} cy={y} r="3.5" fill="#CF4500" />
      ))}

      {data.map((item, index) => {
        const label = pointAt(maxRadius + 20, index)
        const isTopOrBottom = Math.abs(Math.cos((-Math.PI / 2 + index * angleStep) % (Math.PI * 2))) < 0.2
        const anchor = isTopOrBottom ? 'middle' : label.x > center ? 'start' : 'end'
        return (
          <text
            key={item.label}
            x={label.x}
            y={label.y}
            textAnchor={anchor}
            dominantBaseline="middle"
            className="fill-slate text-[11px] font-semibold"
          >
            {item.label}
          </text>
        )
      })}
    </svg>
  )
}

// 그리드(가로: 날짜, 세로: 0~100)와 영역 채우기가 있는 라인 차트.
function TrendChart({ dates, points }) {
  const width = 420
  const height = 220
  const padLeft = 34
  const padRight = 12
  const padTop = 14
  const padBottom = 26

  const plotWidth = width - padLeft - padRight
  const plotHeight = height - padTop - padBottom
  // 점이 1개뿐이면 (points.length - 1)이 0이 돼서 나눗셈이 깨지므로 가운데에 찍음
  const xStep = points.length > 1 ? plotWidth / (points.length - 1) : 0
  const yTicks = [0, 25, 50, 75, 100]

  function xAt(index) {
    return points.length > 1 ? padLeft + index * xStep : padLeft + plotWidth / 2
  }
  function yAt(value) {
    return padTop + plotHeight * (1 - value / 100)
  }

  const linePath = points.map((value, index) => `${index === 0 ? 'M' : 'L'} ${xAt(index)} ${yAt(value)}`).join(' ')
  const areaPath = `${linePath} L ${xAt(points.length - 1)} ${padTop + plotHeight} L ${xAt(0)} ${padTop + plotHeight} Z`

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-56 w-full">
      <defs>
        <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#CF4500" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#CF4500" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* 가로 그리드(값 0~100) + 좌측 눈금 라벨 */}
      {yTicks.map((tick) => (
        <g key={tick}>
          <line
            x1={padLeft}
            y1={yAt(tick)}
            x2={width - padRight}
            y2={yAt(tick)}
            stroke="#E4E1DC"
            strokeDasharray="3 4"
            strokeWidth="1"
          />
          <text x={padLeft - 8} y={yAt(tick)} textAnchor="end" dominantBaseline="middle" className="fill-slate text-[9px]">
            {tick}
          </text>
        </g>
      ))}

      {/* 세로 그리드(날짜) + 하단 날짜 라벨 */}
      {dates.map((date, index) => (
        <g key={date}>
          <line
            x1={xAt(index)}
            y1={padTop}
            x2={xAt(index)}
            y2={padTop + plotHeight}
            stroke="#EFEDE9"
            strokeWidth="1"
          />
          <text x={xAt(index)} y={height - 8} textAnchor="middle" className="fill-slate text-[9px]">
            {date}
          </text>
        </g>
      ))}

      <path d={areaPath} fill="url(#trendFill)" stroke="none" />
      <path d={linePath} fill="none" stroke="#CF4500" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />

      {points.map((value, index) => (
        <circle key={index} cx={xAt(index)} cy={yAt(value)} r="4" fill="white" stroke="#CF4500" strokeWidth="2.5" />
      ))}
    </svg>
  )
}

export default function MyPage() {
  const { user, authFetch } = useAuth()
  const [activeTab, setActiveTab] = useState('profile')
  const [period, setPeriod] = useState('week')
  // 감정상태 탭 데이터 — 탭을 열 때마다 새로 불러옴(방금 나눈 대화도 바로 반영되도록)
  const [emotionSummary, setEmotionSummary] = useState(null)
  const [emotionLoading, setEmotionLoading] = useState(false)
  const [emotionError, setEmotionError] = useState(null)

  useEffect(() => {
    if (activeTab !== 'emotion') return
    let cancelled = false
    setEmotionLoading(true)
    setEmotionError(null)
    fetchEmotionSummary(authFetch)
      .then((data) => {
        if (!cancelled) setEmotionSummary(data)
      })
      .catch((err) => {
        if (cancelled) return
        setEmotionError(
          err?.message === 'SESSION_EXPIRED'
            ? '로그인이 만료되었어요. 다시 로그인해주세요.'
            : '감정 기록을 불러오지 못했어요. 서버가 깨어나는 중일 수 있으니 잠시 후 다시 시도해주세요.',
        )
      })
      .finally(() => {
        if (!cancelled) setEmotionLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [activeTab, authFetch, user?.id])

  // 채팅로그 탭 데이터 — Chat.jsx와 같은 chatApi.js(fetchChatSessions)를 그대로 써서
  // 로그인한 계정의 실제 대화 목록(Supabase DB)을 불러옴. 메시지가 하나도 없는
  // "새 대화"(빈 세션)는 실제로 나눈 대화가 아니므로 목록에서 제외.
  const [chatSessions, setChatSessions] = useState([])
  const [chatLogLoading, setChatLogLoading] = useState(false)
  const [chatLogError, setChatLogError] = useState(null)

  useEffect(() => {
    if (activeTab !== 'chatlog') return
    let cancelled = false
    setChatLogLoading(true)
    setChatLogError(null)
    fetchChatSessions(authFetch)
      .then((data) => {
        if (cancelled) return
        const sessions = data
          .map((s) => ({
            id: s.id,
            title: s.title,
            createdAt: Date.parse(s.created_at),
            messageCount: s.messages.length,
          }))
          .filter((s) => s.messageCount > 0)
          .sort((a, b) => b.createdAt - a.createdAt)
        setChatSessions(sessions)
      })
      .catch((err) => {
        if (cancelled) return
        setChatLogError(
          err?.message === 'SESSION_EXPIRED'
            ? '로그인이 만료되었어요. 다시 로그인해주세요.'
            : '대화 기록을 불러오지 못했어요. 잠시 후 다시 시도해주세요.',
        )
      })
      .finally(() => {
        if (!cancelled) setChatLogLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [activeTab, authFetch, user?.id])

  const emotionPattern =
    emotionSummary?.pattern ?? EMOTION_AXES.map((label) => ({ label, value: 0, ratio: 0, count: 0 }))
  const hasPattern = (emotionSummary?.pattern_total ?? 0) > 0
  const topEmotion = hasPattern ? [...emotionPattern].sort((a, b) => b.count - a.count)[0] : null
  const trend = emotionSummary?.trend?.[period] ?? { dates: [], points: [] }
  const [profileSaved, setProfileSaved] = useState(false)
  const [editingInfo, setEditingInfo] = useState(false)
  const [notifyOn, setNotifyOn] = useState(true)
  // 선호 추천 분야 — (2026-10-11 변경) 더 이상 적성 검사·채팅 분석으로 자동
  // 계산되지 않고, 바로 아래 선호 근무 지역·경력 구분과 같은 방식으로 "내 정보
  // 수정하기"에서 사용자가 직접 고르는 값으로 바뀜. setPreferredCategory로 고르고,
  // resetPreference로 미설정 상태로 되돌릴 수 있음.
  // "진단하기" 박스와 진단 모달은 상단 헤더(Header.jsx)에 있음 — 이제는 결과를
  // 참고용으로 보여주기만 하고 이 값을 자동으로 바꾸지는 않음.
  const {
    preferredCategory,
    hasPreferenceData,
    setPreferredCategory,
    resetPreference,
    preferredRegion,
    hasRegionPreference,
    setPreferredRegion,
    careerLevel,
    setCareerLevel,
    // "추천직업" 탭 전용 — 채용공고 스마트픽과 똑같은 recommendedJobs(선호 추천
    // 분야의 대표 세부직무 최대 3개)를 그대로 구독해서 씀. preferredCategory가
    // 바뀌면 이 탭과 스마트픽이 항상 동시에 같은 값을 보여주게 됨 — 둘 다
    // PreferenceContext라는 같은 소스를 보고 있어서 별도로 동기화해줄 코드가 필요 없음.
    recommendedJobs,
  } = usePreference()
  // 선호 근무 지역 읽기 전용 표시용 — select의 value는 짧은 표기('서울')라서, 보여줄
  // 땐 REGIONS의 공식 명칭(label, 예: '서울특별시')으로 바꿔서 보여줌. REGIONS에 없는
  // 값(ALL_REGION/REMOTE_REGION)은 그 문자열 자체가 이미 표시용 라벨이라 그대로 씀.
  const preferredRegionLabel = REGIONS.find((item) => item.value === preferredRegion)?.label ?? preferredRegion

  function handleProfileSubmit(event) {
    event.preventDefault()
    setProfileSaved(true)
    setEditingInfo(false)
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="eyebrow-label">
            <span className="h-1.5 w-1.5 rounded-full bg-coral" aria-hidden="true" />
            마이페이지
          </p>
          <h1 className="mt-4 flex items-center gap-2 text-h3 text-ink">
            <UserCircle size={24} weight="bold" aria-hidden="true" />
            {user?.name ?? '내'} 정보
          </h1>
        </div>
      </div>

      {/* 탭 — 선택된 항목은 배경까지 coral로 채움 (참고 자료의 folder-tab.active /
          nav-btn.active 패턴을 우리 브랜드 색으로 재구성). */}
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="마이페이지 메뉴">
        {tabs.map(({ key, label, Icon }) => {
          const isActive = activeTab === key
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveTab(key)}
              className={`inline-flex min-h-[44px] items-center gap-2 rounded-pill px-4 text-[14px] font-semibold transition-colors ${
                isActive ? 'bg-coral text-white shadow-1' : 'bg-white text-slate hover:bg-canvas-lift hover:text-ink'
              }`}
            >
              <Icon size={18} weight="bold" aria-hidden="true" />
              {label}
            </button>
          )
        })}
      </div>

      {/* 탭 전환마다 key로 다시 마운트시켜 fadeUp 애니메이션이 매번 재생되게 함 —
          참고 자료의 "클릭하면 스르륵 올라오는" 전환 효과. */}
      <div key={activeTab} className="animate-fade-up">
        {activeTab === 'emotion' && emotionError && (
          <div className="mb-4 rounded-btn bg-coral-bg px-4 py-2.5 text-[13px] font-medium text-coral-deep">
            {emotionError}
          </div>
        )}

        {activeTab === 'emotion' && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-card bg-white p-6 shadow-1 sm:p-7">
              <div className="flex items-baseline justify-between gap-4">
                <h3 className="text-h3 text-[17px] text-ink">최근 주요 감정 패턴</h3>
                <span className="text-[12px] text-slate">최근 30일 대화 기준</span>
              </div>

              {emotionLoading && !emotionSummary ? (
                <p className="py-24 text-center text-[14px] text-slate">감정 기록을 불러오는 중…</p>
              ) : (
                <>
                  <EmotionRadar data={emotionPattern} />
                  {hasPattern ? (
                    <>
                      <p className="mt-2 text-center text-[14px] text-ink">
                        가장 많이 느낀 감정은 <span className="font-bold text-coral-deep">{topEmotion.label}</span>
                        이에요 ({topEmotion.ratio}%)
                      </p>
                      <ul className="mt-4 grid grid-cols-3 gap-2">
                        {emotionPattern.map(({ label, ratio }) => (
                          <li
                            key={label}
                            className="flex items-center justify-between rounded-btn bg-canvas px-3 py-2 text-[12px]"
                          >
                            <span className="font-semibold text-ink">{label}</span>
                            <span className="text-slate">{ratio}%</span>
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : (
                    <p className="mt-2 text-center text-[13px] leading-relaxed text-slate">
                      아직 분석된 감정이 없어요.
                      <br />
                      <Link to="/home/chat" className="font-semibold text-coral-deep hover:underline">
                        채팅
                      </Link>
                      에서 마음잇기와 이야기를 나누면 감정 패턴이 표시돼요.
                    </p>
                  )}
                </>
              )}
            </div>

            <div className="rounded-card bg-white p-6 shadow-1 sm:p-7">
              <div className="flex items-center justify-between gap-4">
                <h3 className="text-h3 text-[17px] text-ink">심리상태 리포트</h3>
                <div className="flex gap-1 rounded-pill bg-canvas p-1">
                  {PERIODS.map(({ key, label }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setPeriod(key)}
                      className={`rounded-pill px-3 py-1.5 text-[12px] font-semibold transition-colors ${
                        period === key ? 'bg-white text-coral-deep shadow-1' : 'text-slate hover:text-ink'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {trend.points.length > 0 ? (
                <>
                  <div className="relative mt-4">
                    <div className="pointer-events-none absolute left-1 top-1 z-10 rounded-btn bg-coral-bg px-2 py-1 text-[11px] font-bold text-coral-deep">
                      좋음 (100)
                    </div>
                    <div className="pointer-events-none absolute bottom-6 left-1 z-10 rounded-btn bg-canvas px-2 py-1 text-[11px] font-bold text-slate">
                      나쁨 (0)
                    </div>
                    <TrendChart dates={trend.dates} points={trend.points} />
                  </div>
                  <p className="mt-2 text-[12px] leading-relaxed text-slate">
                    {period === 'week' && '하루 단위'}
                    {period === 'month' && '7일 단위'}
                    {period === 'year' && '한 달 단위'} 평균 점수예요. 대화가 없었던 날은 표시하지 않아요.
                  </p>
                </>
              ) : (
                <p className="py-24 text-center text-[14px] text-slate">
                  {emotionLoading ? '감정 기록을 불러오는 중…' : '이 기간에는 아직 대화 기록이 없어요.'}
                </p>
              )}
            </div>
          </div>
        )}

        {activeTab === 'chatlog' && (
          <div className="space-y-3">
            {chatLogError && (
              <div className="rounded-btn bg-coral-bg px-4 py-2.5 text-[13px] font-medium text-coral-deep">
                {chatLogError}
              </div>
            )}
            {chatLogLoading && chatSessions.length === 0 ? (
              <p className="py-10 text-center text-[14px] text-slate">대화 기록을 불러오는 중…</p>
            ) : chatSessions.length === 0 ? (
              <div className="rounded-card bg-white p-10 text-center shadow-1">
                <p className="text-body text-slate">아직 나눈 대화가 없어요. 대화를 시작하면 여기에서 다시 확인할 수 있어요.</p>
                <Link to="/home/chat" className="btn-accent mt-5 inline-flex">
                  대화 시작하기
                </Link>
              </div>
            ) : (
              chatSessions.map((session) => (
                <div
                  key={session.id}
                  className="flex flex-col gap-3 rounded-card bg-white p-5 shadow-1 sm:flex-row sm:items-center sm:justify-between sm:p-6"
                >
                  <div>
                    <p className="font-semibold text-ink">{session.title}</p>
                    <p className="mt-1 text-[13px] text-slate">
                      {formatSessionDate(session.createdAt)} · 메시지 {session.messageCount}개
                    </p>
                  </div>
                  <Link to={`/home/chat?session=${session.id}`} className="btn-secondary shrink-0">
                    대화 보기
                  </Link>
                </div>
              ))
            )}
          </div>
        )}

        {/* 추천직업 탭 — 더미데이터가 아니라 채용공고 스마트픽과 완전히 같은
            recommendedJobs(PreferenceContext)를 그대로 보여줌. "내 정보 수정하기"에서
            선호 추천 분야를 바꾸면 이 탭과 스마트픽이 항상 동시에 같은 값으로 갱신됨.
            (2026-10-11 변경) 적성 검사·채팅 점수로 계산되던 매칭률(%)은 없어졌고,
            선택한 대분류를 대표하는 세부직무를 그대로 보여주기만 함. */}
        {activeTab === 'jobs' &&
          (hasPreferenceData ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {recommendedJobs.map(({ subJob, category }) => (
                <div key={subJob} className="flex flex-col justify-between rounded-card bg-white p-6 shadow-1">
                  <div>
                    <span className="inline-flex rounded-pill bg-coral-bg px-3 py-1 text-[12px] font-bold text-coral-deep">
                      {category}
                    </span>
                    <h3 className="mt-3 text-h3 text-[17px] text-ink">{subJob}</h3>
                    <p className="mt-2 text-[13px] leading-relaxed text-slate">
                      선택하신 선호 추천 분야({category})를 대표하는 직무예요.
                    </p>
                  </div>
                  <Link to={`/home/jobs?job=${encodeURIComponent(subJob)}`} className="btn-secondary mt-5">
                    공고 확인하기
                  </Link>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-card bg-white p-10 text-center shadow-1">
              <p className="text-body text-slate">
                아직 선호 추천 분야를 선택하지 않았어요. "개인정보" 탭의 "내 정보 수정하기"에서 선택해보세요.
              </p>
            </div>
          ))}

        {/* 개인정보 탭 — 병철이 만든 마이페이지 스크린샷의 "3개 카드" 레이아웃
            구조(프로필 카드 / 정보 카드 / 빠른 메뉴 카드)만 가져오고, 색상은
            보라·분홍 대신 우리 coral/ink 톤으로, "내 정보" 카드 안의 내용은
            참고 자료의 소속·상담 이용·최근 접속을 그대로 쓰지 않고 실제로 우리
            서비스에서 의미 있는 항목(이메일 · 선호 추천 분야 · 알림 수신)으로
            새로 구성함. */}
        {activeTab === 'profile' && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {/* 프로필 카드 */}
            <div className="overflow-hidden rounded-card bg-white shadow-1">
              <div className="h-20 bg-gradient-to-r from-ink to-coral" aria-hidden="true" />
              <div className="-mt-10 flex flex-col items-center px-6 pb-7 text-center">
                <div className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-white bg-coral text-[26px] font-bold text-white shadow-1">
                  {(user?.name ?? '회')[0]}
                </div>
                <p className="mt-3 text-[17px] font-bold text-ink">{user?.name ?? '회원'}</p>
                <p className="mt-1 text-[13px] text-slate">{user?.email ?? '-'}</p>
                <span className="mt-3 inline-flex rounded-pill bg-coral-bg px-3 py-1 text-[12px] font-bold text-coral-deep">
                  일반 회원
                </span>
              </div>
            </div>

            {/* 내 정보 카드 — 항목 구성은 새로 결정, 수정 버튼으로 인라인 편집 전환 */}
            <div className="rounded-card bg-white p-6 shadow-1">
              <div className="flex items-center justify-between">
                <h3 className="text-h3 text-[17px] text-ink">내 정보</h3>
                <button
                  type="button"
                  onClick={() => setEditingInfo((value) => !value)}
                  className="text-[12px] font-bold text-coral-deep hover:underline"
                >
                  {editingInfo ? '취소' : '수정'}
                </button>
              </div>

              {!editingInfo ? (
                <dl className="mt-4 space-y-4">
                  <div className="flex items-center justify-between border-b border-ink/8 pb-3">
                    <dt className="text-[13px] text-slate">이메일</dt>
                    <dd className="text-[14px] font-semibold text-ink">{user?.email ?? '-'}</dd>
                  </div>
                  <div className="flex items-center justify-between border-b border-ink/8 pb-3">
                    <dt className="text-[13px] text-slate">선호 추천 분야</dt>
                    <dd className="flex items-center gap-2 text-[14px] font-semibold text-ink">
                      {hasPreferenceData ? preferredCategory : <span className="text-slate">미설정</span>}
                      {hasPreferenceData && (
                        <button
                          type="button"
                          onClick={resetPreference}
                          className="text-[12px] font-bold text-slate hover:text-ink hover:underline"
                        >
                          초기화
                        </button>
                      )}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between border-b border-ink/8 pb-3">
                    <dt className="text-[13px] text-slate">선호 근무 지역</dt>
                    <dd className="flex items-center gap-2 text-[14px] font-semibold text-ink">
                      {hasRegionPreference ? preferredRegionLabel : <span className="text-slate">미설정</span>}
                      {hasRegionPreference && (
                        <button
                          type="button"
                          onClick={() => setPreferredRegion(ALL_REGION)}
                          className="text-[12px] font-bold text-slate hover:text-ink hover:underline"
                        >
                          초기화
                        </button>
                      )}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between border-b border-ink/8 pb-3">
                    <dt className="text-[13px] text-slate">경력 구분</dt>
                    <dd className="text-[14px] font-semibold text-ink">{careerLevel}</dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-[13px] text-slate">알림 수신</dt>
                    <dd className="text-[14px] font-semibold text-ink">{notifyOn ? '동의함' : '동의 안 함'}</dd>
                  </div>
                </dl>
              ) : (
                <form className="mt-4 space-y-4" onSubmit={handleProfileSubmit}>
                  {/* (2026-10-11 변경) 선호 추천 분야도 선호 근무 지역·경력 구분과
                      똑같이 여기서 직접 고름 — 더 이상 적성 검사·채팅 분석으로 자동
                      계산되지 않음. 상단 헤더의 "진단하기"는 참고용 결과만 보여줄 뿐
                      이 값을 바꾸지 않으니, 반영하려면 여기서 직접 선택해야 함. */}
                  <label className="block text-[13px] font-semibold text-ink">
                    선호 추천 분야
                    <select
                      value={preferredCategory ?? ''}
                      onChange={(event) => setPreferredCategory(event.target.value || null)}
                      className="mt-2 w-full rounded-btn border-[1.5px] border-taupe bg-white px-4 py-2.5 text-[14px] font-normal text-ink focus:border-ink focus:outline-none"
                    >
                      <option value="">선택 안 함</option>
                      {JOB_CATEGORIES.map((category) => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block text-[13px] font-semibold text-ink">
                    선호 근무 지역
                    <select
                      value={preferredRegion}
                      onChange={(event) => setPreferredRegion(event.target.value)}
                      className="mt-2 w-full rounded-btn border-[1.5px] border-taupe bg-white px-4 py-2.5 text-[14px] font-normal text-ink focus:border-ink focus:outline-none"
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

                  <label className="block text-[13px] font-semibold text-ink">
                    경력 구분
                    <select
                      value={careerLevel}
                      onChange={(event) => setCareerLevel(event.target.value)}
                      className="mt-2 w-full rounded-btn border-[1.5px] border-taupe bg-white px-4 py-2.5 text-[14px] font-normal text-ink focus:border-ink focus:outline-none"
                    >
                      {CAREER_LEVELS.map((level) => (
                        <option key={level} value={level}>
                          {level}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="flex items-center justify-between text-[13px] font-semibold text-ink">
                    알림 수신 동의
                    <input
                      type="checkbox"
                      checked={notifyOn}
                      onChange={(event) => setNotifyOn(event.target.checked)}
                      className="h-4 w-4 accent-coral"
                    />
                  </label>

                  <button type="submit" className="btn-accent w-full justify-center">
                    저장하기
                  </button>
                </form>
              )}

              {profileSaved && !editingInfo && (
                <p className="mt-4 text-[12px] font-semibold text-coral-deep">수정 내용이 저장됐어요.</p>
              )}
            </div>

            {/* 빠른 메뉴 카드 — 참고 자료의 카드 구조를 그대로 재사용 */}
            <div className="rounded-card bg-white p-6 shadow-1">
              <h3 className="text-h3 text-[17px] text-ink">빠른 메뉴</h3>
              <div className="mt-4 space-y-2">
                {quickMenu.map(({ to, label, Icon }) => (
                  <Link
                    key={to}
                    to={to}
                    className="flex items-center gap-3 rounded-btn bg-canvas px-4 py-3 text-[14px] font-semibold text-ink transition-colors hover:bg-coral-bg hover:text-coral-deep"
                  >
                    <Icon size={18} weight="duotone" aria-hidden="true" />
                    {label}
                  </Link>
                ))}
              </div>

              <a href="#withdraw" className="mt-5 block text-center text-[12px] text-slate underline hover:text-ink">
                회원 탈퇴 요청
              </a>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
