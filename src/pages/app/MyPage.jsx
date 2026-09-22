import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Heartbeat, ChatCircleDots, Briefcase, UserCircle, Megaphone, Compass } from '@phosphor-icons/react'
import { useAuth } from '../../context/AuthContext.jsx'
import { usePreference } from '../../context/PreferenceContext.jsx'

// 전부 더미 데이터 — 백엔드(kcELECTRA/SBERT/RAG) 연동 전 화면 확인용.
const EMOTION_PATTERN = [
  { label: '공포', value: 25 },
  { label: '놀람', value: 40 },
  { label: '분노', value: 15 },
  { label: '슬픔', value: 30 },
  { label: '행복', value: 85 },
  { label: '혐오', value: 10 },
]

const PERIOD_DATA = {
  week: {
    label: '일주일',
    dates: ['09/01', '09/02', '09/03', '09/04', '09/05', '09/06', '09/07'],
    points: [65, 58, 72, 80, 75, 88, 85],
  },
  month: {
    label: '한달',
    dates: ['08/10', '08/17', '08/24', '08/31', '09/07'],
    points: [50, 62, 70, 68, 85],
  },
  year: {
    label: '1년',
    dates: ['2025/10', '2025/12', '2026/02', '2026/04', '2026/06', '2026/08', '2026/09'],
    points: [45, 55, 60, 75, 70, 82, 85],
  },
}

const CHAT_LOG = [
  { tag: '심리 상담', title: '자존감 케어 및 학업 스트레스 상담 세션', meta: '2026.09.07 · 감정 상태: 안정' },
  { tag: '직업 추천', title: 'SBERT 기반 백엔드/AI 직무 적성 매칭 상담', meta: '2026.09.05 · 키워드 매칭 완료' },
  { tag: '심리 상담', title: '일상적 무기력감 극복을 위한 행동 진단', meta: '2026.09.01 · 감정 상태: 피로감 관찰' },
]

const JOB_MATCHES = [
  {
    rate: 94,
    title: '백엔드 엔지니어 (Backend)',
    desc: '논리적이고 체계적인 문제 해결 성향에 가장 부합하는 추천 직무예요. Python, FastAPI, 데이터베이스 설계 역량이 강점으로 작용해요.',
  },
  {
    rate: 89,
    title: '인공지능 / ML 엔지니어',
    desc: '자연어 처리(NLP)와 문장 분류 모델을 다루는 데 대한 높은 흥미와 적성이 반영된 추천 직무예요.',
  },
  {
    rate: 81,
    title: '웹 프론트엔드 개발자',
    desc: '직관적인 UI/UX 구현과 인터랙티브한 화면 설계에 대한 관심이 반영되어 매칭됐어요.',
  },
]

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
  const xStep = plotWidth / (points.length - 1)
  const yTicks = [0, 25, 50, 75, 100]

  function xAt(index) {
    return padLeft + index * xStep
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
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('profile')
  const [period, setPeriod] = useState('week')
  const [profileSaved, setProfileSaved] = useState(false)
  const [editingInfo, setEditingInfo] = useState(false)
  const [notifyOn, setNotifyOn] = useState(true)
  // 선호 추천 분야 = 적성 검사 60% + 채팅 분석 40%로 자동 계산된 값(AppLayout에 올려둔
  // PreferenceProvider를 구독). 더 이상 직접 입력하는 값이 아니라서 여기엔 그 값을
  // 읽어오는 코드만 있고, 검사/채팅 화면이 결과를 setTestResult / setChatResult로
  // 넘겨주기만 하면 이 화면과 채용공고 스마트픽이 동시에 갱신됨.
  // "진단하기" 박스와 진단 모달은 상단 헤더(Header.jsx)로 옮겨졌음 — 여기서는 값
  // 표시(및 초기화 버튼)만 함.
  const { preferredCategory, hasPreferenceData, resetPreference } = usePreference()

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
        {activeTab === 'emotion' && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-card bg-white p-6 shadow-1 sm:p-7">
              <h3 className="text-h3 text-[17px] text-ink">최근 주요 감정 패턴</h3>
              <EmotionRadar data={EMOTION_PATTERN} />
            </div>

            <div className="rounded-card bg-white p-6 shadow-1 sm:p-7">
              <div className="flex items-center justify-between gap-4">
                <h3 className="text-h3 text-[17px] text-ink">심리상태 리포트</h3>
                <div className="flex gap-1 rounded-pill bg-canvas p-1">
                  {Object.entries(PERIOD_DATA).map(([key, { label }]) => (
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

              <div className="relative mt-4">
                <div className="pointer-events-none absolute left-1 top-1 z-10 rounded-btn bg-coral-bg px-2 py-1 text-[11px] font-bold text-coral-deep">
                  좋음 (100)
                </div>
                <div className="pointer-events-none absolute bottom-6 left-1 z-10 rounded-btn bg-canvas px-2 py-1 text-[11px] font-bold text-slate">
                  나쁨 (0)
                </div>
                <TrendChart dates={PERIOD_DATA[period].dates} points={PERIOD_DATA[period].points} />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'chatlog' && (
          <div className="space-y-3">
            {CHAT_LOG.map((log) => (
              <div
                key={log.title}
                className="flex flex-col gap-3 rounded-card bg-white p-5 shadow-1 sm:flex-row sm:items-center sm:justify-between sm:p-6"
              >
                <div>
                  <span className="inline-flex rounded-pill bg-coral-bg px-3 py-1 text-[12px] font-bold text-coral-deep">
                    {log.tag}
                  </span>
                  <p className="mt-2 font-semibold text-ink">{log.title}</p>
                  <p className="mt-1 text-[13px] text-slate">{log.meta}</p>
                </div>
                <button
                  type="button"
                  disabled
                  title="백엔드 연동 후 이용할 수 있어요"
                  className="btn-secondary shrink-0 opacity-50"
                >
                  대화 보기
                </button>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'jobs' && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {JOB_MATCHES.map((job) => (
              <div key={job.title} className="flex flex-col justify-between rounded-card bg-white p-6 shadow-1">
                <div>
                  <span className="inline-flex rounded-pill bg-coral-bg px-3 py-1 text-[12px] font-bold text-coral-deep">
                    매칭률 {job.rate}%
                  </span>
                  <h3 className="mt-3 text-h3 text-[17px] text-ink">{job.title}</h3>
                  <p className="mt-2 text-[13px] leading-relaxed text-slate">{job.desc}</p>
                </div>
                <Link to="/home/jobs" className="btn-secondary mt-5">
                  공고 확인하기
                </Link>
              </div>
            ))}
          </div>
        )}

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
                  <div className="flex items-center justify-between">
                    <dt className="text-[13px] text-slate">알림 수신</dt>
                    <dd className="text-[14px] font-semibold text-ink">{notifyOn ? '동의함' : '동의 안 함'}</dd>
                  </div>
                </dl>
              ) : (
                <form className="mt-4 space-y-4" onSubmit={handleProfileSubmit}>
                  {/* 선호 추천 분야는 더 이상 여기서 직접 입력하지 않음 — 적성 검사와
                      채팅 상담 결과를 바탕으로 자동 계산되는 값이라 편집 폼에서 뺐음.
                      갱신은 상단 헤더의 "진단하기" 박스에서, 초기화는 왼쪽 항목에서. */}
                  <p className="rounded-btn bg-canvas px-4 py-2.5 text-[13px] text-slate">
                    선호 추천 분야는 적성 검사·채팅 상담 결과로 자동 설정돼요. 화면 상단 "진단하기" 박스에서
                    바로 갱신해볼 수 있어요.
                  </p>

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
