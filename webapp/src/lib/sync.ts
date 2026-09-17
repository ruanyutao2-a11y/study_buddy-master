// 云端数据同步层：把业务数据镜像到 Supabase，实现跨设备一致。
// 策略：本地 IndexedDB 为主，写操作在本地落盘后异步「上行」（push）；
//       登录/启动时从云端「下行」（pull）并按 updatedAt 合并。
// 列名映射：客户端使用 camelCase，Supabase 表使用 snake_case，上行/下行时互转。

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { normalizeSupabaseUrl } from './supabase'
import { dbGetAll, dbPut } from './idb'

export interface SyncConfig {
  url: string
  anonKey: string
}

let sb: SupabaseClient | null = null
let sbKey = ''

function getClient(cfg: SyncConfig): SupabaseClient {
  const url = normalizeSupabaseUrl(cfg.url)
  const key = `${url}|${cfg.anonKey}`
  if (sb && sbKey === key) return sb
  sbKey = key
  sb = createClient(url, cfg.anonKey, { auth: { persistSession: true, autoRefreshToken: true } })
  return sb
}

function resetClient(): void {
  sb = null
}

// 账号 id `sb:<user_id>` → 去掉前缀，得到 Supabase 的 auth.uid()
export function cloudUserId(accountId: string): string {
  return accountId.startsWith('sb:') ? accountId.slice(3) : accountId
}

export function isCloudAccount(accountId: string): boolean {
  return accountId.startsWith('sb:')
}

// 表名常量
const T = {
  categories: 'categories',
  topics: 'topics',
  reviewLogs: 'review_logs',
  focusSessions: 'focus_sessions',
  chats: 'chats',
  messages: 'messages',
} as const

// ---------- 字段映射 ----------
function toSnake(s: string): string {
  return s.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase())
}

function toCamel(s: string): string {
  return s.replace(/_([a-z0-9])/g, (_m, c: string) => c.toUpperCase())
}

// 本地记录 → 云端行（camelCase→snake_case，并注入 user_id）
function toCloudRow(rec: Record<string, unknown>, userId: string): Record<string, unknown> {
  const row: Record<string, unknown> = { user_id: userId }
  for (const [k, v] of Object.entries(rec)) {
    if (k === 'user_id' || k === 'userId') continue
    row[toSnake(k)] = v
  }
  return row
}

// 云端行 → 本地记录（snake_case→camelCase）
function toLocalRecord(row: Record<string, unknown>): Record<string, unknown> {
  const rec: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(row)) {
    if (k === 'user_id') continue
    rec[toCamel(k)] = v
  }
  return rec
}

// ---------- 上行（push） ----------
type Row = Record<string, unknown>

export interface PushTask {
  kind: 'upsert' | 'delete'
  table: string
  row?: Row
  id?: string
  userId?: string
}

// 把 store 名映射到 Supabase 表名
export function tableForStore(store: string): string | null {
  switch (store) {
    case 'categories':
      return T.categories
    case 'topics':
      return T.topics
    case 'review_logs':
      return T.reviewLogs
    case 'focus_sessions':
      return T.focusSessions
    case 'chats':
      return T.chats
    case 'messages':
      return T.messages
    default:
      return null
  }
}

// 把一条本地记录转成待上行任务（含用户 id）
export function recordToPush(store: string, rec: unknown, accountId: string): PushTask | null {
  const r = rec as { id: string }
  if (!r || !r.id) return null
  const table = tableForStore(store)
  if (!table) return null
  const userId = cloudUserId(accountId)
  return { kind: 'upsert', table, row: toCloudRow(r as Record<string, unknown>, userId), userId }
}

// 构造删除任务
export function deleteToPush(store: string, rec: unknown, accountId: string): PushTask | null {
  const r = rec as { id?: string }
  if (!r || !r.id) return null
  const table = tableForStore(store)
  if (!table) return null
  return { kind: 'delete', table, id: r.id, userId: cloudUserId(accountId) }
}

// 批量上行
export async function pushRecords(cfg: SyncConfig, tasks: PushTask[]): Promise<void> {
  const client = getClient(cfg)
  for (const t of tasks) {
    try {
      if (t.kind === 'upsert' && t.row) await client.from(t.table).upsert(t.row, { onConflict: 'id' })
      else if (t.kind === 'delete' && t.id) await client.from(t.table).delete().eq('id', t.id)
    } catch {
      /* 单条失败不中断 */
    }
  }
}

// ---------- 下行（pull） ----------
async function pullTable(
  client: SupabaseClient,
  table: string,
  userId: string,
): Promise<Record<string, unknown>[]> {
  const { data, error } = await client.from(table).select('*').eq('user_id', userId)
  if (error) return []
  return (data ?? []) as Record<string, unknown>[]
}

function mergeByUpdatedAt<T extends { id: string; updatedAt?: number }>(
  local: T[],
  remote: T[],
): { toWrite: T[] } {
  const localMap = new Map(local.map((r) => [r.id, r]))
  const toWrite: T[] = []

  for (const r of remote) {
    const l = localMap.get(r.id)
    if (!l) {
      toWrite.push(r)
    } else if ((r.updatedAt ?? 0) > (l.updatedAt ?? 0)) {
      toWrite.push(r)
    }
  }
  // 本地有、云端没有的：保留本地（离线新增，稍后由 push 上行）
  return { toWrite }
}

// 拉取某个账号的全部云端数据并合并到本地
export async function pullAndMerge(
  cfg: SyncConfig,
  accountId: string,
): Promise<{ pulled: number }> {
  const client = getClient(cfg)
  const userId = cloudUserId(accountId)
  let pulled = 0

  const tables: { store: string; table: string }[] = [
    { store: 'categories', table: T.categories },
    { store: 'topics', table: T.topics },
    { store: 'review_logs', table: T.reviewLogs },
    { store: 'focus_sessions', table: T.focusSessions },
    { store: 'chats', table: T.chats },
    { store: 'messages', table: T.messages },
  ]

  for (const spec of tables) {
    const remoteRows = await pullTable(client, spec.table, userId)
    const remote = remoteRows.map((r) => toLocalRecord(r) as unknown as { id: string; updatedAt?: number; accountId?: string })
    const local = (
      await dbGetAll<{ id: string; updatedAt?: number; accountId?: string }>(spec.store as never)
    ).filter((r) => r.accountId === accountId)

    const { toWrite } = mergeByUpdatedAt(local, remote)
    for (const row of toWrite) {
      await dbPut(spec.store as never, { ...row, accountId })
      pulled++
    }
  }

  return { pulled }
}

// 删除远端某账号全部数据（账号删除时调用）
export async function wipeCloudAccount(cfg: SyncConfig, accountId: string): Promise<void> {
  const client = getClient(cfg)
  const userId = cloudUserId(accountId)
  for (const table of Object.values(T)) {
    try {
      await client.from(table).delete().eq('user_id', userId)
    } catch {
      /* ignore */
    }
  }
}

export function resetSyncClient(): void {
  resetClient()
}