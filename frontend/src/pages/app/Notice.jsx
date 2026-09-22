import { Megaphone } from '@phosphor-icons/react'

// 더미 데이터 — 백엔드 연동 전 프론트 화면 확인용.
const notices = [
  {
    badge: '안내',
    title: '24시간 AI 챗봇 상담 서비스 이용 안내',
    date: '2026.09.05',
  },
  {
    badge: '업데이트',
    title: '마이페이지 감정 진단 리포트 기능 추가',
    date: '2026.09.02',
  },
  {
    badge: '채용',
    title: '9월 신입·인턴 채용정보 집중 업데이트',
    date: '2026.08.28',
  },
  {
    badge: '점검',
    title: '서비스 정기 점검 안내 (매주 화요일 새벽 2~4시)',
    date: '2026.08.20',
  },
]

export default function Notice() {
  return (
    <section className="space-y-6">
      <div>
        <p className="eyebrow-label">
          <span className="h-1.5 w-1.5 rounded-full bg-coral" aria-hidden="true" />
          공지사항
        </p>
        <h1 className="mt-4 flex items-center gap-2 text-h3 text-ink">
          <Megaphone size={24} weight="bold" aria-hidden="true" />
          마음잇기 소식
        </h1>
        <p className="mt-3 text-body text-slate">서비스 업데이트와 중요한 안내를 확인하세요.</p>
      </div>

      {/* 고정 공지 — 강조용 coral 배경 카드 */}
      <div className="rounded-card bg-coral px-6 py-6 text-white shadow-1 sm:px-8 sm:py-7">
        <span className="inline-flex rounded-pill bg-white/20 px-3 py-1 text-eyebrow uppercase">중요</span>
        <h2 className="mt-3 text-h3">2026년 2학기 서비스 이용 가이드가 업데이트됐어요</h2>
        <p className="mt-2 text-body text-white/85">
          대화 상담, 진단 리포트, 채용정보 연계 기능을 한 곳에서 확인하는 방법을 안내에서 다시 정리했어요.
        </p>
      </div>

      <div className="divide-y divide-ink/10 overflow-hidden rounded-card bg-white shadow-1">
        {notices.map((notice) => (
          <div
            key={notice.title}
            className="flex flex-col gap-2 px-6 py-5 transition-colors hover:bg-canvas-lift sm:flex-row sm:items-center sm:gap-6 sm:px-8"
          >
            <span className="inline-flex w-fit shrink-0 rounded-pill bg-coral-bg px-3 py-1 text-[12px] font-bold text-coral-deep">
              {notice.badge}
            </span>
            <strong className="flex-1 text-body font-semibold text-ink">{notice.title}</strong>
            <span className="shrink-0 text-[13px] text-slate">{notice.date}</span>
          </div>
        ))}
      </div>
    </section>
  )
}
