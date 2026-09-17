// 数据访问层：所有写读都按 accountId 隔离。组件修改数据后调用 useApp().bumpData() 触发刷新。

import { dbGetAll, dbGet, dbPut, dbDelete, genId } from './idb'
import type {
  Account,
  Category,
  ChatMessage,
  ChatSession,
  FocusSession,
  Rating,
  ReviewLog,
  Topic,
} from './types'
import { applyReview } from './fsrs'

// ---------- 账号 ----------
export async function listAccounts(): Promise<Account[]> {
  const all = await dbGetAll<Account>('accounts')
  return all.sort((a, b) => a.createdAt - b.createdAt)
}

export async function getAccount(id: string): Promise<Account | undefined> {
  return dbGet<Account>('accounts', id)
}

export async function saveAccount(account: Account): Promise<void> {
  await dbPut('accounts', account)
}

export async function deleteAccount(id: string): Promise<void> {
  await dbDelete('accounts', id)
}

// ---------- 分类 ----------
export async function listCategories(accountId: string): Promise<Category[]> {
  const all = await dbGetAll<Category>('categories')
  return all.filter((c) => c.accountId === accountId).sort((a, b) => a.sortOrder - b.sortOrder)
}

export async function createCategory(input: {
  accountId: string
  name: string
  color: string
}): Promise<Category> {
  const all = await listCategories(input.accountId)
  const cat: Category = {
    id: genId(),
    accountId: input.accountId,
    name: input.name.trim(),
    color: input.color,
    sortOrder: all.length,
    createdAt: Date.now(),
  }
  await dbPut('categories', cat)
  return cat
}

export async function updateCategory(cat: Category): Promise<void> {
  await dbPut('categories', cat)
}

export async function deleteCategory(accountId: string, id: string): Promise<void> {
  const topics = await listTopics(accountId)
  const inCat = topics.filter((t) => t.categoryId === id)
  for (const t of inCat) await dbDelete('topics', t.id)
  const logs = await dbGetAll<ReviewLog>('review_logs')
  const logIds = new Set(inCat.map((t) => t.id))
  for (const l of logs) if (logIds.has(l.topicId)) await dbDelete('review_logs', l.id)
  await dbDelete('categories', id)
}

// ---------- 知识点 ----------
export async function listTopics(accountId: string): Promise<Topic[]> {
  const all = await dbGetAll<Topic>('topics')
  return all
    .filter((t) => t.accountId === accountId)
    .sort((a, b) => b.updatedAt - a.updatedAt)
}

export async function getTopic(id: string): Promise<Topic | undefined> {
  return dbGet<Topic>('topics', id)
}

export async function createTopic(
  accountId: string,
  input: { categoryId: string; title: string; intro: string; answer: string; relations: string; mastery: string },
): Promise<Topic> {
  const now = Date.now()
  const topic: Topic = {
    id: genId(),
    accountId,
    categoryId: input.categoryId,
    title: input.title.trim(),
    intro: input.intro,
    answer: input.answer,
    relations: input.relations,
    mastery: input.mastery || '未掌握',
    state: 'new',
    reps: 0,
    lapses: 0,
    difficulty: null,
    stability: null,
    due: now,
    lastReview: null,
    scheduledDays: 0,
    createdAt: now,
    updatedAt: now,
  }
  await dbPut('topics', topic)
  return topic
}

export async function updateTopic(topic: Topic): Promise<void> {
  topic.updatedAt = Date.now()
  await dbPut('topics', topic)
}

export async function deleteTopic(id: string): Promise<void> {
  await dbDelete('topics', id)
  const logs = await dbGetAll<ReviewLog>('review_logs')
  for (const l of logs) if (l.topicId === id) await dbDelete('review_logs', l.id)
}

