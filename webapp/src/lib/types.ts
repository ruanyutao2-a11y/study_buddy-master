// 数据模型：与 IndexedDB 存储结构一一对应。所有记录均带 accountId 做账号隔离。

export type Rating = 1 | 2 | 3 | 4
export type CardState = 'new' | 'learning' | 'review' | 'relearning'
export type ThemeMode = 'light' | 'dark' | 'system'

export interface Account {
  id: string
  username: string
  displayName: string
  salt: string
  passwordHash: string
  createdAt: number
}

export interface Category {
  id: string
  accountId: string
  name: string
  color: string
  sortOrder: number
  createdAt: number
}

export interface Topic {
  id: string
  accountId: string
  categoryId: string
  title: string
  intro: string // 引子
  answer: string // 答案
  relations: string // 关联
  mastery: string // 掌握度标签（自由文本）
  // FSRS 状态
  state: CardState
  reps: number
  lapses: number
  difficulty: number | null
  stability: number | null
  due: number // 到期时间戳(ms)
  lastReview: number | null
  scheduledDays: number
  createdAt: number
  updatedAt: number
}

export interface ReviewLog {
  id: string
  accountId: string
  topicId: string
  rating: Rating
  scheduledDays: number
  elapsedDays: number
  reviewedAt: number
  stateBefore: CardState
  stateAfter: CardState
}

export interface FocusSession {
  id: string
  accountId: string
  startedAt: number
  endedAt: number
  durationSec: number
  topicIds: string[]
  note: string
}

export type ChatMode = 'socratic' | 'normal'

export interface ChatSession {
  id: string
  accountId: string
  title: string
  mode: ChatMode
  context?: string // 苏格拉底教学的上下文（例如来自某个知识点）
  createdAt: number
  updatedAt: number
}

export interface ChatMessage {
  id: string
  sessionId: string
  accountId: string
  role: 'user' | 'assistant'
  content: string
  image?: string // dataURL
  createdAt: number
}

export interface Settings {
  llmBaseUrl: string
  llmApiKey: string
  llmModel: string
  systemPrompt: string
  theme: ThemeMode
  dailyReviewLimit: number
  socraticEnabled: boolean
}

export const DEFAULT_SETTINGS: Settings = {
  llmBaseUrl: '',
  llmApiKey: '',
  llmModel: '',
  systemPrompt: '',
  theme: 'system',
  dailyReviewLimit: 50,
  socraticEnabled: true,
}

// 掌握度标签候选
export const MASTERY_TAGS = ['未掌握', '模糊', '熟悉', '熟练', '精通']
