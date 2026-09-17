import { useEffect, useRef, useState } from 'react'
import { useApp } from '../../store/appContext'
import { useData } from '../../lib/useData'
import { listFocusSessions, listTopics, saveFocusSession } from '../../lib/data'
import { fmtDuration, fmtDurationShort, fmtTime, startOfDay } from '../../lib/format'
import { genId } from '../../lib/idb'
import type { FocusSession } from '../../lib/types'

const PRESETS = [15, 25, 45, 60, 90]

export function FocusPage() {
  const { account, bumpData } = useApp()
  const { data } = useData(async () => {
    const [topics, sessions] = await Promise.all([
      listTopics(account!.id),
      listFocusSessions(account!.id),
    ])
    return { topics, sessions }
  }, [account?.id])

  const [targetMin, setTargetMin] = useState(25)
  const [phase, setPhase] = useState<'idle' | 'running' | 'paused'>('idle')
  const [elapsedSec, setElapsedSec] = useState(0)
  const [selectedTopics, setSelectedTopics] = useState<string[]>([])
  const [note, setNote] = useState('')
  const [doneMsg, setDoneMsg] = useState('')
  const startAtRef = useRef(0)

  useEffect(() => {
    if (phase !== 'running') return
    if (!startAtRef.current) startAtRef.current = Date.now()
    const t = setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - startAtRef.current) / 1000))
    }, 500)
    return () => clearInterval(t)
  }, [phase])

  if (!account) return null
  if (!data) {
    return (
      <div className="container page">
        <div className="muted">加载中…</div>
      </div>
    )
  }

  const todayStart = startOfDay(Date.now())
  const todaySessions = data.sessions.filter((s) => s.startedAt >= todayStart)
  const todaySec = todaySessions.reduce((a, s) => a + s.durationSec, 0)
  const targetReached = targetMin > 0 && elapsedSec >= targetMin * 60

  const start = () => {
    setDoneMsg('')
    startAtRef.current = Date.now() - elapsedSec * 1000
    setPhase('running')
  }
  const pause = () => setPhase('paused')
  const resume = () => {
    startAtRef.current = Date.now() - elapsedSec * 1000
    setPhase('running')
  }
  const reset = () => {
    setPhase('idle')
    setElapsedSec(0)
    startAtRef.current = 0
    setDoneMsg('')
  }

  const finish = async () => {
    const sec = elapsedSec
    if (sec <= 0) {
      setPhase('idle')
      return
    }
    const now = Date.now()
    const session: FocusSession = {
      id: genId(),
      accountId: account.id,
      startedAt: now - sec * 1000,
      endedAt: now,
      durationSec: sec,
      topicIds: selectedTopics,
      note: note.trim(),
    }
    await saveFocusSession(session)
    setPhase('idle')
    setElapsedSec(0)
    startAtRef.current = 0
    setSelectedTopics([])
    setNote('')
    setDoneMsg(`已记录 ${fmtDuration(sec)} 专注，好样的！`)
    bumpData()
  }

  const toggleTopic = (id: string) => {
    setSelectedTopics((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  return (
    <div className="container page">
      <div className="page-head">
        <div>
          <div className="page-title">专注时钟</div>
          <div className="page-sub">一键开始专注，结束自动汇总到学习日报</div>
        </div>
      </div>

      <div className="focus-wrap">
        <div className="stat-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <div className="stat">
            <div className="stat-num">{fmtDuration(todaySec)}</div>
            <div className="stat-label">今日累计专注</div>
          </div>
          <div className="stat">
            <div className="stat-num">{todaySessions.length}</div>
            <div className="stat-label">今日专注场次</div>
          </div>
        </div>

        <div className={`timer-ring${phase === 'running' ? ' active' : ''}${targetReached ? ' done' : ''}`}>
          <div>
            <div className="timer-num">{fmtDurationShort(elapsedSec)}</div>
            <div className="timer-label">
              {phase === 'running'
                ? targetReached
                  ? '目标达成 🎉'
                  : '专注中…'
                : phase === 'paused'
                  ? '已暂停'
                  : '准备开始'}
            </div>
          </div>
        </div>

        <div>
          <div className="label" style={{ textAlign: 'center' }}>
            目标时长
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
            {PRESETS.map((m) => (
              <button
                key={m}
                className={`chip${targetMin === m ? ' active' : ''}`}
                onClick={() => setTargetMin(m)}
                disabled={phase !== 'idle'}
              >
                {m} 分钟
              </button>
            ))}
          </div>
        </div>

        <div className="focus-actions">
          {phase === 'idle' && (
            <button className="btn btn-primary" onClick={start}>
              ▶ 开始专注
            </button>
          )}
          {phase === 'running' && (
            <>
              <button className="btn" onClick={pause}>
                ⏸ 暂停
              </button>
              <button className="btn btn-primary" onClick={() => void finish()}>
                ⏹ 结束并记录
              </button>
            </>
          )}
          {phase === 'paused' && (
            <>
              <button className="btn btn-primary" onClick={resume}>
                ▶ 继续
              </button>
              <button className="btn" onClick={() => void finish()}>
                ⏹ 结束并记录
              </button>
              <button className="btn btn-ghost" onClick={reset}>
                重置
              </button>
            </>
          )}
        </div>

        {doneMsg && <div className="ok-text" style={{ marginTop: 14 }}>{doneMsg}</div>}

        <div className="card focus-select">
          <div className="card-title" style={{ fontSize: 15 }}>
            关联知识点（可选）
          </div>
          {data.topics.length === 0 ? (
            <div className="muted" style={{ fontSize: 13 }}>还没有知识点，可稍后在知识库添加。</div>
          ) : (
            <div className="topic-picker">
              {data.topics.map((t) => (
                <button
                  key={t.id}
                  className={`chip${selectedTopics.includes(t.id) ? ' active' : ''}`}
                  onClick={() => toggleTopic(t.id)}
                >
                  {t.title}
                </button>
              ))}
            </div>
          )}
          <div className="field" style={{ marginTop: 12, marginBottom: 0 }}>
            <input
              className="input"
              placeholder="本场专注的小结（可选）"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </div>

        <div className="card" style={{ textAlign: 'left', marginTop: 16 }}>
          <div className="card-title" style={{ fontSize: 15 }}>
            今日专注记录
          </div>
          {todaySessions.length === 0 ? (
            <div className="muted" style={{ fontSize: 13 }}>今天还没有专注记录。</div>
          ) : (
            todaySessions.map((s) => (
              <div key={s.id} className="list-item" style={{ cursor: 'default' }}>
                <div className="list-item-main">
                  <div className="list-item-title">{fmtDuration(s.durationSec)}</div>
                  <div className="list-item-sub">
                    {fmtTime(s.startedAt)} - {fmtTime(s.endedAt)}
                    {s.note ? ` · ${s.note}` : ''}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
