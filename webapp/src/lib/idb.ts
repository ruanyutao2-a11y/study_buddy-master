// 极简 IndexedDB 封装：个人规模数据，按账号过滤在内存中完成，无需索引。

const DB_NAME = 'shixi-web'
const DB_VERSION = 1

const STORES = [
  'accounts',
  'categories',
  'topics',
  'review_logs',
  'focus_sessions',
  'chats',
  'messages',
] as const

export type StoreName = (typeof STORES)[number]

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      for (const name of STORES) {
        if (!db.objectStoreNames.contains(name)) {
          db.createObjectStore(name, { keyPath: 'id' })
        }
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbPromise
}

async function withStore<T>(
  store: StoreName,
  mode: IDBTransactionMode,
  fn: (s: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDb()
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(store, mode)
    const s = tx.objectStore(store)
    const req = fn(s)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function dbPut(store: StoreName, value: unknown): Promise<void> {
  await withStore(store, 'readwrite', (s) => s.put(value as never))
}

export async function dbGet<T>(store: StoreName, id: string): Promise<T | undefined> {
  return withStore<T | undefined>(store, 'readonly', (s) => s.get(id) as IDBRequest<T | undefined>)
}

export async function dbGetAll<T>(store: StoreName): Promise<T[]> {
  return withStore<T[]>(store, 'readonly', (s) => s.getAll() as IDBRequest<T[]>)
}

export async function dbDelete(store: StoreName, id: string): Promise<void> {
  await withStore(store, 'readwrite', (s) => s.delete(id))
}

export async function dbClear(store: StoreName): Promise<void> {
  await withStore(store, 'readwrite', (s) => s.clear())
}

// 生成唯一 ID：优先 randomUUID，回退到时间戳随机数。
export function genId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}
