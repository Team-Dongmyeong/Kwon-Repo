import { useState } from 'react'

// 채팅(GPT+RAG) 연동 전, "검사 70%" 부분만 손으로 확인해볼 수 있게 만든 임시 간단
// 진단 테스트 — 실제로는 KcELECTRA/SBERT 적성 검사 결과가 이 자리에 들어가게 됨.
// 질문 5개 각각의 선택지 5개가 JOB_CATEGORIES 5개 대분류에 1:1로 대응되고(category),
// 동시에 그 대분류 안에서 질문 내용과 가장 비슷한 세부직무 하나(subJob)에도 연결돼
// 있음 — 그래야 이 퀴즈를 풀었을 때 마이페이지의 "선호 추천 분야"(대분류)뿐 아니라
// 채용공고 스마트픽이 쓰는 "추천 직업 3개"(세부직무 단위)도 같이 바뀌는 걸 실제
// 진단 흐름으로 확인해볼 수 있음. (세부직무 37개 전부를 하나하나 질문으로 만들기엔
// 너무 길어져서, 질문 내용과 제일 가까운 세부직무 하나씩만 대표로 연결해둔 근사치임
// — 정확한 세부직무 매칭은 나중에 실제 KcELECTRA/SBERT 결과로 대체되면 자연히 좋아짐.)
const QUIZ_QUESTIONS = [
  {
    prompt: '새로운 걸 배울 때 가장 끌리는 활동은?',
    options: [
      { label: '새로운 프로그래밍 언어나 툴 익히기', category: 'IT/SW', subJob: '백엔드개발자' },
      { label: '예쁜 디자인·그림 자료 찾아보기', category: '디자인', subJob: '그래픽 디자이너' },
      { label: '사람들 만나서 이야기 듣고 도와주기', category: '공공·복지', subJob: '사회복지사' },
      { label: '맛있는 음식 레시피 연구하기', category: '식·음료', subJob: '요리사' },
      { label: '트렌드 상품이나 마케팅 사례 분석하기', category: 'MD/상품기획', subJob: 'MD' },
    ],
  },
  {
    prompt: '친구들이 나를 이렇게 표현한다',
    options: [
      { label: '논리적이고 꼼꼼하다', category: 'IT/SW', subJob: 'QA' },
      { label: '감각적이고 창의적이다', category: '디자인', subJob: 'UI/UX 디자이너' },
      { label: '따뜻하고 배려심이 많다', category: '공공·복지', subJob: '사회복지사' },
      { label: '손재주가 좋고 손으로 만드는 걸 좋아한다', category: '식·음료', subJob: '제과제빵사' },
      { label: '트렌드에 민감하고 설득을 잘한다', category: 'MD/상품기획', subJob: '홍보' },
    ],
  },
  {
    prompt: '주말에 시간이 나면 하고 싶은 것',
    options: [
      { label: '코딩 강의나 IT 뉴스 보기', category: 'IT/SW', subJob: '웹개발자' },
      { label: '전시회·포트폴리오 사이트 구경하기', category: '디자인', subJob: '시각 디자이너' },
      { label: '봉사활동·상담 관련 콘텐츠 보기', category: '공공·복지', subJob: '사회복지사' },
      { label: '새로운 맛집 탐방하기', category: '식·음료', subJob: '카페·레스토랑 매니저' },
      { label: 'SNS 마케팅·쇼핑몰 트렌드 살펴보기', category: 'MD/상품기획', subJob: '온라인마케터' },
    ],
  },
  {
    prompt: '일할 때 가장 뿌듯한 순간은',
    options: [
      { label: '복잡한 문제를 논리적으로 해결했을 때', category: 'IT/SW', subJob: '백엔드개발자' },
      { label: '내가 만든 결과물이 예쁘다는 얘기를 들을 때', category: '디자인', subJob: '제품 디자이너' },
      { label: '누군가에게 실질적인 도움을 줬을 때', category: '공공·복지', subJob: '사회복지사' },
      { label: '내가 만든 음식·음료로 손님이 만족할 때', category: '식·음료', subJob: '바리스타' },
      { label: '내가 기획한 게 실제로 잘 팔릴 때', category: 'MD/상품기획', subJob: 'MD' },
    ],
  },
  {
    prompt: '이상적인 근무 환경은',
    options: [
      { label: '혼자 집중해서 개발하는 환경', category: 'IT/SW', subJob: '앱개발자' },
      { label: '자유롭고 감각적인 작업실 분위기', category: '디자인', subJob: '공간 디자이너' },
      { label: '사람과 계속 소통하는 현장', category: '공공·복지', subJob: '사회복지사' },
      { label: '주방·카페처럼 활동적인 현장', category: '식·음료', subJob: '조리사' },
      { label: '시장 반응을 보면서 빠르게 움직이는 환경', category: 'MD/상품기획', subJob: '콘텐츠마케터' },
    ],
  },
]

// 질문 5개에 답하면 선택된 카테고리별 비율(0~1) + 세부직무별 비율(0~1)을 같이
// 계산해서 onSubmit(categoryVector, subJobVector)로 넘김. 호출하는 쪽(Header.jsx)이
// categoryVector는 setTestResult로, subJobVector는 setTestSubJobResult로 각각
// 넘기면 "선호 추천 분야"와 "스마트픽 추천 직업 3개"가 이 진단 하나로 동시에 갱신됨.
export default function PreferenceQuiz({ onSubmit, onCancel }) {
  const [answers, setAnswers] = useState({})
  const answeredCount = Object.keys(answers).length
  const isComplete = answeredCount === QUIZ_QUESTIONS.length

  function handleSubmit() {
    if (!isComplete) return
    const categoryTally = {}
    const subJobTally = {}
    Object.values(answers).forEach(({ category, subJob }) => {
      categoryTally[category] = (categoryTally[category] ?? 0) + 1
      subJobTally[subJob] = (subJobTally[subJob] ?? 0) + 1
    })
    const categoryVector = {}
    Object.entries(categoryTally).forEach(([category, count]) => {
      categoryVector[category] = count / QUIZ_QUESTIONS.length
    })
    const subJobVector = {}
    Object.entries(subJobTally).forEach(([subJob, count]) => {
      subJobVector[subJob] = count / QUIZ_QUESTIONS.length
    })
    onSubmit(categoryVector, subJobVector)
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
        5개 질문에 답하면 선호 추천 분야(검사 70% 반영분)와 채용공고 스마트픽의 추천 직업 3개가 함께 계산돼요.
        실제 서비스에서는 적성 검사(KcELECTRA/SBERT) 결과가 이 자리를 대신하게 될 임시 진단이에요.
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
                        [qIndex]: { category: opt.category, subJob: opt.subJob },
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
        onClick={handleSubmit}
        disabled={!isComplete}
        className="btn-accent mt-6 w-full justify-center disabled:pointer-events-none disabled:opacity-50"
      >
        결과 반영하기 ({answeredCount}/{QUIZ_QUESTIONS.length})
      </button>
    </div>
  )
}
