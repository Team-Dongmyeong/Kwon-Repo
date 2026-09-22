import { useEffect, useRef, useState } from 'react'

// 요소가 뷰포트에 처음 들어오는 순간을 감지하는 훅 — 스크롤 등장 애니메이션 트리거용.
// 한 번 보이면 다시 사라져도 원상복구하지 않고(true 유지), observer는 즉시 해제.
export default function useInView({ threshold = 0.3, rootMargin = '0px' } = {}) {
  const ref = useRef(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const node = ref.current
    if (!node) return undefined

    if (typeof IntersectionObserver === 'undefined') {
      setInView(true)
      return undefined
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true)
          observer.disconnect()
        }
      },
      { threshold, rootMargin },
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [threshold, rootMargin])

  return [ref, inView]
}
