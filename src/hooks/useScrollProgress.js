import { useEffect, useRef, useState } from 'react'

// 요소가 뷰포트를 지나가는 동안의 스크롤 진행도(0~1)를 실시간으로 계산하는 훅.
// 스크롤 이벤트마다 다시 계산하고 절대 "한 번만" 멈추지 않기 때문에,
// 위로 스크롤해서 화면 밖으로 나갔다가 다시 아래로 스크롤해 들어와도 애니메이션이 그대로 재생됨.
//
// start / end 는 "뷰포트 높이에 대한 비율"로, 요소의 top이 이 위치를 지나가는 구간에서
// progress가 0 → 1로 움직임. start가 end보다 크면(=아래쪽) 화면에 들어오자마자 빠르게 채워지고,
// 구간을 넓게 잡을수록(예: start 0.9, end 0.05) 스크롤을 많이 해야 완전히 채워짐 — 즉 더 늦게, 더 오래 나타남.
export default function useScrollProgress(ref, { start = 0.85, end = 0.2 } = {}) {
  const [progress, setProgress] = useState(0)
  const frameRef = useRef(null)

  useEffect(() => {
    const node = ref.current
    if (!node) return undefined

    function measure() {
      frameRef.current = null
      const rect = node.getBoundingClientRect()
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight
      const startPx = start * viewportHeight
      const endPx = end * viewportHeight
      const raw = (startPx - rect.top) / (startPx - endPx)
      setProgress(Math.min(1, Math.max(0, raw)))
    }

    function requestMeasure() {
      if (frameRef.current == null) {
        frameRef.current = requestAnimationFrame(measure)
      }
    }

    measure()
    window.addEventListener('scroll', requestMeasure, { passive: true })
    window.addEventListener('resize', requestMeasure)

    return () => {
      window.removeEventListener('scroll', requestMeasure)
      window.removeEventListener('resize', requestMeasure)
      if (frameRef.current != null) cancelAnimationFrame(frameRef.current)
    }
  }, [ref, start, end])

  return progress
}