// ---------- 复习 ----------
export async function reviewTopic(accountId: string, topic: Topic, rating: Rating): Promise<Topic> {
  const now = Date.now()
  const snap = applyReview(topic, rating, now)
  const updated: Topic = {
    ...topic,
    state: snap.state,
    difficulty: snap.difficulty,
    stability: snap.stability,
    due: now + snap.intervalDays * 86400000,
    lastReview: now,
    scheduledDays: snap.intervalDays,
    reps: topic.reps + 1,
    lapses: topic.lapses + (rating === 1 ? 1 : 0),
    updatedAt: now,
  }
  await dbPut('topics', updated)

  const log: ReviewLog = {
    id: genId(),
    accountId,
    topicId: topic.id,
    rating,
    scheduledDays: snap.intervalDays,
    elapsedDays:
      topic.lastReview != null ? Math.max(0, (now - topic.lastReview) / 86400000) : 0,
    reviewedAt: now,
    stateBefore: topic.state,
    stateAfter: snap.state,
  }
  await dbPut('review_logs', log)
  return updated
}

export async function listReviewLogs(accountId: string): Promise<ReviewLog[]> {
  const all = await dbGetAll<ReviewLog>('review_logs')
  return all.filter((l) => l.accountId === accountId).sort((a, b) => b.reviewedAt - a.reviewedAt)
}

export function dueTopics(topics: Topic[], now = Date.now(), limit = Number.POSITIVE_INFINITY): Topic[] {
  return topics
    .filter((t) => t.due <= now)
    .sort((a, b) => a.due - b.due)
    .slice(0, limit)
}

// ---------- 专注 ----------
export async function listFocusSessions(accountId: string): Promise<FocusSession[]> {
  const all = await dbGetAll<FocusSession>('focus_sessions')
  return all
    .filter((s) => s.accountId === accountId)
    .sort((a, b) => b.startedAt - a.startedAt)
}

export async function saveFocusSession(session: FocusSession): Promise<void> {
  await dbPut('focus_sessions', session)
}

export async function deleteFocusSession(id: string): Promise<void> {
  await dbDelete('focus_sessions', id)
}

// ---------- 会话/聊天 ----------
export async function listChats(accountId: string): Promise<ChatSession[]> {
  const all = await dbGetAll<ChatSession>('chats')
  return all
    .filter((c) => c.accountId === accountId)
    .sort((a, b) => b.updatedAt - a.updatedAt)
}

export async function getChat(id: string): Promise<ChatSession | undefined> {
  return dbGet<ChatSession>('chats', id)
}

export async function createChat(
  accountId: string,
  mode: ChatSession['mode'],
  title = '新对话',
  context?: string,
): Promise<ChatSession> {
  const now = Date.now()
  const chat: ChatSession = {
    id: genId(),
    accountId,
    title,
    mode,
    context,
    createdAt: now,
    updatedAt: now,
  }
  await dbPut('chats', chat)
  return chat
}

export async function touchChat(chat: ChatSession, title?: string): Promise<void> {
  chat.updatedAt = Date.now()
  if (title !== undefined) chat.title = title
  await dbPut('chats', chat)
}

export async function deleteChat(id: string): Promise<void> {
  await dbDelete('chats', id)
  const msgs = await dbGetAll<ChatMessage>('messages')
  for (const m of msgs) if (m.sessionId === id) await dbDelete('messages', m.id)
}

export async function listMessages(sessionId: string): Promise<ChatMessage[]> {
  const all = await dbGetAll<ChatMessage>('messages')
  return all.filter((m) => m.sessionId === sessionId).sort((a, b) => a.createdAt - b.createdAt)
}

export async function appendMessage(message: ChatMessage): Promise<void> {
  await dbPut('messages', message)
}

// ---------- 账号级数据清理 ----------
export async function wipeAccount(accountId: string): Promise<void> {
  const stores = [
    'categories',
    'topics',
    'review_logs',
    'focus_sessions',
    'chats',
    'messages',
  ] as const
  for (const store of stores) {
    const all = await dbGetAll<{ accountId?: string; id: string }>(store)
    for (const rec of all) {
      if (rec.accountId === accountId) await dbDelete(store, rec.id)
    }
  }
}
