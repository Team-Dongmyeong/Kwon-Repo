import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, CaretLeft, CaretRight } from '@phosphor-icons/react'
import bannerChat from '../assets/banner-chat.webp'
import bannerEmotion from '../assets/banner-emotion.webp'
import bannerJobs from '../assets/banner-jobs.webp'

// Rotating banner — same role as itdaa's home_banner slick carousel, rebuilt
// without an external carousel dependency. Copy is reused verbatim from the
// site's own established sections (no invented filler).
//
// All three slides now have matching art (dark background + colored fills,
// generated to sit directly on bg-ink with no card/frame). Slides are laid
// out side by side on one "track" and the whole track slides left/right on
// change — itdaa's own carousel motion — rather than swapping content in place.
const slides = [
  {
    tag: '대화형 심리 케어 · 취업 지원',
    title: (
      <>
        대화 한 번으로,
        <br />
        당신의 다음 커리어를 찾아드릴게요
      </>
    ),
    desc: '지금의 감정 상태와 직무 고민을 함께 살펴보고, 근거 있는 채용정보로 이어드려요.',
    image: bannerChat,
  },
  {
    tag: '감정 분석',
    title: (
      <>
        체크리스트 대신,
        <br />
        대화로 나누는 마음 진단
      </>
    ),
    desc: '정형화된 문항 대신, 편안한 대화만으로 지금의 감정과 고민이 자연스럽게 드러나요.',
    image: bannerEmotion,
  },
  {
    tag: '채용정보 연계',
    title: (
      <>
        위로가 아니라,
        <br />
        근거 있는 다음 걸음을
      </>
    ),
    desc: 'RAG 기반으로 실제 채용 데이터에 근거한 정보만 골라, 확인 가능한 다음 걸음을 제안해요.',
    image: bannerJobs,
  },
]

export default function HomeBanner() {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const timerRef = useRef(null)

  const goTo = useCallback((i) => {
    setIndex((prev) => {
      const next = (i + slides.length) % slides.length
      return next === prev ? prev : next
    })
  }, [])

  const handleArrowClick = useCallback(
    (e, delta) => {
      goTo(index + delta)
      // Drop focus immediately so the arrow doesn't stay visible via
      // group-focus-within after the mouse leaves — otherwise it only
      // hides once focus moves elsewhere (e.g. clicking the other arrow).
      e.currentTarget.blur()
    },
    [goTo, index],
  )

  useEffect(() => {
    // Paused (hovered/focused) means no auto-advance at all — nothing to animate.
    if (paused) return undefined
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return undefined
    }

    timerRef.current = setInterval(() => {
      setIndex((prev) => (prev + 1) % slides.length)
    }, 5000)
    return () => clearInterval(timerRef.current)
  }, [paused])

  return (
    <section className="mx-auto max-w-content px-4 pt-8 sm:px-6 sm:pt-10">
      {/* Outer wrapper — NOT overflow-hidden, so the hover arrows can sit
          straddling the box's own border instead of being clipped by it. */}
      <div
        className="group relative"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocus={() => setPaused(true)}
        onBlur={() => setPaused(false)}
      >
        <div
          className="relative overflow-hidden rounded-card bg-ink"
          aria-roledescription="carousel"
          aria-label="마음잇기 소개 배너"
        >
          {/* Track — one panel per slide, shifted left/right as `index` changes */}
          <div
            className="flex transition-transform duration-500 ease-out motion-reduce:transition-none"
            style={{
              width: `${slides.length * 100}%`,
              transform: `translateX(-${(100 / slides.length) * index}%)`,
            }}
          >
            {slides.map((slide) => (
              <div
                key={slide.tag}
                className="relative shrink-0 px-6 py-12 sm:px-10 sm:py-16 lg:px-16 lg:py-20"
                style={{ width: `${100 / slides.length}%` }}
              >
                {/* Bleed art escapes this panel's own padding, flush with its top/right/bottom edges */}
                <div className="absolute inset-y-0 right-0 hidden w-1/2 lg:block">
                  <img src={slide.image} alt="" className="h-full w-full object-cover" />
                </div>

                <div className="relative grid grid-cols-1 items-center gap-10">
                  <div className="lg:max-w-[50%]">
                    <p className="inline-flex items-center gap-2 rounded-pill bg-white/10 px-3 py-1 text-eyebrow uppercase text-canvas">
                      {slide.tag}
                    </p>
                    <h2 className="mt-5 text-h2 text-canvas sm:text-h2-md">{slide.title}</h2>
                    <p className="mt-4 max-w-[42ch] text-body-lg text-canvas/70">{slide.desc}</p>
                    <Link
                      to="/signup"
                      className="mt-8 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-btn bg-canvas px-6 py-2.5 text-nav text-ink transition-transform duration-150 ease-out hover:-translate-y-0.5 active:translate-y-0"
                    >
                      시작하기
                      <ArrowRight size={18} weight="bold" aria-hidden="true" />
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Dot indicators — bottom-center of the box, held off the edge, above the track */}
          <div className="absolute inset-x-0 bottom-6 z-10 flex items-center justify-center gap-2 sm:bottom-8">
            {slides.map((slide, i) => (
              <button
                key={slide.tag}
                type="button"
                aria-label={`${i + 1}번째 배너로 이동`}
                aria-current={i === index ? 'true' : undefined}
                onClick={() => goTo(i)}
                className={`h-2 rounded-pill transition-all ${
                  i === index ? 'w-6 bg-canvas' : 'w-2 bg-white/30'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Hover-reveal arrows — centered ON the box's own border (half outside
            it), hidden the instant the pointer/focus leaves. */}
        <button
          type="button"
          onClick={(e) => handleArrowClick(e, -1)}
          aria-label="이전 배너"
          className="absolute left-0 top-1/2 z-10 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-ink opacity-0 shadow-2 transition-opacity duration-100 focus-visible:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100"
        >
          <CaretLeft size={18} weight="bold" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={(e) => handleArrowClick(e, 1)}
          aria-label="다음 배너"
          className="absolute right-0 top-1/2 z-10 flex h-11 w-11 translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-ink opacity-0 shadow-2 transition-opacity duration-100 focus-visible:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100"
        >
          <CaretRight size={18} weight="bold" aria-hidden="true" />
        </button>
      </div>
    </section>
  )
}
