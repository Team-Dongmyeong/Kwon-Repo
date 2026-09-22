import { useEffect, useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { ChatCircleDots, Heartbeat, PuzzlePiece, Briefcase, Sparkle, SignOut } from '@phosphor-icons/react'
import { useAuth } from '../context/AuthContext.jsx'
import { usePreference } from '../context/PreferenceContext.jsx'
import PreferenceQuiz from './PreferenceQuiz.jsx'

// 메인 메뉴 (로그아웃 상태) — 마음잇기의 네 가지 축(대화 / 감정 케어 / 직무 매칭
// / 채용정보). 아직 계정이 없는 상태라 전부 /signup으로 연결됨.
const menuItems = [
  { label: '대화 시작하기', Icon: ChatCircleDots, to: '/signup' },
  { label: '감정 케어', Icon: Heartbeat, to: '/signup' },
  { label: '직무 매칭', Icon: PuzzlePiece, to: '/signup' },
  { label: '채용정보', Icon: Briefcase, to: '/signup' },
]

// itdaa의 "AI 진단 검사" 항목처럼 호버 시 서브메뉴 3개(진로/인성/기업핏 검사)가
// 열리는 형태 — 우리 서비스에 맞는 세 가지 진단으로 대체.
const diagnosisSubItems = ['감정 진단', '직무 적성 진단', '종합 리포트']

// 메인 메뉴 (로그인 상태) — 실제로 동작하는 내비게이션. 이용가이드/FAQ도 이제
// 여기로 옮겨와서, 로그인 후에는 헤더 우측의 별도 "이용 안내" 링크 줄이 없어짐.
// 아이콘은 로그인 전 메뉴에만 쓰고, 로그인 후에는 텍스트만 — 항목이 7개로
// 늘면서 아이콘까지 있으면 한 줄이 너무 붐벼 보여서 뺐어.
const appNavItems = [
  { label: '홈', to: '/home', end: true },
  { label: '채팅', to: '/home/chat' },
  { label: '채용공고', to: '/home/jobs' },
  { label: '공지사항', to: '/home/notice' },
  { label: '이용가이드', to: '/home/guide' },
  { label: 'FAQ', to: '/home/faq' },
  { label: '마이페이지', to: '/home/mypage' },
]

// 로그인 전/후 화면에서 공유하는 헤더. 팀원들이 만든 화면들처럼 로고와
// 로그인/로그아웃 사이에 메뉴를 한 줄로 압축했어 — 실제 콘텐츠는 팀원들이
// 채워나가는 영역이라, 이쪽은 "틀"이 되는 내비게이션 크기/여백/색상 규칙을
// 최대한 정리하는 데 집중.
export default function Header() {
  const [diagnosisOpen, setDiagnosisOpen] = useState(false)
  const { user, isAuthenticated, logout } = useAuth()
  const navigate = useNavigate()

  // 로그인 후 "진단하기" 박스 + 중앙 모달. usePreference()는 PreferenceProvider가
  // 없는 화면(로그인 전 랜딩)에서도 안전한 기본값을 돌려주게 되어있어서, Header가
  // 로그인/비로그인 양쪽에서 렌더링돼도 여기서 훅을 그냥 호출해도 문제없음 —
  // 다만 박스 자체는 isAuthenticated일 때만 보여줌(로그인 전엔 진단할 결과가 없음).
  const { preferredCategory, hasPreferenceData, setTestResult } = usePreference()
  const [quizOpen, setQuizOpen] = useState(false)

  function handleQuizSubmit(vector) {
    setTestResult(vector)
    setQuizOpen(false)
  }

  // 모달이 열려있을 때 Esc로도 닫히게. 배경(딤 처리된 부분) 클릭으로도 닫을 수 있음.
  useEffect(() => {
    if (!quizOpen) return
    function handleKeyDown(event) {
      if (event.key === 'Escape') setQuizOpen(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [quizOpen])

  function handleLogout() {
    logout()
    navigate('/', { replace: true })
  }

  // 클릭해도 페이지가 안 바뀌는 항목(AI 진단 검사처럼 그 자리에서 열리는
  // 드롭다운)만 "선택된 상태"가 실제로 존재해서 배경을 채울 수 있음. 나머지
  // 로그아웃 메뉴는 전부 /signup으로 바로 이동하는 링크라 "클릭된 채로 남는"
  // 상태 자체가 없고, 로그인 메뉴는 NavLink의 실제 경로 활성 상태로 채워짐.
  const navItemClass =
    'inline-flex min-h-[40px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-pill px-3.5 py-2 text-[14px] font-semibold transition-colors text-black hover:bg-canvas-lift hover:text-coral'

  return (
    <header className="sticky top-0 z-40 border-b border-ink/10 bg-white">
      <div className="mx-auto flex max-w-content flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 sm:px-6">
        <Link
          to={isAuthenticated ? '/home' : '/'}
          className="shrink-0 text-[22px] font-bold tracking-tight text-coral"
          aria-label="마음잇기 홈으로 이동"
        >
          maeum
        </Link>

        {/* 메인 메뉴 — 로고와 로그인/로그아웃 사이, 한 줄로 압축 */}
        <nav className="flex flex-wrap items-center gap-1" aria-label="주요 기능">
          {isAuthenticated
            ? appNavItems.map(({ label, to, end }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  className={({ isActive }) =>
                    `inline-flex min-h-[40px] shrink-0 items-center whitespace-nowrap rounded-pill px-3.5 py-2 text-[14px] font-semibold transition-colors ${
                      isActive ? 'bg-coral text-white' : 'text-black hover:bg-canvas-lift hover:text-coral'
                    }`
                  }
                >
                  {label}
                </NavLink>
              ))
            : menuItems.map(({ label, Icon, to }) => (
                <Link key={label} to={to} className={navItemClass}>
                  <Icon size={16} weight="duotone" aria-hidden="true" />
                  {label}
                </Link>
              ))}

          {!isAuthenticated && (
            <div
              className="relative shrink-0"
              onMouseEnter={() => setDiagnosisOpen(true)}
              onMouseLeave={() => setDiagnosisOpen(false)}
            >
              <button
                type="button"
                onFocus={() => setDiagnosisOpen(true)}
                onBlur={() => setDiagnosisOpen(false)}
                aria-haspopup="true"
                aria-expanded={diagnosisOpen}
                className={`${navItemClass} ${diagnosisOpen ? '!bg-coral !text-white' : ''}`}
              >
                <Sparkle size={16} weight="bold" aria-hidden="true" />
                AI 진단 검사
              </button>

              {diagnosisOpen && (
                <div className="absolute left-0 top-full z-50 w-44 rounded-btn border border-ink/10 bg-white py-2 shadow-2">
                  {diagnosisSubItems.map((item) => (
                    <Link
                      key={item}
                      to="/signup"
                      className="block px-4 py-2 text-[14px] font-medium text-ink hover:bg-canvas-lift hover:text-coral"
                    >
                      {item}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}
        </nav>

        {/* 로그인 전에만 쓰는 보조 유틸 링크 — 로그인 후에는 이용가이드/FAQ가
            위 메인 메뉴로 옮겨갔으니 이 줄은 필요 없음. */}
        {!isAuthenticated && (
          <nav className="ml-auto hidden items-center gap-5 text-[13px] text-ink-soft md:flex" aria-label="이용 안내">
            <a href="#" className="hover:text-ink">
              이용가이드
            </a>
            <a href="#" className="hover:text-ink">
              자주 묻는 질문
            </a>
          </nav>
        )}

        {isAuthenticated ? (
          <div className="ml-auto flex shrink-0 items-center gap-3">
            {/* "진단하기" 박스 — 홈/채팅/채용공고/마이페이지 등 어느 화면에 있든
                최상단 헤더에 항상 떠 있는 위치. 눌러서 5문항 간단 진단을 마치면
                선호 추천 분야(검사 60% 반영분)가 여기서 바로 갱신되고, 이 값을
                구독하는 채용공고 스마트픽/마이페이지가 실시간으로 같이 바뀜. */}
            <button
              type="button"
              onClick={() => setQuizOpen(true)}
              className="inline-flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-pill bg-coral-bg px-3.5 py-2 text-[13px] font-semibold text-coral-deep transition-transform duration-150 ease-out hover:-translate-y-0.5 active:translate-y-0"
            >
              <Sparkle size={14} weight="fill" aria-hidden="true" />
              {hasPreferenceData ? preferredCategory : '진단하기'}
            </button>

            {user?.name && <span className="hidden text-[13px] text-slate sm:inline">{user.name}님</span>}
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-btn border-[1.5px] border-ink/15 px-3.5 text-[13px] font-semibold text-ink transition-transform duration-150 ease-out hover:-translate-y-0.5 hover:border-ink/30 active:translate-y-0"
            >
              <SignOut size={14} weight="bold" aria-hidden="true" />
              로그아웃
            </button>
          </div>
        ) : (
          <Link
            to="/login"
            className="ml-auto inline-flex min-h-[36px] shrink-0 items-center justify-center rounded-btn border-[1.5px] border-coral px-4 text-[13px] font-semibold text-coral transition-transform duration-150 ease-out hover:-translate-y-0.5 active:translate-y-0 md:ml-0"
          >
            로그인
          </Link>
        )}
      </div>

      {/* 간단 진단 테스트 — 화면 중앙에 뜨는 모달. 배경(딤 처리된 부분)을 클릭하거나
          Esc를 누르면 닫힘. 헤더가 모든 로그인 후 화면에 공통으로 떠 있으니, 어느
          페이지에서 열어도 동일하게 동작함. */}
      {isAuthenticated && quizOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="간단 진단 테스트"
        >
          <div className="absolute inset-0 bg-ink/50" onClick={() => setQuizOpen(false)} aria-hidden="true" />
          <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto animate-fade-up">
            <PreferenceQuiz onSubmit={handleQuizSubmit} onCancel={() => setQuizOpen(false)} />
          </div>
        </div>
      )}
    </header>
  )
}
