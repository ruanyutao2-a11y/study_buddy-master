import { useNavigate } from 'react-router-dom'
import { useApp } from '../../store/appContext'
import { useData } from '../../lib/useData'
import { dueTopics, listFocusSessions, listReviewLogs, listTopics } from '../../lib/data'
import { fmtDate, fmtDuration, relativeDue, startOfDay } from '../../lib/format'
import { BRAND } from '../../lib/brand'

export function DashboardPage() {
  const { account } = useApp()
  const navigate = useNavigate()

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

  const due = dueTopics(data.topics)
  const todayStart = startOfDay(Date.now())
  const todayFocusSec = data.sessions
    .filter((s) => s.startedAt >= todayStart)
    .reduce((a, s) => a + s.durationSec, 0)
  const todayReviewed = data.logs.filter((l) => l.reviewedAt >= todayStart).length
  const todayNew = data.topics.filter((t) => t.createdAt >= todayStart).length

  const quick = [
    { to: '/knowledge', ico: '📚', label: '记知识点' },
    { to: '/review', ico: '🎯', label: '开始复习' },
    { to: '/chat', ico: '💬', label: '问 AI' },
    { to: '/focus', ico: '⏱', label: '专注' },
  ]

  return (
    <div className="container page">
      <div className="page-head">
        <div>
          <div className="page-title">你好，{account.displayName}</div>
          <div className="page-sub">{BRAND.tagline}</div>
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat" style={{ cursor: 'pointer' }} onClick={() => navigate('/review')}>
          <div className="stat-num seal-text">{due.length}</div>
          <div className="stat-label">今日到期复习</div>
        </div>
        <div className="stat">
          <div className="stat-num">{todayReviewed}</div>
          <div className="stat-label">今日已复习</div>
        </div>
        <div className="stat" style={{ cursor: 'pointer' }} onClick={() => navigate('/focus')}>
          <div className="stat-num">{fmtDuration(todayFocusSec)}</div>
          <div className="stat-label">今日专注</div>
        </div>
        <div className="stat">
          <div className="stat-num">{todayNew}</div>
          <div className="stat-label">今日新增知识点</div>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-title">快速开始</div>
          <div className="quick-grid">
            {quick.map((q) => (
              <button key={q.to} className="quick-btn" onClick={() => navigate(q.to)}>
                <span className="quick-ico">{q.ico}</span>
                <span>{q.label}</span>
              </button>
            ))}
          </div>
          <div className="muted" style={{ fontSize: 13, marginTop: 14 }}>
            共 {data.topics.length} 个知识点，累计复习 {data.logs.length} 次。
          </div>
        </div>

        <div className="card">
          <div className="card-title">今日到期</div>
          {due.length === 0 ? (
            <div className="empty" style={{ padding: 24 }}>
              <div className="emoji">🎉</div>
              <div className="empty-sub">今天没有到期的复习，休息一下。</div>
            </div>
          ) : (
            <div>
              {due.slice(0, 6).map((t) => (
                <div key={t.id} className="list-item" onClick={() => navigate('/review')}>
                  <div className="list-item-main">
                    <div className="list-item-title">{t.title}</div>
                    <div className="list-item-sub">
                      {relativeDue(t.due)} · {fmtDate(t.due)}
                    </div>
                  </div>
                  <span className="tag tag-seal">复习</span>
                </div>
              ))}
              {due.length > 6 && (
                <div className="muted" style={{ textAlign: 'center', marginTop: 10, fontSize: 13 }}>
                  还有 {due.length - 6} 张待复习
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
