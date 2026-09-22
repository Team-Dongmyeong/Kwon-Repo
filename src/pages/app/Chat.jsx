import { useEffect, useMemo, useRef, useState } from 'react'
import { Plus, PaperPlaneTilt, SidebarSimple, X } from '@phosphor-icons/react'
import { sendChatMessage } from '../../lib/chatApi.js'

// 세션(대화방) 여러 개를 나눠 관리하는 채팅 화면 — 지난번 디자인 캔버스에서 정한
// "Claude/Gemini처럼 세션을 나누고, 왼쪽에 열고 닫을 수 있는 목록"을 실제 컴포넌트로
// 옮긴 버전. AppLayout이 모든 로그인 후 화면에 max-content 폭 + 상하 패딩을 공통으로
// 씌우고 있어서(다른 페이지들과의 일관성을 위해 그 구조는 건드리지 않음), 채팅 영역은
// 그 안에서 카드 하나(rounded-card)가 화면 높이 대부분을 채우는 형태로 구성함 —
// 캔버스 시안처럼 완전히 풀블리드는 아니지만, 사이드바·말풍선 구조와 화이트/coral
// 톤은 그대로 가져옴.
//
// 감정/키워드 태그(캔버스 시안에 있던 "#백엔드" 같은 칩)는 아직 백엔드가 실제로
// 분석해서 내려주는 데이터가 아니라서(그 부분은 kcELECTRA/SBERT 서빙 붙는 다음
// 단계 몫) 여기서는 뺐음 — 지금 있는 진짜 데이터(제목, 메시지)만으로 구성.
//
// 세션 목록/대화 내용은 지금 단계(Supabase 붙기 전)엔 로컬 브라우저에만
// localStorage로 저장됨 — 새로고침해도 유지되지만, 다른 기기·다른 브라우저와는
// 공유되지 않음.

const STORAGE_KEY = 'maeum:chat-sessions'

function createSession() {
  return {
    id: crypto.randomUUID(), // 프론트 로컬 키. 백엔드 session_id는 첫 응답 이후 별도로 저장.
    backendSessionId: null,
    title: '새 대화',
    createdAt: Date.now(),
    messages: [], // { role: 'user' | 'bot', text, time }
  }
}

function isToday(timestamp) {
  const d = new Date(timestamp)
  const now = new Date()
  return d.toDateString() === now.toDateString()
}

function loadInitialSessions() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : null
    if (Array.isArray(parsed) && parsed.length > 0) return parsed
  } catch {
    // 저장된 값이 깨져 있으면 그냥 새로 시작
  }
  return [createSession()]
}

