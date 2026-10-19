import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Plus, PaperPlaneTilt, SidebarSimple, X } from '@phosphor-icons/react'
import { deleteChatSession, fetchChatSessions, sendChatMessage } from '../../lib/chatApi.js'
import { useAuth } from '../../context/AuthContext.jsx'

// 세션(대화방) 여러 개를 나눠 관리하는 채팅 화면 — 지난번 디자인 캔버스에서 정한
// "Claude/Gemini처럼 세션을 나누고, 왼쪽에 열고 닫을 수 있는 목록"을 실제 컴포넌트로
// 옮긴 버전. AppLayout이 모든 로그인 후 화면에 max-content 폭 + 상하 패딩을 공통으로
// 씌우고 있어서(다른 페이지들과의 일관성을 위해 그 구조는 건드리지 않음), 채팅 영역은
// 그 안에서 카드 하나(rounded-card)가 화면 높이 대부분을 채우는 형태로 구성함.
//
// [변경] 대화 기록 저장 위치: 브라우저 localStorage → Supabase DB(chat_sessions, chat_messages)
// - 화면에 들어오면 로그인한 계정의 대화 목록을 서버에서 불러옴 (계정마다 기록이 분리됨)
// - 다른 기기/브라우저에서 로그인해도 같은 기록이 보임
// - "새 대화"는 첫 메시지를 보낼 때 서버에 대화방이 만들어짐 (그 전엔 화면에만 존재)
//
// [변경] 마이페이지 > 채팅로그 > "대화 보기"에서 /home/chat?session=<id>로 넘어온
// 경우, 해당 세션을 바로 열어서 보여줌. 없거나 존재하지 않는 id면 기존처럼 가장
// 최근 세션(목록 맨 앞)을 보여줌.

function createSession() {
  return {
    id: crypto.randomUUID(), // 화면용 키. 서버에 저장되면 backendSessionId가 채워짐
    backendSessionId: null,
    title: '새 대화',
    createdAt: Date.now(),
    messages: [], // { role: 'user' | 'bot', text, time }
  }
}

// 서버 응답 → 화면에서 쓰는 형태로 변환
function fromServer(s) {
  return {
    id: s.id,
    backendSessionId: s.id,
    title: s.title,
    createdAt: Date.parse(s.created_at),
    messages: s.messages.map((m) => ({
      role: m.role === 'assistant' ? 'bot' : 'user',
      text: m.content,
      time: Date.parse(m.created_at),
    })),
  }
}

function isToday(timestamp) {
  const d = new Date(timestamp)
  const now = new Date()
  return d.toDateString() === now.toDateString()
}

function toErrorText(err) {
  if (err?.message === 'SESSION_EXPIRED') return '로그인이 만료되었어요. 다시 로그인해주세요.'
  return '응답을 받지 못했어요. 서버가 깨어나는 중일 수 있으니 잠시 후 다시 시도해주세요.'
}

export default function Chat() {
  const { user, authFetch } = useAuth()
  const [searchParams] = useSearchParams()
  const [sessions, setSessions] = useState([])
  const [activeId, setActiveId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(() => typeof window === 'undefined' || window.innerWidth >= 768)
  const [error, setError] = useState(null)
  const scrollRef = useRef(null)

  // 로그인한 계정이 바뀔 때마다 그 계정의 대화 기록을 서버에서 불러옴
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    fetchChatSessions(authFetch)
      .then((data) => {
        if (cancelled) return
        const loaded = data.map(fromServer)
        const list = loaded.length > 0 ? loaded : [createSession()]
        setSessions(list)
        // 마이페이지 채팅로그의 "대화 보기"(?session=<id>)로 들어온 경우 그 세션을
        // 바로 열고, 없거나 유효하지 않으면 기존처럼 가장 최근 세션을 보여줌.
        const requestedId = searchParams.get('session')
        const requested = requestedId && list.find((s) => s.id === requestedId)
        setActiveId(requested ? requested.id : list[0].id)
      })
      .catch((err) => {
        if (cancelled) return
        const fresh = createSession()
        setSessions([fresh])
        setActiveId(fresh.id)
        setError(
          err?.message === 'SESSION_EXPIRED'
            ? toErrorText(err)
            : '대화 기록을 불러오지 못했어요. 잠시 후 새로고침해주세요.',
        )
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [user?.id, authFetch])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [sessions, activeId])

  // Chat 화면이 이미 열려 있는 상태에서 다른 session 쿼리로 다시 이동해온 경우
  // (예: 마이페이지에서 다른 대화의 "대화 보기"를 또 눌렀을 때)에도 대응.
  useEffect(() => {
    const requestedId = searchParams.get('session')
    if (requestedId && sessions.some((s) => s.id === requestedId)) {
      setActiveId(requestedId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

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
    // 아직 아무 말도 안 한 빈 새 대화가 있으면 그걸 재사용 (빈 대화가 쌓이지 않게)
    const emptyDraft = sessions.find((s) => !s.backendSessionId && s.messages.length === 0)
    if (emptyDraft) {
      setActiveId(emptyDraft.id)
    } else {
      const next = createSession()
      setSessions((prev) => [next, ...prev])
      setActiveId(next.id)
    }
    setDraft('')
    setError(null)
  }

  // 대화 목록에서 세션 하나를 삭제 (서버에 저장된 대화면 DB에서도 삭제).
  // 지우는 세션이 지금 보고 있던 세션이면 남은 것 중 맨 위 세션으로 이동하고,
  // 하나도 안 남으면 새 대화를 하나 만들어서 화면이 비지 않게 함.
  function handleDeleteSession(id) {
    const target = sessions.find((s) => s.id === id)
    setSessions((prev) => {
      const remaining = prev.filter((s) => s.id !== id)
      const next = remaining.length > 0 ? remaining : [createSession()]
      if (id === activeId) {
        setActiveId(next[0].id)
      }
      return next
    })
    if (target?.backendSessionId) {
      deleteChatSession(authFetch, target.backendSessionId).catch(() => {
        setError('대화를 삭제하지 못했어요. 새로고침 후 다시 시도해주세요.')
      })
    }
  }

  async function handleSend() {
    const text = draft.trim()
    if (!text || sending || !activeSession) return

    const targetId = activeSession.id
    const isFirstMessage = activeSession.messages.length === 0
    const userMessage = { role: 'user', text, time: Date.now() }

    setSessions((prev) =>
      prev.map((s) =>
        s.id === targetId
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
      const data = await sendChatMessage(authFetch, {
        message: text,
        sessionId: activeSession.backendSessionId,
      })
      setSessions((prev) =>
        prev.map((s) =>
          s.id === targetId
            ? {
                ...s,
                backendSessionId: data.session_id,
                messages: [...s.messages, { role: 'bot', text: data.reply, time: Date.now() }],
              }
            : s,
        ),
      )
    } catch (err) {
      // 실패하면 방금 보낸 말풍선을 되돌리고 입력창에 다시 넣어줌 (다시 보내기 쉽게)
      setSessions((prev) =>
        prev.map((s) =>
          s.id === targetId
            ? {
                ...s,
                title: isFirstMessage ? '새 대화' : s.title,
                messages: s.messages.filter((m) => m !== userMessage),
              }
            : s,
        ),
      )
      setDraft(text)
      setError(toErrorText(err))
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
          {loading && <p className="text-[14px] leading-relaxed text-slate">대화 기록을 불러오는 중…</p>}
          {!loading && activeSession?.messages.length === 0 && (
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
              disabled={sending || loading || !draft.trim()}
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
