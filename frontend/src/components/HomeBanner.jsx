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
// All three slides share matching art (dark background, generated to sit
// directly on bg-ink with no card/frame). Slides sit side by side on one
// "track", and a clone of the last slide is prepended / a clone of the first
// slide is appended to it, so the track can always keep sliding in the same
// direction — itdaa's own carousel motion — and silently snap back to the
// real panel once the clone has scrolled fully into view. That snap happens
// with the transition switched off for one frame, so it's invisible and the
// loop repeats forever in either direction.
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

const slideCount = slides.length
// [clone of last, ...real slides, clone of first] — the track this renders.
const trackSlides = [slides[slideCount - 1], ...slides, slides[0]]
const FIRST_REAL = 1
const LAST_REAL = slideCount

export default function HomeBanner() {
  // Position within trackSlides. 1..slideCount are the real panels; 0 and
  // slideCount + 1 are the leading/trailing clones used only mid-animation.
  const [trackIndex, setTrackIndex] = useState(FIRST_REAL)
  const [animate, setAnimate] = useState(true)
  const [paused, setPaused] = useState(false)
  const timerRef = useRef(null)
  // True from the moment a step/goTo starts a transition until it lands
  // (transitionend, or immediately for the reduced-motion path below).
  // Without this lock, a step fired while the previous one is still mid-flight
  // (fast repeated clicks, or a click landing right as the auto-timer also
  // fires) pushes trackIndex more than one position past a clone — straight
  // out of trackSlides' bounds — which renders `undefined` and blanks the
  // whole page. Ignoring extra input until the current move settles removes
  // that path entirely and also keeps slide order from ever jumping.
  const isAnimatingRef = useRef(false)
  const prefersReducedMotionRef = useRef(false)

  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => {
      prefersReducedMotionRef.current = mq.matches
    }
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  const activeIndex = (trackIndex - FIRST_REAL + slideCount) % slideCount

  const step = useCallback((delta) => {
    if (isAnimatingRef.current) return
    if (prefersReducedMotionRef.current) {
      // No transition will run, so there's no clone to land on and nothing
      // to lock — jump straight to the wrapped real index.
      setAnimate(false)
      setTrackIndex((prev) => {
        const real = (prev - FIRST_REAL + slideCount) % slideCount
        const nextReal = ((real + delta) % slideCount + slideCount) % slideCount
        return FIRST_REAL + nextReal
      })
      return
    }
    isAnimatingRef.current = true
    setAnimate(true)
    setTrackIndex((prev) => prev + delta)
  }, [])

  const goTo = useCallback(
    (i) => {
      const target = ((i % slideCount) + slideCount) % slideCount
      if (target === activeIndex) return
      if (prefersReducedMotionRef.current) {
        setAnimate(false)
        setTrackIndex(FIRST_REAL + target)
        return
      }
      if (isAnimatingRef.current) return
      isAnimatingRef.current = true
      setAnimate(true)
      setTrackIndex(FIRST_REAL + target)
    },
    [activeIndex],
  )

  const handleArrowClick = useCallback(
    (e, delta) => {
      step(delta)
      // Drop focus immediately so the arrow doesn't stay visible via
      // group-focus-within after the mouse leaves — otherwise it only
      // hides once focus moves elsewhere (e.g. clicking the other arrow).
      e.currentTarget.blur()
    },
    [step],
  )

  useEffect(() => {
    // Paused (hovered/focused) means no auto-advance at all — nothing to animate.
    if (paused) return undefined
    if (prefersReducedMotionRef.current) return undefined

    timerRef.current = setInterval(() => step(1), 5000)
    return () => clearInterval(timerRef.current)
  }, [paused, step])

  // Once the track finishes sliding, release the lock so the next step can
  // run. If it landed on a clone panel, also snap silently back to the real
  // panel it stands in for — with the transition switched off — so the next
  // step keeps animating in that same direction instead of rubber-banding
  // back the way it came.
  const handleTransitionEnd = useCallback(
    (e) => {
      // transitionend bubbles up from any descendant — the CTA button's hover
      // transform, a dot indicator's width/color transition-all — so without
      // this guard, those fire this handler too and release the lock (or even
      // snap the track) while the track itself is still visually mid-slide,
      // which is what made the banner feel like it skipped slides or froze.
      if (e.target !== e.currentTarget || e.propertyName !== 'transform') return
      if (trackIndex === LAST_REAL + 1) {
        setAnimate(false)
        setTrackIndex(FIRST_REAL)
      } else if (trackIndex === FIRST_REAL - 1) {
        setAnimate(false)
        setTrackIndex(LAST_REAL)
      }
      isAnimatingRef.current = false
    },
    [trackIndex],
  )

  // Re-enable the transition on the next frame after a silent snap, so the
  // snap itself never animates but the following step does.
  useEffect(() => {
    if (animate) return undefined
    const raf = requestAnimationFrame(() => setAnimate(true))
    return () => cancelAnimationFrame(raf)
  }, [animate])

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
          {/* Track — one panel per slide plus a leading/trailing clone,
              shifted left/right as `trackIndex` changes. */}
          <div
            className={`flex ${
              animate ? 'transition-transform duration-500 ease-out motion-reduce:transition-none' : ''
            }`}
            style={{
              width: `${trackSlides.length * 100}%`,
              transform: `translateX(-${(100 / trackSlides.length) * trackIndex}%)`,
            }}
            onTransitionEnd={handleTransitionEnd}
          >
            {trackSlides.map((slide, i) => (
              <div
                key={`${slide.tag}-${i}`}
                aria-hidden={i < FIRST_REAL || i > LAST_REAL ? 'true' : undefined}
                className="relative shrink-0 px-6 py-12 sm:px-10 sm:py-16 lg:px-16 lg:py-20"
                style={{ width: `${100 / trackSlides.length}%` }}
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
                aria-current={i === activeIndex ? 'true' : undefined}
                onClick={() => goTo(i)}
                className={`h-2 rounded-pill transition-all ${
                  i === activeIndex ? 'w-6 bg-canvas' : 'w-2 bg-white/30'
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
