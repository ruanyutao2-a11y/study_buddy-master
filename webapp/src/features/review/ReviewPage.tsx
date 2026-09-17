import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../../store/appContext'
import { useData } from '../../lib/useData'
import { dueTopics, listTopics, reviewTopic } from '../../lib/data'
import { Markdown } from '../../lib/markdown'
import type { Rating, Topic } from '../../lib/types'

const RATINGS: { value: Rating; label: string; ico: string; cls: string }[] = [
  { value: 1, label: '忘了', ico: '😵', cls: 'r1' },
  { value: 2, label: '困难', ico: '😅', cls: 'r2' },
  { value: 3, label: '良好', ico: '🙂', cls: 'r3' },
  { value: 4, label: '简单', ico: '😎', cls: 'r4' },
]

export function ReviewPage() {
  const { account, settings } = useApp()
  const navigate = useNavigate()
  const { data } = useData(() => listTopics(account!.id), [account?.id])

  const [queue, setQueue] = useState<Topic[] | null>(null)
  const [index, setIndex] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [doneCount, setDoneCount] = useState(0)

  useEffect(() => {
    if (data && queue === null) {
      setQueue(dueTopics(data, Date.now(), settings.dailyReviewLimit))
    }
  }, [data, queue, settings.dailyReviewLimit])

  if (!account) return null

  if (!data || queue === null) {
    return (
      <div className="container page">
        <div className="muted">加载中…</div>
      </div>
    )
  }

  const total = queue.length
  const current = index < total ? queue[index] : null

  const rate = async (rating: Rating) => {
    if (!current) return
    await reviewTopic(account.id, current, rating)
    setRevealed(false)
    setDoneCount((d) => d + 1)
    setIndex((i) => i + 1)
  }

  return (
    <div className="container page">
      <div className="page-head">
        <div>
          <div className="page-title">间隔复习</div>
          <div className="page-sub">只复习该复习的几张卡，少而准</div>
        </div>
      </div>

      {total === 0 ? (
        <div className="empty">
          <div className="emoji">🎉</div>
          <div className="empty-title">今天没有到期的复习</div>
          <div className="empty-sub">去知识库记一些新知识点，或稍后再来。</div>
          <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => navigate('/knowledge')}>
            去知识库
          </button>
        </div>
      ) : !current ? (
        <div className="card review-card" style={{ textAlign: 'center', padding: 48 }}>
          <div className="emoji" style={{ fontSize: 44 }}>✅</div>
          <div className="empty-title">今日复习完成</div>
          <div className="empty-sub">共复习 {doneCount} 张卡，时习已为你排好下次时间。</div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 18 }}>
            <button className="btn" onClick={() => navigate('/')}>
              回首页
            </button>
            <button className="btn btn-primary" onClick={() => navigate('/knowledge')}>
              再记知识点
            </button>
          </div>
        </div>
      ) : (
        <div className="card review-card">
          <div className="review-progress">
            <span className="muted" style={{ fontSize: 13 }}>
              {index + 1} / {total}
            </span>
            <div className="review-progress-bar">
              <div
                className="review-progress-fill"
                style={{ width: `${((index + (revealed ? 0.5 : 0)) / total) * 100}%` }}
              />
            </div>
            <span className="muted" style={{ fontSize: 13 }}>
              已复习 {doneCount}
            </span>
          </div>

          <div className="review-q">{current.title}</div>
          <div className="muted" style={{ marginBottom: 18 }}>
            💡 {current.intro || '回忆一下这个知识点'}
          </div>

          {!revealed ? (
            <button className="btn btn-primary btn-block" onClick={() => setRevealed(true)}>
              显示答案
            </button>
          ) : (
            <div className="review-answer">
              <div className="detail-block">
                <div className="detail-label">📖 答案</div>
                <div className="detail-md">
                  <Markdown text={current.answer || '（无）'} />
                </div>
              </div>
              {current.relations && (
                <div className="detail-block">
                  <div className="detail-label">🔗 关联</div>
                  <div className="detail-md">
                    <Markdown text={current.relations} />
                  </div>
                </div>
              )}
              <div className="rating-bar">
                {RATINGS.map((r) => (
                  <button key={r.value} className={`rating-btn ${r.cls}`} onClick={() => void rate(r.value)}>
                    <span className="r-ico">{r.ico}</span>
                    {r.label}
                  </button>
                ))}
              </div>
              <div className="hint" style={{ textAlign: 'center', marginTop: 12 }}>
                自评会驱动 FSRS 记忆曲线，安排下次复习时间。
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
