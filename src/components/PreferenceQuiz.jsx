import { useState } from 'react'

// 채팅(GPT+RAG) 연동 전, "검사 60%" 부분만 손으로 확인해볼 수 있게 만든 임시 간단
// 진단 테스트 — 실제로는 KcELECTRA/SBERT 적성 검사 결과가 이 자리에 들어가게 됨.
// 질문 5개 각각의 선택지 5개가 JOB_CATEGORIES 5개 대분류에 1:1로 대응됨.
//
// 헤더(Header.jsx)의 "진단하기" 박스에서 열어서 쓰는 걸 기준으로 만들어서, 어느
// 페이지에 있든(홈/채팅/채용공고/마이페이지) 똑같이 열 수 있음. 마이페이지 안에서만
// 쓰던 걸 여기 별도 파일로 뺀 이유이기도 함 — 여러 곳에서 import해서 재사용하려고.
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

// 질문 5개에 답하면 선택된 카테고리별 비율(0~1)을 계산해서 PreferenceContext의
// setTestResult로 넘김 — setTestResult는 문자열 하나만 받아도 되고, 이렇게
// { 'IT/SW': 0.6, '디자인': 0.4 } 같은 분포 객체를 받아도 되게 만들어져 있음.
export default function PreferenceQuiz({ onSubmit, onCancel }) {
  const [answers, setAnswers] = useState({})
  const answeredCount = Object.keys(answers).length
  const isComplete = answeredCount === QUIZ_QUESTIONS.length

  function handleSubmit() {
    if (!isComplete) return
    const tally = {}
    Object.values(answers).forEach((category) => {
      tally[category] = (tally[category] ?? 0) + 1
    })
    const vector = {}
    Object.entries(tally).forEach(([category, count]) => {
      vector[category] = count / QUIZ_QUESTIONS.length
    })
    onSubmit(vector)
  }

  return (
    <div className="rounded-card bg-white p-6 shadow-1 sm:p-8">
      <div className="flex items-center justify-between">
        <h3 className="text-h3 text-[17px] text-ink">간단 진단 테스트</h3>
        <button type="button" onClick={onCancel} className="text-[12px] font-bold text-slate hover:text-ink">
          닫기
        </button>
      </div>
      <p className="mt-1 text-[13px] text-slate">
        5개 질문에 답하면 선호 추천 분야(검사 60% 반영분)가 계산돼요. 실제 서비스에서는 적성 검사(KcELECTRA/SBERT)
        결과가 이 자리를 대신하게 될 임시 진단이에요.
      </p>

      <div className="mt-5 space-y-5">
        {QUIZ_QUESTIONS.map((q, qIndex) => (
          <div key={q.prompt}>
            <p className="text-[14px] font-semibold text-ink">
              {qIndex + 1}. {q.prompt}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {q.options.map((opt) => {
                const isActive = answers[qIndex] === opt.category
                return (
                  <button
                    key={opt.label}
                    type="button"
                    onClick={() => setAnswers((prev) => ({ ...prev, [qIndex]: opt.category }))}
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
        onClick={handleSubmit}
        disabled={!isComplete}
        className="btn-accent mt-6 w-full justify-center disabled:pointer-events-none disabled:opacity-50"
      >
        결과 반영하기 ({answeredCount}/{QUIZ_QUESTIONS.length})
      </button>
    </div>
  )
}
