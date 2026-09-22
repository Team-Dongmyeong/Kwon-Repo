import { Link } from 'react-router-dom'
import { ArrowRight } from '@phosphor-icons/react'

export default function BottomCTA() {
  return (
    <section className="bg-canvas-lift py-16 sm:py-24 lg:py-[128px]">
      <div className="mx-auto flex max-w-content flex-col items-start gap-8 px-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
        <h2 className="text-h2 text-ink sm:text-h2-md">
          지금, 편하게
          <br />
          이야기부터 시작해볼까요?
        </h2>
        <Link to="/signup" className="btn-primary shrink-0 px-8 py-3.5 text-[17px]">
          시작하기
          <ArrowRight size={18} weight="bold" aria-hidden="true" />
        </Link>
      </div>
    </section>
  )
}
