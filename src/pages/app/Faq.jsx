import { useState } from 'react'
import { Question, Plus, Minus } from '@phosphor-icons/react'

const faqItems = [
  {
    q: '상담은 몇 시까지 이용할 수 있나요?',
    a: '마음잇기는 AI 챗봇 기반이라 평일·주말·공휴일 구분 없이 24시간 언제든 대화할 수 있어요.',
  },
  {
    q: '대화 내용은 저장되고, 안전하게 관리되나요?',
    a: '대화 기록은 마이페이지의 채팅로그에서 다시 확인할 수 있고, 감정·직무 진단에만 활용돼요. 자세한 처리 방침은 개인정보처리방침에서 확인할 수 있어요.',
  },
  {
    q: '감정·직무 진단 결과는 얼마나 정확한가요?',
    a: 'kcELECTRA·SBERT 모델이 대화 문맥을 분석해 참고용 리포트를 제공해요. 진단 결과는 참고 지표이며, 실제 결정은 본인의 판단을 우선해주세요.',
  },
  {
    q: '추천받은 채용정보는 어디서 나온 건가요?',
    a: '외부 채용 데이터베이스와 연동된 RAG 시스템이 검증된 공고만 골라 추천해요. 연동이 완료되면 채용공고 메뉴에서 실제 데이터로 확인할 수 있어요.',
  },
  {
    q: '회원 탈퇴는 어떻게 하나요?',
    a: '마이페이지 > 개인정보 탭에서 회원 탈퇴를 요청할 수 있어요.',
  },
]

export default function Faq() {
  const [openIndex, setOpenIndex] = useState(0)

  return (
    <section className="space-y-6">
      <div>
        <p className="eyebrow-label">
          <span className="h-1.5 w-1.5 rounded-full bg-coral" aria-hidden="true" />
          FAQ
        </p>
        <h1 className="mt-4 flex items-center gap-2 text-h3 text-ink">
          <Question size={24} weight="bold" aria-hidden="true" />
          자주 묻는 질문
        </h1>
        <p className="mt-3 text-body text-slate">궁금한 내용을 빠르게 확인해보세요.</p>
      </div>

      <div className="space-y-3">
        {faqItems.map((item, index) => {
          const isOpen = openIndex === index
          return (
            <div key={item.q} className="overflow-hidden rounded-card bg-white shadow-1">
              <button
                type="button"
                onClick={() => setOpenIndex(isOpen ? -1 : index)}
                aria-expanded={isOpen}
                className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left sm:px-7"
              >
                <span className="text-body font-semibold text-ink">
                  <span className="mr-2 text-coral">Q.</span>
                  {item.q}
                </span>
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-canvas text-coral-deep">
                  {isOpen ? <Minus size={14} weight="bold" /> : <Plus size={14} weight="bold" />}
                </span>
              </button>

              {isOpen && (
                <div className="animate-fade-up border-t border-ink/10 px-6 py-5 text-[14px] leading-relaxed text-slate sm:px-7">
                  {item.a}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
