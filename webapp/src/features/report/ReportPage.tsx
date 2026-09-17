import { useState } from 'react'
import { useApp } from '../../store/appContext'
import { useData } from '../../lib/useData'
import { listFocusSessions, listReviewLogs, listTopics } from '../../lib/data'
import { dayKey, fmtDate, fmtDuration, fmtTime, startOfDay, todayKey } from '../../lib/format'
import type { Rating } from '../../lib/types'

const DAY_MS = 86400000

const RATING_LABEL: Record<Rating, string> = { 1: '忘了', 2: '困难', 3: '良好', 4: '简单' }
const RATING_EMOJI: Record<Rating, string> = { 1: '😵', 2: '😅', 3: '🙂', 4: '😎' }

export function ReportPage() {
  const { account } = useApp()
  const [dayTs, setDayTs] = useState(() => startOfDay(Date.now()))

  const { data } = useData(async () => {
    const [topics, sessions, logs] = await Promise.all([
      listTopics(account!.id),
      listFocusSessions(account!.id),
      listReviewLogs(account!.id),
    ])
    return { topics, sessions, logs }
  }, [account?.id])

  if (!account) return null
  if (!data) {
    return (
      <div className="container page">
        <div className="muted">加载中…</div>
      </div>
    )
  }

  const dayStart = dayTs
  const dayEnd = dayTs + DAY_MS

  const daySessions = data.sessions.filter((s) => s.startedAt >= dayStart && s.startedAt < dayEnd)
  const dayFocusSec = daySessions.reduce((a, s) => a + s.durationSec, 0)
  const dayNew = data.topics.filter((t) => t.createdAt >= dayStart && t.createdAt < dayEnd)
  const dayLogs = data.logs.filter((l) => l.reviewedAt >= dayStart && l.reviewedAt < dayEnd)

  const topicTitle = (id: string) => data.topics.find((t) => t.id === id)?.title ?? '（已删除）'

  const isToday = dayKey(dayTs) === todayKey()

  return (
    <div className="container page">
      <div className="page-head">
        <div>
          <div className="page-title">学习日报</div>
          <div className="page-sub">学了多久、学了什么，一目了然</div>
        </div>
      </div>

      <div className="report-day-nav">
        <button className="btn btn-ghost" onClick={() => setDayTs((d) => d - DAY_MS)}>
          ‹ 前一天
        </button>
        <div className="report-day">
          {fmtDate(dayTs)}
          {isToday && <span className="tag tag-seal" style={{ marginLeft: 8 }}>今天</span>}
        </div>
        <button
          className="btn btn-ghost"
          onClick={() => setDayTs((d) => d + DAY_MS)}
          disabled={dayTs + DAY_MS > Date.now()}
        >
          后一天 ›
        </button>
        {!isToday && (
          <button className="btn" onClick={() => setDayTs(startOfDay(Date.now()))}>
            回到今天
          </button>
        )}
      </div>

      <div className="stat-grid">
        <div className="stat">
          <div className="stat-num">{fmtDuration(dayFocusSec)}</div>
          <div className="stat-label">专注时长</div>
        </div>
        <div className="stat">
          <div className="stat-num">{daySessions.length}</div>
          <div className="stat-label">专注场次</div>
        </div>
        <div className="stat">
          <div className="stat-num">{dayNew.length}</div>
          <div className="stat-label">新增知识点</div>
        </div>
        <div className="stat">
          <div className="stat-num">{dayLogs.length}</div>
          <div className="stat-label">复习次数</div>
        </div>
      </div>

      {daySessions.length === 0 && dayNew.length === 0 && dayLogs.length === 0 ? (
        <div className="empty">
          <div className="emoji">🍃</div>
          <div className="empty-title">这一天还没有学习记录</div>
          <div className="empty-sub">去专注、记知识点或复习，都会沉淀到这里。</div>
        </div>
      ) : (
        <div className="grid-2">
          {daySessions.length > 0 && (
            <div className="card report-block">
              <div className="report-block-title">⏱ 专注记录</div>
              {daySessions.map((s) => (
                <div key={s.id} className="bar-row">
                  <span className="bar-label">{fmtTime(s.startedAt)}</span>
                  <div className="bar-track">
                    <div
                      className="bar-fill"
                      style={{ width: `${Math.min(100, (s.durationSec / Math.max(3600, dayFocusSec)) * 100)}%` }}
                    />
                  </div>
                  <span className="bar-val">{fmtDuration(s.durationSec)}</span>
                </div>
              ))}
            </div>
          )}

          {dayNew.length > 0 && (
            <div className="card report-block">
              <div className="report-block-title">📚 新增知识点</div>
              {dayNew.map((t) => (
                <div key={t.id} className="list-item" style={{ cursor: 'default', padding: 10 }}>
                  <div className="list-item-title" style={{ fontSize: 14 }}>{t.title}</div>
                </div>
              ))}
            </div>
          )}

          {dayLogs.length > 0 && (
            <div className="card report-block">
              <div className="report-block-title">🎯 复习记录</div>
              {dayLogs.map((l) => (
                <div key={l.id} className="list-item" style={{ cursor: 'default', padding: 10 }}>
                  <div className="list-item-main">
                    <div className="list-item-title" style={{ fontSize: 14 }}>{topicTitle(l.topicId)}</div>
                    <div className="list-item-sub">{fmtTime(l.reviewedAt)}</div>
                  </div>
                  <span className="tag">
                    {RATING_EMOJI[l.rating]} {RATING_LABEL[l.rating]}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
