import { useRef } from 'react'
import { Heartbeat, PuzzlePiece, Briefcase } from '@phosphor-icons/react'
import useScrollProgress from '../hooks/useScrollProgress.js'

// 스텝(원) 3개를 서로 겹치며 순차적으로 채워지도록 만드는 스태거 값.
// STEP_STAGGER가 클수록 아이템 사이 간격이 벌어지고, STEP_RANGE는 마지막 아이템이
// 전체 progress(0~1)의 끝에서 딱 완성되도록 자동 계산됨.
const STEP_STAGGER = 0.18
const STEP_RANGE = 1 - 2 * STEP_STAGGER
const ARROW_OFFSET = STEP_STAGGER / 2
const STEP_ENTER_OFFSET_PX = 28

function staggeredProgress(progress, offsetIndex, stagger = STEP_STAGGER, range = STEP_RANGE) {
  const localStart = offsetIndex * stagger
  const value = (progress - localStart) / range
  return Math.min(1, Math.max(0, value))
}

const items = [
  {
    eyebrow: '감정 분석',
    title: 'KcELECTRA 기반 심리 상태 진단',
    desc: '대화 속 말투와 단어 하나하나에서 감정 신호를 읽어내고, 지금 마음이 어떤 상태인지 함께 짚어드려요.',
    Icon: Heartbeat,
    circle: 'bg-coral-bg',
    iconColor: 'text-ink',
    // lg 이상에서만 적용되는 지그재그 배치 오프셋 (원래 lg:translate-y-0)
    restYClassName: 'lg:[--rest-y:0px]',
  },
  {
    eyebrow: '맞춤 직무 매칭',
    title: 'SBERT 기반 직군·직무 분류',
    desc: '문장 임베딩으로 대화 속 강점과 고민을 분석해, 지금 상황에 어울리는 직군과 직무를 찾아드려요.',
    Icon: PuzzlePiece,
    circle: 'bg-ink',
    iconColor: 'text-canvas',
    // 원래 lg:translate-y-14 (3.5rem = 56px)
    restYClassName: 'lg:[--rest-y:56px]',
  },
  {
    eyebrow: '채용정보 연계',
    title: 'RAG 기반 근거 있는 정보 제공',
    desc: '막연한 추측이 아니라 실제 채용 데이터에 근거해서, 확인 가능한 다음 걸음을 함께 제안해요.',
    Icon: Briefcase,
    circle: 'bg-white border-[1.5px] border-ink',
    iconColor: 'text-ink',
    // 원래 lg:-translate-y-4 (-1rem = -16px)
    restYClassName: 'lg:[--rest-y:-16px]',
  },
]

// 원(circle)을 잇는 두 화살표 — arrowPaths[0]은 items[0]→items[1], arrowPaths[1]은 items[1]→items[2]
const arrowPaths = ['M 160 60 Q 400 180 560 130', 'M 640 130 Q 850 40 1020 90']

export default function ServiceIntro() {
  const headingRef = useRef(null)
  const stepsRef = useRef(null)

  // 헤드라인: 섹션이 화면 아래쪽에 살짝 걸치기만 해도(뷰포트 95%~60% 구간) 빠르게 완성 — "먼저 작동"
  const headingProgress = useScrollProgress(headingRef, { start: 0.95, end: 0.6 })

  // 원/화살표: 헤드라인보다는 늦게 시작하지만, 끝까지 스크롤하지 않아도 다 보이도록 구간을 너무 길게 잡지 않음
  const stepsProgress = useScrollProgress(stepsRef, { start: 0.85, end: 0.4 })

  return (
    <section className="relative bg-canvas-lift py-16 sm:py-24 lg:py-[128px]">
      <div className="mx-auto max-w-content px-4 sm:px-6">
        <div ref={headingRef} className="max-w-[52ch]">
          <p className="eyebrow-label">
            <span className="h-1.5 w-1.5 rounded-full bg-coral" aria-hidden="true" />
            어떻게 이어지나요
          </p>
          {/* 헤드라인은 스크롤량에 직접 연동 — 값이 그대로 위치/투명도가 되므로 위로 스크롤하면 다시 사라졌다가,
              아래로 스크롤하면 다시 나타남 (한 번만 재생되는 방식이 아님) */}
          <h2
            className="mt-4 text-h2 text-ink transition-[transform,opacity] duration-150 ease-out sm:text-h2-md"
            style={{
              transform: `translateY(${(1 - headingProgress) * 32}px)`,
              opacity: headingProgress,
            }}
          >
            감정, 직무, 채용정보가 하나의 대화로 연결돼요
          </h2>
        </div>

        <div
          ref={stepsRef}
          className="relative mt-16 grid grid-cols-1 gap-16 sm:grid-cols-2 sm:gap-x-8 sm:gap-y-16 lg:mt-24 lg:grid-cols-3 lg:gap-x-10"
        >
          {/* decorative orbital arcs — desktop only, 앞 원이 채워지기 시작한 직후부터 함께 그려짐 */}
          <svg
            className="pointer-events-none absolute -top-6 left-0 hidden h-40 w-full lg:block"
            viewBox="0 0 1200 200"
            fill="none"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            {arrowPaths.map((d, index) => {
              const arrowProgress = staggeredProgress(stepsProgress, index + ARROW_OFFSET)
              return (
                <path
                  key={d}
                  d={d}
                  stroke="#F37338"
                  strokeWidth="1.5"
                  strokeDasharray="2 8"
                  strokeLinecap="round"
                  // clip-path로 왼쪽→오른쪽 "그려지는" 효과 — 점선 패턴은 그대로 유지됨
                  style={{
                    clipPath: `inset(0 ${(1 - arrowProgress) * 100}% 0 0)`,
                    transition: 'clip-path 120ms linear',
                  }}
                />
              )
            })}
          </svg>

          {items.map(({ eyebrow, title, desc, Icon, circle, iconColor, restYClassName }, index) => {
            const itemProgress = staggeredProgress(stepsProgress, index)
            return (
              <div
                key={title}
                className={`relative flex flex-col items-center text-center ${restYClassName}`}
                style={{
                  // --rest-y: 데스크톱 지그재그 배치용 고정 오프셋 (모바일/태블릿은 0)
                  // 스크롤 진행도가 낮을수록 STEP_ENTER_OFFSET_PX만큼 더 아래에, 진행도가 1이 되면 원래 자리로
                  transform: `translateY(calc(var(--rest-y, 0px) + ${(1 - itemProgress) * STEP_ENTER_OFFSET_PX}px))`,
                  opacity: itemProgress,
                  transition: 'transform 120ms linear, opacity 120ms linear',
                }}
              >
                <div
                  className={`flex h-[200px] w-[200px] items-center justify-center rounded-full shadow-2 sm:h-[240px] sm:w-[240px] ${circle}`}
                >
                  <Icon size={56} weight="fill" className={iconColor} aria-hidden="true" />
                </div>

                <p className="eyebrow-label mt-6 justify-center">
                  <span className="h-1.5 w-1.5 rounded-full bg-coral" aria-hidden="true" />
                  {eyebrow}
                </p>
                <h3 className="mt-3 text-h3 text-ink">{title}</h3>
                <p className="mt-3 max-w-[32ch] text-body text-slate">{desc}</p>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
