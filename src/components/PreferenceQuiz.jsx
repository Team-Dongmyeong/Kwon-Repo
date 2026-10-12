import { useState } from 'react'
import { SUB_JOBS_BY_CATEGORY } from '../constants/jobCategories.js'

// 간단 진단 테스트 — 실제로는 KcELECTRA/SBERT 적성 검사 결과가 이 자리에 들어가게 됨.
// 질문 5개 각각의 선택지 5개가 JOB_CATEGORIES 5개 대분류에 1:1로 대응됨(category).
// (2026-10-11 변경) 예전에는 "결과 반영하기"를 누르면 선호 추천 분야가 바로
// 바뀌었는데, 이제 선호 추천 분야는 마이페이지에서 사용자가 직접 고르는 값으로
// 바뀌어서 이 퀴즈가 그 값을 자동으로 바꾸지 않음. 버튼도 "결과 보기"로 바뀌었고,
// 누르면 같은 카드 안에서 1~3순위 추천 분야와 1순위 분야에 속한 세부직무
// 목록을 보여주기만 함 — 마이페이지에 반영하고 싶으면 이 결과를 참고해서
// "내 정보 수정하기"에서 직접 골라야 함.
const QUIZ_QUESTIONS = [
  {
    prompt: '새로운 걸 배울 때 가장 끌리는 활동은?',
    options: [
      { label: '새로운 프로그래밍 언어나 툴 익히기', category: 'IT/SW' },
      { label: '예쁜 디자인·그림 자료 찾아보기', category: '디자인' },
      { label: '사람들 만나서 이야기 듣고 도와주기', category: '공공·복지' },
      { label: '맛있는 음식 레시피 연구하기', category: '식·음료' },
      { label: '트렌드 상품이나 마케팅 사례 분석하기', category: 'MD/상품기획' },
    ],
  },
  {
    prompt: '친구들이 나를 이렇게 표현한다',
    options: [
      { label: '논리적이고 꼼꼼하다', category: 'IT/SW' },
      { label: '감각적이고 창의적이다', category: '디자인' },
      { label: '따뜻하고 배려심이 많다', category: '공공·복지' },
      { label: '손재주가 좋고 손으로 만드는 걸 좋아한다', category: '식·음료' },
      { label: '트렌드에 민감하고 설득을 잘한다', category: 'MD/상품기획' },
    ],
  },
  {
    prompt: '주말에 시간이 나면 하고 싶은 것',
    options: [
      { label: '코딩 강의나 IT 뉴스 보기', category: 'IT/SW' },
      { label: '전시회·포트폴리오 사이트 구경하기', category: '디자인' },
      { label: '봉사활동·상담 관련 콘텐츠 보기', category: '공공·복지' },
      { label: '새로운 맛집 탐방하기', category: '식·음료' },
      { label: 'SNS 마케팅·쇼핑몰 트렌드 살펴보기', category: 'MD/상품기획' },
    ],
  },
  {
    prompt: '일할 때 가장 뿌듯한 순간은',
    options: [
      { label: '복잡한 문제를 논리적으로 해결했을 때', category: 'IT/SW' },
      { label: '내가 만든 결과물이 예쁘다는 얘기를 들을 때', category: '디자인' },
      { label: '누군가에게 실질적인 도움을 줬을 때', category: '공공·복지' },
      { label: '내가 만든 음식·음료로 손님이 만족할 때', category: '식·음료' },
      { label: '내가 기획한 게 실제로 잘 팔릴 때', category: 'MD/상품기획' },
    ],
  },
  {
    prompt: '이상적인 근무 환경은',
    options: [
      { label: '혼자 집중해서 개발하는 환경', category: 'IT/SW' },
      { label: '자유롭고 감각적인 작업실 분위기', category: '디자인' },
      { label: '사람과 계속 소통하는 현장', category: '공공·복지' },
      { label: '주방·카페처럼 활동적인 현장', category: '식·음료' },
      { label: '시장 반응을 보면서 빠르게 움직이는 환경', category: 'MD/상품기획' },
    ],
  },
]

const CATEGORY_ORDER = QUIZ_QUESTIONS[0].options.map((opt) => opt.category)

