import { Link } from 'react-router-dom'
import { Compass, ChatCircleDots, ChartLineUp, Briefcase } from '@phosphor-icons/react'

const steps = [
  {
    step: '01',
    Icon: ChatCircleDots,
    title: '대화 시작하기',
    desc: 'kcELECTRA 기반 상담 엔진과 편안한 대화로 지금의 고민을 이야기해보세요.',
  },
  {
    step: '02',
    Icon: ChartLineUp,
    title: '감정·직무 진단 받기',
    desc: '대화 내용을 바탕으로 감정 상태와 직무 적성을 SBERT 모델이 함께 분석해요.',
  },
  {
    step: '03',
    Icon: Briefcase,
    title: '맞춤 채용정보 확인',
    desc: 'RAG로 검증된 채용 데이터에서 진단 결과에 맞는 공고를 추천받아요.',
  },
  {
    step: '04',
    Icon: Compass,
    title: '마이페이지에서 기록 보기',
    desc: '대화 기록, 감정 리포트, 추천 직무를 마이페이지에서 언제든 다시 확인해요.',
  },
]

export default function Guide() {
  return (
    <section className="space-y-6">
      <div>
        <p className="eyebrow-label">
          <span className="h-1.5 w-1.5 rounded-full bg-coral" aria-hidden="true" />
          이용가이드
        </p>
        <h1 className="mt-4 flex items-center gap-2 text-h3 text-ink">
          <Compass size={24} weight="bold" aria-hidden="true" />
          마음잇기 이용 방법
        </h1>
        <p className="mt-3 text-body text-slate">4단계로 대화부터 채용정보 확인까지 한 번에 이용할 수 있어요.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map(({ step, Icon, title, desc }) => (
          <article
            key={step}
            className="relative rounded-card bg-white p-6 shadow-1 transition-transform duration-150 ease-out hover:-translate-y-1"
          >
            <span className="absolute right-5 top-5 text-[12px] font-bold text-taupe">{step}</span>
            <div className="flex h-12 w-12 items-center justify-center rounded-btn bg-coral-bg">
              <Icon size={22} weight="bold" className="text-coral-deep" aria-hidden="true" />
            </div>
            <h3 className="mt-4 text-h3 text-[17px] text-ink">{title}</h3>
            <p className="mt-2 text-[13px] leading-relaxed text-slate">{desc}</p>
          </article>
        ))}
      </div>

      <div className="flex flex-col items-start gap-4 rounded-card bg-ink px-6 py-6 text-white shadow-1 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <div>
          <span className="text-eyebrow uppercase text-white/60">24 HOURS</span>
          <h3 className="mt-2 text-h3 text-[20px]">대화 상담은 24시간 언제든 이용할 수 있어요.</h3>
        </div>
        <Link to="/home/chat" className="btn-accent shrink-0">
          바로 상담하기
        </Link>
      </div>
    </section>
  )
}
