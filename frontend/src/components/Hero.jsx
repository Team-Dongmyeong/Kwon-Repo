import { Link } from 'react-router-dom'
import { ArrowRight, ChatCircleDots, Briefcase } from '@phosphor-icons/react'

export default function Hero() {
  return (
    <section className="mx-auto max-w-content px-4 pb-16 pt-10 sm:px-6 sm:pb-24 sm:pt-14 lg:pb-[128px] lg:pt-20">
      <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-8">
        {/* Copy column */}
        <div>
          <p className="eyebrow-label">
            <span className="h-1.5 w-1.5 rounded-full bg-coral" aria-hidden="true" />
            대화형 심리 케어 &amp; 취업 지원
          </p>

          <h1 className="mt-5 max-w-[15ch] text-hero text-ink sm:text-hero-md">
            대화 한 번으로,
            <br />
            당신의 다음{' '}
            <span className="relative inline-block">
              커리어
              <span
                className="absolute inset-x-0 -bottom-1 h-3 rounded-full bg-coral-bg sm:h-3.5"
                aria-hidden="true"
              />
              <span className="relative">를 찾아드릴게요</span>
            </span>
          </h1>

          <p className="mt-6 max-w-[46ch] text-body-lg text-slate">
            마음잇기는 편안한 대화를 통해 지금의 감정 상태와 직무 고민을 함께 살펴봐요. 그리고 그
            결과를 바탕으로, 근거 있는 채용정보와 맞춤 심리 케어를 함께 이어드립니다.
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link to="/signup" className="btn-primary px-8 py-3.5 text-[17px]">
              시작하기
              <ArrowRight size={18} weight="bold" aria-hidden="true" />
            </Link>
            <p className="text-footer text-slate sm:pl-1">
              가입은 1분, 첫 대화는 지금 바로 시작할 수 있어요.
            </p>
          </div>
        </div>

        {/* Decorative orbit graphic — emotion · job · recruiting, connected */}
        <div
          className="relative mx-auto hidden aspect-square w-full max-w-[360px] lg:block"
          aria-hidden="true"
        >
          <svg
            className="absolute inset-0 h-full w-full"
            viewBox="0 0 360 360"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M 96 240 Q 180 150 262 120"
              stroke="#F37338"
              strokeWidth="1.5"
              strokeDasharray="2 7"
              strokeLinecap="round"
            />
            <path
              d="M 180 60 Q 230 160 262 120"
              stroke="#F37338"
              strokeWidth="1.5"
              strokeDasharray="2 7"
              strokeLinecap="round"
            />
          </svg>

          {/* Main circular portrait */}
          <div className="absolute left-1/2 top-1/2 flex h-[240px] w-[240px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-coral-bg shadow-2">
            <ChatCircleDots size={72} weight="fill" className="text-ink/80" />
            {/* satellite CTA */}
            <div className="absolute bottom-2 right-2 flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-1">
              <ArrowRight size={20} weight="bold" className="text-ink" />
            </div>
          </div>

          {/* Job-match satellite circle */}
          <div className="absolute right-2 top-6 flex h-24 w-24 items-center justify-center rounded-full bg-ink shadow-1">
            <Briefcase size={30} weight="fill" className="text-canvas" />
          </div>

          {/* Small accent dot circle */}
          <div className="absolute bottom-10 left-0 h-9 w-9 rounded-full border-[1.5px] border-ink bg-white" />
        </div>
      </div>
    </section>
  )
}
