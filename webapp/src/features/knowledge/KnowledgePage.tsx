import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../../store/appContext'
import { useData } from '../../lib/useData'
import { Modal } from '../../components/Modal'
import {
  createCategory,
  createTopic,
  deleteCategory,
  deleteTopic,
  listCategories,
  listTopics,
  updateCategory,
  updateTopic,
} from '../../lib/data'
import { fmtDate, relativeDue } from '../../lib/format'
import { MASTERY_TAGS, type Category, type Topic } from '../../lib/types'
import { Markdown } from '../../lib/markdown'

const CAT_COLORS = ['#F42B45', '#B4752A', '#3E7B4F', '#3F6D9E', '#7A5AA8', '#C2574A', '#5A8A72']

function masteryTagClass(m: string): string {
  if (m === '熟练' || m === '精通') return 'tag-ok'
  if (m === '模糊') return 'tag-warn'
  if (m === '未掌握') return 'tag-seal'
  return 'tag-blue'
}

export function KnowledgePage() {
  const { account, bumpData } = useApp()
  const navigate = useNavigate()
  const [catId, setCatId] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [editingTopic, setEditingTopic] = useState<Topic | 'new' | null>(null)
  const [detailTopic, setDetailTopic] = useState<Topic | null>(null)
  const [showCatModal, setShowCatModal] = useState(false)
  const [editingCat, setEditingCat] = useState<Category | null>(null)

  const { data } = useData(async () => {
    const [cats, topics] = await Promise.all([listCategories(account!.id), listTopics(account!.id)])
    return { cats, topics }
  }, [account?.id])

  if (!account) return null
  if (!data) {
    return (
      <div className="container page">
        <div className="muted">加载中…</div>
      </div>
    )
  }

  const { cats, topics } = data
  const filtered = topics.filter((t) => {
    if (catId !== 'all' && t.categoryId !== catId) return false
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      return (
        t.title.toLowerCase().includes(q) ||
        t.intro.toLowerCase().includes(q) ||
        t.answer.toLowerCase().includes(q)
      )
    }
    return true
  })

  const catName = (id: string) => cats.find((c) => c.id === id)?.name ?? '未分类'
  const catColor = (id: string) => cats.find((c) => c.id === id)?.color ?? '#9A9080'

  const refresh = () => bumpData()

  const handleDeleteTopic = async (t: Topic) => {
    if (!window.confirm(`确定删除知识点「${t.title}」吗？其复习记录也会一并删除。`)) return
    await deleteTopic(t.id)
    setDetailTopic(null)
    refresh()
  }

  return (
    <div className="container page">
      <div className="page-head">
        <div>
          <div className="page-title">知识点库</div>
          <div className="page-sub">沉淀你学过的每个知识点，附「引子—答案—关联」</div>
        </div>
        <button className="btn btn-primary" onClick={() => setEditingTopic('new')}>
          ＋ 记一个知识点
        </button>
      </div>

      <div className="kb-layout">
        <aside className="kb-side">
          <div className="card" style={{ padding: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div className="card-title" style={{ margin: 0, fontSize: 15 }}>
                分类
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowCatModal(true)}>
                ＋
              </button>
            </div>
            <div className="cat-list">
              <div className={`cat-item${catId === 'all' ? ' active' : ''}`} onClick={() => setCatId('all')}>
                <span className="cat-dot" style={{ background: '#9A9080' }} />
                <span className="cat-item-main">全部</span>
                <span className="cat-count">{topics.length}</span>
              </div>
              {cats.map((c) => {
                const count = topics.filter((t) => t.categoryId === c.id).length
                return (
                  <div key={c.id} className={`cat-item${catId === c.id ? ' active' : ''}`}>
                    <span
                      className="cat-dot"
                      style={{ background: c.color }}
                      onClick={() => setCatId(c.id)}
                    />
                    <span className="cat-item-main" onClick={() => setCatId(c.id)}>
                      {c.name}
                    </span>
                    <span className="cat-count" onClick={() => setCatId(c.id)}>
                      {count}
                    </span>
                    <button
                      className="btn btn-ghost btn-sm"
                      style={{ padding: '0 4px' }}
                      onClick={() => setEditingCat(c)}
                    >
                      ✎
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        </aside>

        <section>
          <div className="search-bar">
            <span className="sico">🔍</span>
            <input
              className="input"
              placeholder="搜索知识点…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {filtered.length === 0 ? (
            <div className="empty">
              <div className="emoji">📭</div>
              <div className="empty-title">还没有知识点</div>
              <div className="empty-sub">点击右上角「记一个知识点」开始沉淀。</div>
            </div>
          ) : (
            <div className="grid-2">
              {filtered.map((t) => (
                <div key={t.id} className="topic-card" onClick={() => setDetailTopic(t)}>
                  <div className="topic-title">{t.title}</div>
                  <div className="topic-intro">{t.intro || '（无引子）'}</div>
                  <div className="topic-meta">
                    <span className="tag" style={{ borderColor: catColor(t.categoryId) }}>
                      {catName(t.categoryId)}
                    </span>
                    <span className={`tag ${masteryTagClass(t.mastery)}`}>{t.mastery}</span>
                    <span className="tag tag-blue">
                      {t.due <= Date.now() ? '待复习' : relativeDue(t.due)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {editingTopic && (
        <TopicForm
          accountId={account.id}
          cats={cats}
          topic={editingTopic === 'new' ? null : editingTopic}
          defaultCatId={catId === 'all' ? undefined : catId}
          onClose={() => setEditingTopic(null)}
          onDone={() => {
            setEditingTopic(null)
            refresh()
          }}
        />
      )}

      {detailTopic && (
        <TopicDetail
          topic={detailTopic}
          catName={catName(detailTopic.categoryId)}
          catColor={catColor(detailTopic.categoryId)}
          onClose={() => setDetailTopic(null)}
          onEdit={() => {
            setEditingTopic(detailTopic)
            setDetailTopic(null)
          }}
          onDelete={() => void handleDeleteTopic(detailTopic)}
          onAsk={() => {
            navigate('/chat', { state: { topicId: detailTopic.id } })
            setDetailTopic(null)
          }}
        />
      )}

      {showCatModal && (
        <CategoryFormModal
          accountId={account.id}
          cats={cats}
          onClose={() => setShowCatModal(false)}
          onDone={() => {
            setShowCatModal(false)
            refresh()
          }}
        />
      )}

      {editingCat && (
        <CategoryEditModal
          category={editingCat}
          onClose={() => setEditingCat(null)}
          onDone={() => {
            setEditingCat(null)
            refresh()
          }}
          onDelete={async () => {
            if (!window.confirm(`删除分类「${editingCat.name}」？其下知识点也会被删除。`)) return
            await deleteCategory(account.id, editingCat.id)
            setEditingCat(null)
            if (catId === editingCat.id) setCatId('all')
            refresh()
          }}
        />
      )}
    </div>
  )
}

// ---------- 知识点表单 ----------
function TopicForm({
  accountId,
  cats,
  topic,
  defaultCatId,
  onClose,
  onDone,
}: {
  accountId: string
  cats: Category[]
  topic: Topic | null
  defaultCatId?: string
  onClose: () => void
  onDone: () => void
}) {
  const [title, setTitle] = useState(topic?.title ?? '')
  const [categoryId, setCategoryId] = useState(topic?.categoryId ?? defaultCatId ?? cats[0]?.id ?? '')
  const [intro, setIntro] = useState(topic?.intro ?? '')
  const [answer, setAnswer] = useState(topic?.answer ?? '')
  const [relations, setRelations] = useState(topic?.relations ?? '')
  const [mastery, setMastery] = useState(topic?.mastery ?? '未掌握')
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    setBusy(true)
    if (topic) {
      await updateTopic({ ...topic, title, categoryId, intro, answer, relations, mastery })
    } else {
      await createTopic(accountId, { categoryId, title, intro, answer, relations, mastery })
    }
    setBusy(false)
    onDone()
  }

  return (
    <Modal
      title={topic ? '编辑知识点' : '记一个知识点'}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            取消
          </button>
          <button className="btn btn-primary" onClick={submit} disabled={busy || !title.trim()}>
            保存
          </button>
        </>
      }
    >
      <form onSubmit={submit}>
        <div className="field">
          <label className="label">标题 *</label>
          <input
            className="input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="例如：导数定义"
          />
        </div>
        <div className="field">
          <label className="label">分类</label>
          <select className="select" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            {cats.length === 0 && <option value="">（无分类）</option>}
            {cats.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label className="label">引子（引导思考的问题/场景）</label>
          <textarea
            className="textarea"
            value={intro}
            onChange={(e) => setIntro(e.target.value)}
            placeholder="从一个具体场景或问题切入…"
          />
        </div>
        <div className="field">
          <label className="label">答案 / 讲解</label>
          <textarea
            className="textarea"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="核心结论与推导（支持 Markdown）"
            style={{ minHeight: 120 }}
          />
        </div>
        <div className="field">
          <label className="label">关联（与其他知识点的联系）</label>
          <textarea
            className="textarea"
            value={relations}
            onChange={(e) => setRelations(e.target.value)}
            placeholder="例如：与「极限」的关系…"
          />
        </div>
        <div className="field">
          <label className="label">掌握度</label>
          <select className="select" value={mastery} onChange={(e) => setMastery(e.target.value)}>
            {MASTERY_TAGS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
      </form>
    </Modal>
  )
}

// ---------- 知识点详情 ----------
function TopicDetail({
  topic,
  catName,
  catColor,
  onClose,
  onEdit,
  onDelete,
  onAsk,
}: {
  topic: Topic
  catName: string
  catColor: string
  onClose: () => void
  onEdit: () => void
  onDelete: () => void
  onAsk: () => void
}) {
  return (
    <Modal
      title={topic.title}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-danger" onClick={onDelete}>
            删除
          </button>
          <button className="btn" onClick={onEdit}>
            编辑
          </button>
          <button className="btn btn-primary" onClick={onAsk}>
            ❓ 为什么？
          </button>
        </>
      }
    >
      <div className="topic-meta" style={{ marginBottom: 16 }}>
        <span className="tag" style={{ borderColor: catColor }}>
          {catName}
        </span>
        <span className={`tag ${masteryTagClass(topic.mastery)}`}>{topic.mastery}</span>
        <span className="tag tag-blue">
          {topic.due <= Date.now() ? '待复习' : `${relativeDue(topic.due)}（${fmtDate(topic.due)}）`}
        </span>
        <span className="tag">已复习 {topic.reps} 次</span>
      </div>

      <div className="detail-block">
        <div className="detail-label">💡 引子</div>
        <div className="detail-text">{topic.intro || '（无）'}</div>
      </div>
      <div className="detail-block">
        <div className="detail-label">📖 答案</div>
        <div className="detail-md">
          <Markdown text={topic.answer || '（无）'} />
        </div>
      </div>
      <div className="detail-block">
        <div className="detail-label">🔗 关联</div>
        <div className="detail-md">
          <Markdown text={topic.relations || '（无）'} />
        </div>
      </div>
    </Modal>
  )
}

// ---------- 分类：新建 ----------
function CategoryFormModal({
  accountId,
  cats,
  onClose,
  onDone,
}: {
  accountId: string
  cats: Category[]
  onClose: () => void
  onDone: () => void
}) {
  const [name, setName] = useState('')
  const [color, setColor] = useState(CAT_COLORS[0])

  const create = async () => {
    if (!name.trim()) return
    await createCategory({ accountId, name, color })
    onDone()
  }

  return (
    <Modal
      title="新建分类"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            取消
          </button>
          <button className="btn btn-primary" onClick={create} disabled={!name.trim()}>
            创建
          </button>
        </>
      }
    >
      <div className="field">
        <label className="label">分类名</label>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="例如：数学" />
      </div>
      <div className="field">
        <label className="label">颜色</label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {CAT_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              style={{
                width: 26,
                height: 26,
                borderRadius: '50%',
                background: c,
                border: color === c ? '3px solid var(--ink)' : '3px solid transparent',
                outline: 'none',
              }}
            />
          ))}
        </div>
      </div>
      {cats.length === 0 && (
        <div className="hint">还没有分类，先创建一个，之后给知识点归类。</div>
      )}
    </Modal>
  )
}

// ---------- 分类：编辑 ----------
function CategoryEditModal({
  category,
  onClose,
  onDone,
  onDelete,
}: {
  category: Category
  onClose: () => void
  onDone: () => void
  onDelete: () => void
}) {
  const [name, setName] = useState(category.name)
  const [color, setColor] = useState(category.color)

  const save = async () => {
    if (!name.trim()) return
    await updateCategory({ ...category, name, color })
    onDone()
  }

  return (
    <Modal
      title="编辑分类"
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-danger" onClick={onDelete}>
            删除
          </button>
          <button className="btn" onClick={onClose}>
            取消
          </button>
          <button className="btn btn-primary" onClick={save} disabled={!name.trim()}>
            保存
          </button>
        </>
      }
    >
      <div className="field">
        <label className="label">分类名</label>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="field">
        <label className="label">颜色</label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {CAT_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              style={{
                width: 26,
                height: 26,
                borderRadius: '50%',
                background: c,
                border: color === c ? '3px solid var(--ink)' : '3px solid transparent',
                outline: 'none',
              }}
            />
          ))}
        </div>
      </div>
    </Modal>
  )
}
