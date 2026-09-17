import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useApp } from '../../store/appContext'
import { useData } from '../../lib/useData'
import {
  appendMessage,
  createChat,
  deleteChat,
  getChat,
  getTopic,
  listChats,
  listMessages,
  touchChat,
} from '../../lib/data'
import { streamChat, type ChatTurn } from '../../lib/ai'
import { NORMAL_SYSTEM_PROMPT, SOCRATIC_SYSTEM_PROMPT } from '../../lib/prompts'
import { Markdown } from '../../lib/markdown'
import { genId } from '../../lib/idb'
import { fmtTime } from '../../lib/format'
import type { ChatMessage, ChatSession } from '../../lib/types'

function buildSystemPrompt(mode: ChatSession['mode'], custom: string, context?: string): string {
  if (custom.trim()) return custom
  if (mode === 'socratic') {
    return context ? `${SOCRATIC_SYSTEM_PROMPT}\n\n${context}` : SOCRATIC_SYSTEM_PROMPT
  }
  return NORMAL_SYSTEM_PROMPT
}

export function ChatPage() {
  const { account, settings, bumpData } = useApp()
  const location = useLocation()
  const navigate = useNavigate()

  const { data: chats } = useData(() => listChats(account!.id), [account?.id])
  const [currentId, setCurrentId] = useState<string | null>(null)
  const { data: messages } = useData(
    () => (currentId ? listMessages(currentId) : Promise.resolve<ChatMessage[]>([])),
    [currentId],
  )

  const [newMode, setNewMode] = useState<ChatSession['mode']>('socratic')
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [streamText, setStreamText] = useState('')
  const [error, setError] = useState('')
  const bodyRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  // 自动选中第一个会话
  useEffect(() => {
    if (chats && chats.length > 0 && !currentId) setCurrentId(chats[0].id)
  }, [chats, currentId])

  // 从知识点「为什么？」进入：新建苏格拉底会话
  useEffect(() => {
    const state = location.state as { topicId?: string } | null
    if (state?.topicId) {
      navigate('.', { replace: true, state: {} })
      void (async () => {
        const t = await getTopic(state.topicId!)
        if (!t || !account) return
        const ctx = `当前要探讨的知识点是「${t.title}」。引子：${t.intro || '（无）'}。答案要点：${t.answer || '（无）'}。请围绕它用苏格拉底式提问引导我理解，不要直接给出答案。`
        const c = await createChat(account.id, 'socratic', t.title, ctx)
        setCurrentId(c.id)
        bumpData()
      })()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state])

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight })
  }, [messages, streamText, streaming])

  if (!account) return null

  const currentChat = chats?.find((c) => c.id === currentId) ?? null

  const startNew = async () => {
    const c = await createChat(account.id, newMode, '新对话')
    setCurrentId(c.id)
    setStreamText('')
    setError('')
    bumpData()
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('删除这个会话？')) return
    await deleteChat(id)
    if (currentId === id) setCurrentId(null)
    bumpData()
  }

  const send = async () => {
    const text = input.trim()
    if (!text || streaming) return
    setInput('')
    setError('')

    let chatId = currentId
    if (!chatId) {
      const c = await createChat(account.id, newMode, text.slice(0, 20))
      chatId = c.id
      setCurrentId(c.id)
      bumpData()
    }

    const chat = await getChat(chatId)
    const userMsg: ChatMessage = {
      id: genId(),
      sessionId: chatId,
      accountId: account.id,
      role: 'user',
      content: text,
      createdAt: Date.now(),
    }
    await appendMessage(userMsg)
    if (chat && chat.title === '新对话') await touchChat(chat, text.slice(0, 20))

    const hist = await listMessages(chatId)
    const turns: ChatTurn[] = hist.map((m) => ({ role: m.role, content: m.content }))
    const system = buildSystemPrompt(chat?.mode ?? newMode, settings.systemPrompt, chat?.context)
    const payload: ChatTurn[] = [{ role: 'system', content: system }, ...turns]

    const controller = new AbortController()
    abortRef.current = controller
    setStreaming(true)
    setStreamText('')
    let acc = ''
    try {
      await streamChat(
        { baseUrl: settings.llmBaseUrl, apiKey: settings.llmApiKey, model: settings.llmModel },
        payload,
        (delta) => {
          acc += delta
          setStreamText(acc)
        },
        controller.signal,
      )
      if (acc) {
        await appendMessage({
          id: genId(),
          sessionId: chatId,
          accountId: account.id,
          role: 'assistant',
          content: acc,
          createdAt: Date.now(),
        })
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if ((e as Error).name !== 'AbortError') setError(msg)
    } finally {
      setStreaming(false)
      setStreamText('')
      abortRef.current = null
      bumpData()
    }
  }

  const stop = () => abortRef.current?.abort()

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void send()
    }
  }

  const aiReady = Boolean(settings.llmBaseUrl && settings.llmApiKey)

  return (
    <div className="container page">
      <div className="page-head">
        <div>
          <div className="page-title">AI 问答</div>
          <div className="page-sub">多轮对话 · 苏格拉底式启发教学</div>
        </div>
        {!aiReady && (
          <button className="btn" onClick={() => navigate('/settings')}>
            ⚙️ 先配置 AI
          </button>
        )}
      </div>

      <div className="chat-layout">
        <aside className="chat-side">
          <div className="chat-side-head">
            <div className="card-title" style={{ margin: 0, fontSize: 15 }}>
              会话
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => void startNew()}>
              ＋ 新对话
            </button>
          </div>

          <div style={{ padding: '8px 12px' }}>
            <div className="label" style={{ marginBottom: 4 }}>
              新对话模式
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                className={`chip${newMode === 'socratic' ? ' active' : ''}`}
                onClick={() => setNewMode('socratic')}
              >
                🧭 苏格拉底
              </button>
              <button
                className={`chip${newMode === 'normal' ? ' active' : ''}`}
                onClick={() => setNewMode('normal')}
              >
                💬 直接问答
              </button>
            </div>
          </div>

          <div className="chat-list">
            {(!chats || chats.length === 0) && <div className="muted" style={{ padding: 12, fontSize: 13 }}>还没有会话</div>}
            {chats?.map((c) => (
              <div key={c.id} className={`chat-item${c.id === currentId ? ' active' : ''}`}>
                <div className="chat-item-title" onClick={() => setCurrentId(c.id)}>
                  {c.title}
                </div>
                <button className="chat-del" onClick={() => void handleDelete(c.id)}>
                  ✕
                </button>
              </div>
            ))}
          </div>
        </aside>

        <section className="chat-window">
          <div className="chat-mobile-bar">
            <div className="mb-row">
              <button className="btn btn-primary btn-sm" onClick={() => void startNew()}>
                ＋ 新对话
              </button>
              <button
                className={`chip${newMode === 'socratic' ? ' active' : ''}`}
                onClick={() => setNewMode('socratic')}
              >
                🧭 苏格拉底
              </button>
              <button
                className={`chip${newMode === 'normal' ? ' active' : ''}`}
                onClick={() => setNewMode('normal')}
              >
                💬 直接问答
              </button>
            </div>
            {chats && chats.length > 0 && (
              <div className="mb-sessions">
                {chats.map((c) => (
                  <div key={c.id} className={`mb-session${c.id === currentId ? ' active' : ''}`}>
                    <span onClick={() => setCurrentId(c.id)}>{c.title}</span>
                    <span className="x" onClick={() => void handleDelete(c.id)}>
                      ✕
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="chat-win-head">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="tag tag-seal">{currentChat?.mode === 'normal' ? '💬 直接问答' : '🧭 苏格拉底'}</span>
              <span className="muted" style={{ fontSize: 14 }}>
                {currentChat?.title ?? '新对话'}
              </span>
            </div>
          </div>

          <div className="chat-body" ref={bodyRef}>
            {(messages?.length ?? 0) === 0 && !streaming && (
              <div className="chat-empty">
                <div className="emoji" style={{ fontSize: 40 }}>
                  💬
                </div>
                {aiReady ? (
                  <div>
                    {newMode === 'socratic' ? '向我提问吧，我会一步步引导你思考。' : '有问题直接问我，我会拆解讲清楚。'}
                  </div>
                ) : (
                  <div>
                    请先在「设置 → AI 配置」填写你的 AI 接口地址与密钥。
                    <button className="btn btn-primary btn-sm" style={{ marginTop: 10 }} onClick={() => navigate('/settings')}>
                      去配置
                    </button>
                  </div>
                )}
              </div>
            )}

            {messages?.map((m) => (
              <div key={m.id} className={`msg ${m.role}`}>
                <div className="msg-bubble">
                  <Markdown text={m.content} />
                </div>
                <div className="msg-meta">{fmtTime(m.createdAt)}</div>
              </div>
            ))}

            {streaming && (
              <div className="msg assistant">
                <div className="msg-bubble">
                  {streamText ? <Markdown text={streamText} /> : (
                    <span className="typing">
                      <span />
                      <span />
                      <span />
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {error && <div className="muted" style={{ padding: '0 16px 8px', color: 'var(--seal-deep)', fontSize: 13 }}>{error}</div>}

          <div className="chat-input-bar">
            <textarea
              className="textarea"
              placeholder={aiReady ? '输入消息，Enter 发送，Shift+Enter 换行…' : '请先配置 AI'}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              disabled={!aiReady}
              rows={1}
            />
            {streaming ? (
              <button className="btn btn-danger" onClick={stop}>
                停止
              </button>
            ) : (
              <button className="btn btn-primary" onClick={() => void send()} disabled={!input.trim() || !aiReady}>
                发送
              </button>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
