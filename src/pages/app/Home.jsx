import { Link } from 'react-router-dom'
import { Megaphone, Briefcase, ChatCircleDots, Compass, ArrowRight } from '@phosphor-icons/react'
import { useAuth } from '../../context/AuthContext.jsx'

// 로그인 후 첫 화면 — 팀원(수현)이 만든 홈 화면 구조(히어로 + 바로가기 카드
// 그리드)를 참고해서, 우리 디자인 토큰(coral 포인트 + 화이트 캔버스)으로 다시
// 구성했어. 보라/분홍 그라데이션 대신 우리 브랜드 컬러를 그대로 사용.
const quickLinks = [
  { to: '/home/notice', Icon: Megaphone, title: '공지사항', desc: '중요 공지를 빠르게 확인하세요.', tint: 'coral' },
  { to: '/home/jobs', Icon: Briefcase, title: '맞춤 채용정보', desc: 'RAG로 연계된 최신 채용정보를 확인하세요.', tint: 'ink' },
  { to: '/home/chat', Icon: ChatCircleDots, title: '24시간 대화방', desc: '언제든 챗봇에게 질문하세요.', tint: 'coral' },
  { to: '/home/guide', Icon: Compass, title: '이용가이드', desc: '대화부터 채용정보까지 이용 방법을 안내해요.', tint: 'ink' },
]

const stats = [
  { value: '24H', label: '챗봇 상담' },
  { value: '7', label: '주요 메뉴' },
  { value: '1', label: '통합 플랫폼' },
]

export default function Home() {
  const { user } = useAuth()

  return (
    <section className="space-y-8">
      <div className="rounded-card bg-ink px-6 py-10 text-white shadow-1 sm:px-10 sm:py-14">
        <span className="inline-flex rounded-pill bg-white/10 px-3 py-1 text-eyebrow uppercase text-canvas">
          Welcome back
        </span>
        <h1 className="mt-5 text-h2 sm:text-h2-md">
          {user?.name ? `${user.name}님, ` : ''}
          오늘도 마음잇기와
          <br />
          함께 다음 걸음을 찾아봐요
        </h1>
        <p className="mt-4 max-w-[48ch] text-body text-white/70">
          대화, 감정·직무 진단, 채용정보 연계까지 — 필요한 기능을 아래에서 바로 이동할 수 있어요.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link to="/home/chat" className="btn-accent">
            대화 시작하기
            <ArrowRight size={18} weight="bold" aria-hidden="true" />
          </Link>
          <Link
            to="/home/notice"
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-btn border-[1.5px] border-white/30 px-6 py-2.5 text-nav text-white transition-transform duration-150 ease-out hover:-translate-y-0.5 active:translate-y-0"
          >
            공지 확인하기
          </Link>
        </div>

        <div className="mt-10 flex flex-wrap gap-8">
          {stats.map(({ value, label }) => (
            <div key={label}>
              <strong className="text-h3 text-canvas">{value}</strong>
              <p className="mt-1 text-[12px] text-white/60">{label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {quickLinks.map(({ to, Icon, title, desc, tint }) => (
          <Link
            key={to}
            to={to}
            className="flex flex-col gap-4 rounded-card bg-white p-6 shadow-1 transition-transform duration-150 ease-out hover:-translate-y-1"
          >
            <span
              className={`flex h-12 w-12 items-center justify-center rounded-btn ${
                tint === 'coral' ? 'bg-coral-bg text-coral-deep' : 'bg-bone text-ink-soft'
              }`}
            >
              <Icon size={22} weight="duotone" aria-hidden="true" />
            </span>
            <div>
              <h3 className="text-h3 text-[17px] text-ink">{title}</h3>
              <p className="mt-1 text-[13px] leading-relaxed text-slate">{desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}