export default function Chat() {
  const [sessions, setSessions] = useState(loadInitialSessions)
  const [activeId, setActiveId] = useState(() => loadInitialSessions()[0]?.id)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(() => typeof window === 'undefined' || window.innerWidth >= 768)
  const [error, setError] = useState(null)
  const scrollRef = useRef(null)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions))
    } catch {
      // 저장 실패해도(용량 초과 등) 대화 자체는 계속 진행
    }
  }, [sessions])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [sessions, activeId])

  const activeSession = sessions.find((s) => s.id === activeId) ?? sessions[0]

  const groupedSessions = useMemo(() => {
    const sorted = [...sessions].sort((a, b) => b.createdAt - a.createdAt)
    const today = sorted.filter((s) => isToday(s.createdAt))
    const earlier = sorted.filter((s) => !isToday(s.createdAt))
    return [
      { label: '오늘', items: today },
      { label: '지난 대화', items: earlier },
    ].filter((g) => g.items.length > 0)
  }, [sessions])

  function handleNewSession() {
    const next = createSession()
    setSessions((prev) => [next, ...prev])
    setActiveId(next.id)
    setDraft('')
    setError(null)
  }

  // 대화 목록에서 세션 하나를 삭제. 지우는 세션이 지금 보고 있던 세션이면
  // 남은 것 중 맨 위(가장 최근) 세션으로 자동 이동하고, 하나도 안 남으면
  // 새 대화를 하나 만들어서 화면이 비지 않게 함.
  function handleDeleteSession(id) {
    setSessions((prev) => {
      const remaining = prev.filter((s) => s.id !== id)
      const next = remaining.length > 0 ? remaining : [createSession()]
      if (id === activeId) {
        setActiveId(next[0].id)
      }
      return next
    })
  }

  async function handleSend() {
    const text = draft.trim()
    if (!text || sending || !activeSession) return

    const isFirstMessage = activeSession.messages.length === 0
    const userMessage = { role: 'user', text, time: Date.now() }

    setSessions((prev) =>
      prev.map((s) =>
        s.id === activeSession.id
          ? {
              ...s,
              title: isFirstMessage ? text.slice(0, 22) + (text.length > 22 ? '…' : '') : s.title,
              messages: [...s.messages, userMessage],
            }
          : s,
      ),
    )
    setDraft('')
    setSending(true)
    setError(null)

    try {
      const data = await sendChatMessage({ message: text, sessionId: activeSession.backendSessionId })
      setSessions((prev) =>
        prev.map((s) =>
          s.id === activeSession.id
            ? {
                ...s,
                backendSessionId: data.session_id,
                messages: [...s.messages, { role: 'bot', text: data.reply, time: Date.now() }],
              }
            : s,
        ),
      )
    } catch {
      setError('백엔드 서버에 연결하지 못했어요. 로컬에서 FastAPI 서버(uvicorn)가 켜져 있는지 확인해주세요.')
    } finally {
      setSending(false)
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <section className="flex h-[calc(100dvh-180px)] min-h-[560px] overflow-hidden rounded-card bg-white shadow-1">
      {/* 사이드바 — 세션 목록 */}
      <aside
        className={`flex flex-shrink-0 flex-col border-r border-ink/8 bg-canvas-lift transition-[width] duration-150 ${
          sidebarOpen ? 'w-64' : 'w-16 items-center'
        }`}
      >
        <div className="flex flex-shrink-0 items-center gap-2 p-3">
          <button
            type="button"
            onClick={() => setSidebarOpen((v) => !v)}
            aria-label="사이드바 열기/닫기"
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-btn text-ink transition-colors hover:bg-white"
          >
            <SidebarSimple size={18} weight="bold" aria-hidden="true" />
          </button>
          {sidebarOpen && <span className="text-[13px] font-bold text-ink-soft">대화 목록</span>}
        </div>

        <div className="flex-shrink-0 px-3 pb-3">
          <button
            type="button"
            onClick={handleNewSession}
            aria-label="새 대화 시작하기"
            className={`inline-flex min-h-[40px] items-center justify-center gap-2 rounded-btn bg-ink text-[13px] font-semibold text-canvas transition-transform duration-150 ease-out hover:-translate-y-0.5 hover:bg-ink-2 active:translate-y-0 ${
              sidebarOpen ? 'w-full px-4' : 'w-9 px-0'
            }`}
          >
            <Plus size={16} weight="bold" aria-hidden="true" />
            {sidebarOpen && '새 대화 시작하기'}
          </button>
        </div>

        {sidebarOpen && (
          <nav className="min-h-0 flex-1 overflow-y-auto px-2.5 pb-3">
            {groupedSessions.map((group) => (
              <div key={group.label} className="mb-1">
                <p className="px-2.5 pb-1.5 pt-3 text-[11px] font-bold uppercase tracking-wide text-slate">
                  {group.label}
                </p>
                {group.items.map((s) => {
                  const isActive = s.id === activeSession?.id
                  return (
                    <div key={s.id} className="group relative">
                      <button
                        type="button"
                        onClick={() => setActiveId(s.id)}
                        className={`block w-full truncate rounded-btn py-2.5 pl-3 pr-8 text-left text-[14px] font-semibold transition-colors ${
                          isActive ? 'bg-coral text-white' : 'text-ink hover:bg-white'
                        }`}
                      >
                        {s.title}
                      </button>
                      {/* 삭제(X) 버튼 — 평소엔 숨겨져 있다가 이 세션 항목에 마우스를
                          올리면(group-hover) 나타남. 클릭해도 위 select 버튼의
                          onClick(대화 전환)이 같이 실행되지 않도록 stopPropagation. */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeleteSession(s.id)
                        }}
                        aria-label={`"${s.title}" 대화 삭제`}
                        className={`absolute right-1.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-btn opacity-0 transition-opacity group-hover:opacity-100 ${
                          isActive ? 'text-white hover:bg-white/20' : 'text-slate hover:bg-bone hover:text-ink'
                        }`}
                      >
                        <X size={13} weight="bold" aria-hidden="true" />
                      </button>
                    </div>
                  )
                })}
              </div>
            ))}
          </nav>
        )}
      </aside>

      {/* 메인 대화 영역 */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-shrink-0 items-center border-b border-ink/8 px-6 py-4">
          <h1 className="truncate text-[16px] font-bold text-ink">{activeSession?.title ?? '대화'}</h1>
        </div>

        <div ref={scrollRef} className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 py-6">
          {activeSession?.messages.length === 0 && (
            <p className="text-[14px] leading-relaxed text-slate">
              마음잇기에게 편하게 이야기를 시작해보세요. 취업 준비 중 고민이나 감정을 나눠주시면 함께 이야기
              나눠볼게요.
            </p>
          )}
          {activeSession?.messages.map((m, i) => (
            <div key={i} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
              <div
                className={`max-w-[560px] whitespace-pre-line rounded-btn px-4 py-3 text-[15px] leading-relaxed ${
                  m.role === 'user' ? 'rounded-br-[4px] bg-ink text-canvas' : 'rounded-bl-[4px] bg-bone text-ink'
                }`}
              >
                {m.text}
              </div>
            </div>
          ))}
          {sending && (
            <div className="flex items-start">
              <div className="rounded-btn rounded-bl-[4px] bg-bone px-4 py-3 text-[14px] text-slate">
                생각하는 중…
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="mx-6 mb-2 flex-shrink-0 rounded-btn bg-coral-bg px-4 py-2.5 text-[13px] font-medium text-coral-deep">
            {error}
          </div>
        )}

        <div className="flex-shrink-0 px-6 pb-6 pt-2">
          <div className="flex items-end gap-2 rounded-btn border-[1.5px] border-ink/12 bg-white px-4 py-2 shadow-1">
            <textarea
              rows={1}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="마음잇기에게 편하게 이야기해보세요"
              className="max-h-[120px] flex-1 resize-none border-none bg-transparent py-2 text-[15px] text-ink outline-none placeholder:text-slate"
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={sending || !draft.trim()}
              aria-label="전송"
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-pill bg-coral text-white transition-transform duration-150 ease-out hover:-translate-y-0.5 active:translate-y-0 disabled:pointer-events-none disabled:opacity-40"
            >
              <PaperPlaneTilt size={16} weight="bold" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
