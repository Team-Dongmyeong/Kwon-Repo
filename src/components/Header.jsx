import { useEffect, useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { Sparkle, SignOut } from '@phosphor-icons/react'
import { useAuth } from '../context/AuthContext.jsx'
import PreferenceQuiz from './PreferenceQuiz.jsx'

// 메인 메뉴 (로그아웃 상태) — 로그인 상태와 동일한 스타일의 상단 바를 그대로
// 쓰되, 계정 없이도 바로 이용 가능한 항목(홈/공지사항/이용가이드/FAQ)만 노출.
// 채팅·채용공고·청년정책·마이페이지는 로그인이 필요한 기능이라 제외.
const publicNavItems = [
  { label: '홈', to: '/', end: true },
  { label: '공지사항', to: '/notice' },
  { label: '이용가이드', to: '/guide' },
  { label: 'FAQ', to: '/faq' },
]

// 메인 메뉴 (로그인 상태) — 실제로 동작하는 내비게이션.
const appNavItems = [
  { label: '홈', to: '/home', end: true },
  { label: '채팅', to: '/home/chat' },
  { label: '채용공고', to: '/home/jobs' },
  { label: '청년정책', to: '/home/policies' },
  { label: '공지사항', to: '/home/notice' },
  { label: '이용가이드', to: '/home/guide' },
  { label: 'FAQ', to: '/home/faq' },
  { label: '마이페이지', to: '/home/mypage' },
]

// 로그인 전/후 화면에서 공유하는 헤더. 로그인 여부와 상관없이 동일한 스타일의
// 상단 바를 쓰고, 항목 목록만 로그인 상태에 따라 바뀜(publicNavItems / appNavItems).
export default function Header() {
  const { user, isAuthenticated, logout } = useAuth()
  const navigate = useNavigate()

  // 로그인 후 "진단하기" 박스 + 중앙 모달. 그냥 간단 진단 퀴즈를 여는 버튼일
  // 뿐이고, 선호 추천 분야 값과는 더 이상 연결되지 않음 — 퀴즈를 몇 번을
  // 돌리든, 결과가 무엇이든 버튼 문구는 항상 "진단하기"로 고정. 선호 추천
  // 분야는 마이페이지 "내 정보 수정하기"에서만 바뀜(PreferenceContext.jsx 참고).
  const [quizOpen, setQuizOpen] = useState(false)

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

        {/* 메인 메뉴 — 로그인 여부와 상관없이 항상 표시, 항목 목록만 바뀜 */}
        <nav className="flex flex-wrap items-center gap-1" aria-label="주요 기능">
          {(isAuthenticated ? appNavItems : publicNavItems).map(({ label, to, end }) => (
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
          ))}
        </nav>

        {isAuthenticated ? (
          <div className="ml-auto flex shrink-0 items-center gap-3">
            {/* "진단하기" 박스 — 홈/채팅/채용공고/마이페이지 등 어느 화면에 있든
                최상단 헤더에 항상 떠 있는 위치. 눌러서 5문항 간단 진단을 마치면
                결과(1~3순위 분야)만 그 자리에서 보여주고 끝 — 선호 추천 분야를
                바꾸지 않으니 이 버튼 문구도 항상 "진단하기"로 고정. */}
            <button
              type="button"
              onClick={() => setQuizOpen(true)}
              className="inline-flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-pill bg-coral-bg px-3.5 py-2 text-[13px] font-semibold text-coral-deep transition-transform duration-150 ease-out hover:-translate-y-0.5 active:translate-y-0"
            >
              <Sparkle size={14} weight="fill" aria-hidden="true" />
              진단하기
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
            className="ml-auto inline-flex min-h-[36px] shrink-0 items-center justify-center rounded-btn border-[1.5px] border-coral px-4 text-[13px] font-semibold text-coral transition-transform duration-150 ease-out hover:-translate-y-0.5 active:translate-y-0"
          >
            로그인
          </Link>
        )}
      </div>

      {/* 간단 진단 테스트 — 화면 중앙에 뜨는 모달. 배경(딤 처리된 부분)을 클릭하거나
          Esc를 누르면 닫힘. 헤더가 모든 로그인 후 화면에 공통으로 떠 있으니, 어느
          페이지에서 열어도 동일하게 동작함. (2026-10-11 변경) 결과를 반영하는
          onSubmit은 더 이상 없음 — PreferenceQuiz가 결과를 자체적으로 보여주기만 함. */}
      {isAuthenticated && quizOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="간단 진단 테스트"
        >
          <div className="absolute inset-0 bg-ink/50" onClick={() => setQuizOpen(false)} aria-hidden="true" />
          <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto animate-fade-up">
            <PreferenceQuiz onCancel={() => setQuizOpen(false)} />
          </div>
        </div>
      )}
    </header>
  )
}
