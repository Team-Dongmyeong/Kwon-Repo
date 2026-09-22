const points = [
  {
    lead: '체크리스트 대신, 대화예요.',
    body: '정형화된 문항에 답하는 심리 검사와 달리, 편하게 이야기를 나누는 것만으로 지금의 감정과 고민이 자연스럽게 드러나요.',
  },
  {
    lead: '한 번의 대화가 두 가지 결과로 이어져요.',
    body: '따로따로 찾아봐야 했던 심리 케어와 채용정보를, 하나의 대화 흐름 안에서 함께 짚어드려요.',
  },
  {
    lead: '위로가 아니라, 근거를 드려요.',
    body: 'RAG 기반으로 실제 채용 데이터에 근거한 정보만 골라, 막연한 불안 대신 확인 가능한 다음 걸음을 제안해요.',
  },
]

export default function TrustSection() {
  return (
    <section className="bg-canvas py-16 sm:py-24 lg:py-[128px]">
      <div className="mx-auto max-w-content px-4 sm:px-6">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
          <div>
            <p className="eyebrow-label">
              <span className="h-1.5 w-1.5 rounded-full bg-coral" aria-hidden="true" />
              왜 마음잇기인가
            </p>
            <h2 className="mt-4 text-h2 text-ink sm:text-h2-md">
              설문이 아니라,
              <br />
              대화로 시작하는 진단이에요
            </h2>
            <p className="mt-6 max-w-[40ch] text-body-lg text-slate">
              구직 스트레스는 숫자로 요약되지 않아요. 마음잇기는 결과표 한 장 대신, 끝까지 들어주는
              대화를 먼저 건넵니다.
            </p>
          </div>

          <div className="flex flex-col gap-12 sm:gap-14 lg:pt-2">
            {points.map(({ lead, body }, i) => (
              <div key={lead} className="flex gap-5 sm:gap-6">
                <span className="mt-1 shrink-0 text-eyebrow text-coral-deep">{`0${i + 1}`}</span>
                <div>
                  <p className="text-h3 text-ink">{lead}</p>
                  <p className="mt-2 max-w-[52ch] text-body text-slate">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