export default function PreferenceQuiz({ onCancel }) {
  const [answers, setAnswers] = useState({})
  const [result, setResult] = useState(null)
  const answeredCount = Object.keys(answers).length
  const isComplete = answeredCount === QUIZ_QUESTIONS.length

  function handleShowResult() {
    if (!isComplete) return
    const tally = Object.fromEntries(CATEGORY_ORDER.map((c) => [c, 0]))
    Object.values(answers).forEach(({ category }) => {
      tally[category] += 1
    })
    // 득표수 내림차순. 동점이면 CATEGORY_ORDER(=질문 선택지 순서) 그대로 유지됨
    // (Array.sort는 안정 정렬).
    const ranking = [...CATEGORY_ORDER].sort((a, b) => tally[b] - tally[a])
    setResult({ ranking, tally })
  }

  function handleRetake() {
    setAnswers({})
    setResult(null)
  }

  const top1 = result?.ranking[0]
  const top1SubJobs = top1 ? (SUB_JOBS_BY_CATEGORY[top1] ?? []).filter((subJob) => subJob !== '직무공통') : []

  return (
    <div className="rounded-card bg-white p-6 shadow-1 sm:p-8">
      <div className="flex items-center justify-between">
        <h3 className="text-h3 text-[17px] text-ink">간단 진단 테스트</h3>
        <button type="button" onClick={onCancel} className="text-[12px] font-bold text-slate hover:text-ink">
          닫기
        </button>
      </div>

      {!result ? (
        <>
          <p className="mt-1 text-[13px] text-slate">
            5개 질문에 답하면 어떤 분야가 나와 잘 맞는지 결과로 보여드려요. 실제 서비스에서는 적성 검사
            (KcELECTRA/SBERT) 결과가 이 자리를 대신하게 될 임시 진단이에요. 이 결과는 참고용이고, 선호
            추천 분야는 마이페이지 "내 정보 수정하기"에서 직접 선택해야 적용돼요.
          </p>

          <div className="mt-5 space-y-5">
            {QUIZ_QUESTIONS.map((q, qIndex) => (
              <div key={q.prompt}>
                <p className="text-[14px] font-semibold text-ink">
                  {qIndex + 1}. {q.prompt}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {q.options.map((opt) => {
                    const isActive = answers[qIndex]?.category === opt.category
                    return (
                      <button
                        key={opt.label}
                        type="button"
                        onClick={() =>
                          setAnswers((prev) => ({
                            ...prev,
                            [qIndex]: { category: opt.category },
                          }))
                        }
                        aria-pressed={isActive}
                        className={`rounded-pill border-[1.5px] px-3 py-1.5 text-[12px] transition-colors ${
                          isActive
                            ? 'border-coral bg-coral text-white'
                            : 'border-taupe bg-white text-ink hover:border-coral'
                        }`}
                      >
                        {opt.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={handleShowResult}
            disabled={!isComplete}
            className="btn-accent mt-6 w-full justify-center disabled:pointer-events-none disabled:opacity-50"
          >
            결과 보기 ({answeredCount}/{QUIZ_QUESTIONS.length})
          </button>
        </>
      ) : (
        <div className="mt-5">
          <ol className="space-y-2">
            {result.ranking.slice(0, 3).map((category, index) => (
              <li
                key={category}
                className="flex items-center justify-between rounded-btn bg-canvas px-4 py-2.5 text-[14px]"
              >
                <span className="font-semibold text-ink">
                  {index + 1}순위 {category}
                </span>
                <span className="text-[12px] text-slate">{result.tally[category]}개 선택</span>
              </li>
            ))}
          </ol>

          <div className="mt-5 rounded-btn bg-coral-bg p-4">
            <p className="text-[14px] font-bold text-coral-deep">당신의 추천 직무는 {top1}입니다.</p>
            {top1SubJobs.length > 0 && (
              <p className="mt-2 text-[13px] leading-relaxed text-ink">
                {top1} 직무에는 {top1SubJobs.join(', ')}가 있습니다.
              </p>
            )}
          </div>

          <p className="mt-4 text-[12px] text-slate">
            이 결과를 선호 추천 분야로 적용하고 싶다면, 마이페이지 "내 정보 수정하기"에서 {top1}을 직접
            선택해주세요.
          </p>

          <div className="mt-5 flex gap-2">
            <button type="button" onClick={handleRetake} className="btn-secondary flex-1 justify-center">
              다시 하기
            </button>
            <button type="button" onClick={onCancel} className="btn-accent flex-1 justify-center">
              닫기
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
