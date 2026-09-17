import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { deleteAccount, getAccount, listAccounts, saveAccount, setSyncHook, wipeAccount } from '../lib/data'
import { hashPassword, randomSalt } from '../lib/crypto'
import { genId } from '../lib/idb'
import { DEFAULT_SETTINGS, type Account, type Settings, type ThemeMode } from '../lib/types'
import { getSupabase, isSupabaseConfigured, resetSupabaseClient } from '../lib/supabase'
import { SUPABASE_DEFAULTS } from '../lib/supabaseConfig'
import { deleteToPush, recordToPush, pushRecords, pullAndMerge, wipeCloudAccount, type SyncConfig } from '../lib/sync'

const CURRENT_KEY = 'shixi:currentAccountId'
const SETTINGS_PREFIX = 'shixi:settings:'
const LOGGED_OUT_KEY = 'shixi:loggedOut'
// 全局 Supabase 配置存独立 key，供未登录时也能读取（例如登录前）。
const GLOBAL_SUPABASE_CONFIG = 'shixi:supabaseConfig'

interface SupabaseConfig {
  url: string
  publishableKey: string
}

function loadGlobalSupabaseConfig(): SupabaseConfig {
  try {
    const raw = localStorage.getItem(GLOBAL_SUPABASE_CONFIG)
    if (raw) return { url: SUPABASE_DEFAULTS.url, publishableKey: SUPABASE_DEFAULTS.anonKey, ...(JSON.parse(raw) as Partial<SupabaseConfig>) }
  } catch {
    /* ignore */
  }
  // 未手动保存过时，回退到内置默认配置（开箱可用）
  return { url: SUPABASE_DEFAULTS.url, publishableKey: SUPABASE_DEFAULTS.anonKey }
}

function saveGlobalSupabaseConfig(cfg: SupabaseConfig): void {
  localStorage.setItem(GLOBAL_SUPABASE_CONFIG, JSON.stringify(cfg))
}

// 记录当前登录账号，并清除「已登出」标记（用户主动登录后应恢复自动会话能力）
function markAuthenticated(accountId: string): void {
  localStorage.removeItem(LOGGED_OUT_KEY)
  localStorage.setItem(CURRENT_KEY, accountId)
}

function loadSettings(accountId: string): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_PREFIX + accountId)
    if (raw) return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) }
  } catch {
    /* ignore */
  }
  return { ...DEFAULT_SETTINGS }
}

interface AppContextValue {
  account: Account | null
  accounts: Account[]
  booting: boolean
  dataVersion: number
  bumpData: () => void
  settings: Settings
  saveSettings: (patch: Partial<Settings>) => void
  supabaseUrl: string
  supabasePublishableKey: string
  supabaseReady: boolean
  saveSupabaseConfig: (url: string, publishableKey: string) => void
  login: (username: string, password: string) => Promise<string | null>
  register: (username: string, displayName: string, password: string) => Promise<string | null>
  logout: () => void
  switchAccount: (id: string) => Promise<void>
  deleteCurrentAccount: () => Promise<string | null>
}

const AppContext = createContext<AppContextValue | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [account, setAccount] = useState<Account | null>(null)
  const [booting, setBooting] = useState(true)
  const [dataVersion, setDataVersion] = useState(0)
  const [settings, setSettings] = useState<Settings>({ ...DEFAULT_SETTINGS })
  const [supabaseCfg, setSupabaseCfgState] = useState<SupabaseConfig>(loadGlobalSupabaseConfig)

  const supabaseReady = isSupabaseConfigured(supabaseCfg)

  const bumpData = useCallback(() => setDataVersion((v) => v + 1), [])

  // 注册数据层同步钩子：云账号 + 已配置 Supabase 时，本地写操作后台镜像到云端。
  useEffect(() => {
    if (!supabaseReady) {
      setSyncHook(null)
      return
    }
    const cfg: SyncConfig = { url: supabaseCfg.url, anonKey: supabaseCfg.publishableKey }
    // 累积待上行任务，批量推送（去抖）
    let queue: ReturnType<typeof recordToPush>[] = []
    let timer: ReturnType<typeof setTimeout> | null = null
    const flush = async () => {
      timer = null
      const tasks = queue
      queue = []
      const valid = tasks.filter((t): t is NonNullable<typeof t> => t != null)
      if (valid.length === 0) return
      const curId = account?.id
      if (!curId || !curId.startsWith('sb:')) return
      await pushRecords(cfg, valid)
    }
    setSyncHook((_store, rec, op) => {
      const curId = account?.id
      if (!curId || !curId.startsWith('sb:')) return
      const task = op === 'upsert' ? recordToPush(_store, rec, curId) : deleteToPush(_store, rec, curId)
      if (task) queue.push(task)
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => void flush(), 300)
    })
    return () => {
      if (timer) clearTimeout(timer)
      setSyncHook(null)
    }
  }, [supabaseReady, supabaseCfg, account?.id])

  // 把本地账号同步为「本地登录态」；Supabase 用户会做 upsert 记录。
  const applyLocalAccount = useCallback((acc: Account | null) => {
    setAccount(acc)
    if (acc) setSettings(loadSettings(acc.id))
  }, [])

  // 启动：加载本地账号 + 尝试恢复 Supabase 会话
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const all = await listAccounts()
        if (cancelled) return
        setAccounts(all)

        // 1) 若 Supabase 已配置，且用户未主动登出，尝试恢复云端会话
        const explicitlyLoggedOut = localStorage.getItem(LOGGED_OUT_KEY) === '1'
        if (isSupabaseConfigured(supabaseCfg) && !explicitlyLoggedOut) {
          try {
            const sb = getSupabase(supabaseCfg)
            if (sb) {
              const { data } = await sb.auth.getSession()
              const user = data?.session?.user
              if (user) {
                const uname = user.user_metadata?.username || user.email || user.id
                const display =
                  user.user_metadata?.displayName || uname
                const uid = `sb:${user.id}`
                // upsert 到本地账号表（云端账号）
                const existing = await getAccount(uid)
                const acc: Account = {
                  id: uid,
                  username: uname,
                  displayName: display,
                  source: 'supabase',
                  createdAt: existing?.createdAt ?? Date.now(),
                }
                await saveAccount(acc)
                setAccounts(await listAccounts())
                markAuthenticated(uid)
                applyLocalAccount(acc)
                // 拉取云端数据（后台合并，不阻塞登录）
                void pullAndMerge({ url: supabaseCfg.url, anonKey: supabaseCfg.publishableKey }, uid)
                  .then(() => bumpData())
                  .catch(() => undefined)
                setBooting(false)
                return
              }
            }
          } catch {
            /* 云端恢复失败则回退到本地账号 */
          }
        }

        // 2) 回退到本地账号
        const id = localStorage.getItem(CURRENT_KEY)
        let cur = id ? all.find((a) => a.id === id) : undefined
        if (!cur && all.length > 0) cur = all[0]
        applyLocalAccount(cur ?? null)
      } finally {
        if (!cancelled) setBooting(false)
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const saveSettings = useCallback(
    (patch: Partial<Settings>) => {
      setSettings((prev) => {
        const next = { ...prev, ...patch }
        if (account) localStorage.setItem(SETTINGS_PREFIX + account.id, JSON.stringify(next))
        return next
      })
    },
    [account],
  )

  const saveSupabaseConfig = useCallback((url: string, publishableKey: string) => {
    const cfg = { url: url.trim(), publishableKey: publishableKey.trim() }
    saveGlobalSupabaseConfig(cfg)
    setSupabaseCfgState(cfg)
    resetSupabaseClient()
    setSettings((prev) => ({ ...prev, supabaseUrl: cfg.url, supabasePublishableKey: cfg.publishableKey }))
  }, [])

  const login = useCallback(
    async (username: string, password: string) => {
      const uname = username.trim()
      // 优先尝试 Supabase 云端登录
      if (supabaseReady) {
        const sb = getSupabase(supabaseCfg)
        if (sb) {
          try {
            // 用户名可能不是邮箱；Supabase 需 email。若含 @ 按 email 处理，否则尝试用「username」元数据查不到邮箱时直接走本地。
            if (uname.includes('@')) {
              const { data, error } = await sb.auth.signInWithPassword({
                email: uname.toLowerCase(),
                password,
              })
              if (!error && data.user) {
                const user = data.user
                const display =
                  user.user_metadata?.displayName ||
                  user.user_metadata?.username ||
                  uname
                const uid = `sb:${user.id}`
                const existing = await getAccount(uid)
                const acc: Account = {
                  id: uid,
                  username: user.user_metadata?.username || user.email || uname,
                  displayName: display,
                  source: 'supabase',
                  createdAt: existing?.createdAt ?? Date.now(),
                }
                await saveAccount(acc)
                markAuthenticated(uid)
                setAccount(acc)
                setSettings(loadSettings(uid))
                setAccounts(await listAccounts())
                setDataVersion((v) => v + 1)
                // 拉取云端数据（后台合并）
                void pullAndMerge({ url: supabaseCfg.url, anonKey: supabaseCfg.publishableKey }, uid)
                  .then(() => bumpData())
                  .catch(() => undefined)
                return null
              }
              if (data?.user) return null
              return error?.message || '登录失败'
            }
            // 非邮箱：走本地账号
          } catch {
            /* 云端失败回退本地 */
          }
        }
      }

      // 本地账号登录
      const all = await listAccounts()
      const user = all.find((a) => a.username.toLowerCase() === uname.toLowerCase())
      if (!user) return '账号不存在'
      if (!user.salt || !user.passwordHash) return '该账号为云端账号，请用邮箱登录'
      const hash = await hashPassword(password, user.salt)
      if (hash !== user.passwordHash) return '密码错误'
      markAuthenticated(user.id)
      setAccount(user)
      setAccounts(all)
      setSettings(loadSettings(user.id))
      setDataVersion((v) => v + 1)
      return null
    },
    [supabaseReady, supabaseCfg],
  )

  const register = useCallback(
    async (username: string, displayName: string, password: string) => {
      const uname = username.trim()
      if (!uname) return '请输入用户名或邮箱'
      if (uname.length < 2) return '用户名至少 2 个字符'
      if (password.length < 6) return '密码至少 6 位'

      // 含 @：注册到 Supabase（跨设备）
      if (uname.includes('@') && supabaseReady) {
        const sb = getSupabase(supabaseCfg)
        if (sb) {
          const { data, error } = await sb.auth.signUp({
            email: uname.toLowerCase(),
            password,
            options: {
              data: {
                username: uname.toLowerCase().split('@')[0],
                displayName: displayName.trim() || uname.toLowerCase().split('@')[0],
              },
            },
          })
          if (!error && data?.session?.user) {
            const user = data.session.user
            const uid = `sb:${user.id}`
            const acc: Account = {
              id: uid,
              username: uname.toLowerCase(),
              displayName: displayName.trim() || user.email || uname,
              source: 'supabase',
              createdAt: Date.now(),
            }
            await saveAccount(acc)
            markAuthenticated(uid)
            setAccount(acc)
            setSettings({ ...DEFAULT_SETTINGS, supabaseUrl: supabaseCfg.url, supabasePublishableKey: supabaseCfg.publishableKey })
            setAccounts(await listAccounts())
            setDataVersion((v) => v + 1)
            return null
          }
          // signUp 可能要求邮箱确认
          if (!error && data?.user && !data?.session) {
            return '注册成功，请查收邮件确认后，再用邮箱登录'
          }
          return error?.message || '注册失败'
        }
      }

      // 本地账号注册
      if (uname.includes('@')) {
        return '未配置云端，请用普通用户名注册（不含 @）'
      }
      const all = await listAccounts()
      if (all.some((a) => a.username.toLowerCase() === uname.toLowerCase())) return '该用户名已存在'
      const salt = randomSalt()
      const passwordHash = await hashPassword(password, salt)
      const acc: Account = {
        id: genId(),
        username: uname,
        displayName: displayName.trim() || uname,
        salt,
        passwordHash,
        source: 'local',
        createdAt: Date.now(),
      }
      await saveAccount(acc)
      setAccounts([...all, acc])
      markAuthenticated(acc.id)
      setAccount(acc)
      setSettings({ ...DEFAULT_SETTINGS, supabaseUrl: supabaseCfg.url, supabasePublishableKey: supabaseCfg.publishableKey })
      setDataVersion((v) => v + 1)
      return null
    },
    [supabaseReady, supabaseCfg],
  )

  const logout = useCallback(async () => {
    // 若当前是 Supabase 账号，登出云端会话并确保本地 token 清除
    if (supabaseReady) {
      try {
        const sb = getSupabase(supabaseCfg)
        await sb?.auth.signOut()
      } catch {
        /* ignore */
      }
    }
    localStorage.setItem(LOGGED_OUT_KEY, '1')
    localStorage.removeItem(CURRENT_KEY)
    setAccount(null)
  }, [supabaseReady, supabaseCfg])

  const switchAccount = useCallback(async (id: string) => {
    const cur = await getAccount(id)
    if (!cur) return
    markAuthenticated(id)
    setAccount(cur)
    setSettings(loadSettings(cur.id))
    setDataVersion((v) => v + 1)
  }, [])

  const deleteCurrentAccount = useCallback(async () => {
    if (!account) return '未登录'
    await wipeAccount(account.id)
    await deleteAccount(account.id)
    // 云端账号：清空云端数据 + 登出，避免刷新后会话自动恢复复活该账号
    if (account.source === 'supabase' && supabaseReady) {
      void wipeCloudAccount({ url: supabaseCfg.url, anonKey: supabaseCfg.publishableKey }, account.id).catch(
        () => undefined,
      )
      try {
        const sb = getSupabase(supabaseCfg)
        await sb?.auth.signOut()
      } catch {
        /* ignore */
      }
    }
    localStorage.removeItem(SETTINGS_PREFIX + account.id)
    const remaining = (await listAccounts()).filter((a) => a.id !== account.id)
    setAccounts(remaining)
    const next = remaining[0]
    if (next) {
      markAuthenticated(next.id)
      setAccount(next)
      setSettings(loadSettings(next.id))
    } else {
      localStorage.setItem(LOGGED_OUT_KEY, '1')
      localStorage.removeItem(CURRENT_KEY)
      setAccount(null)
    }
    setDataVersion((v) => v + 1)
    return null
  }, [account, supabaseReady, supabaseCfg])

  useEffect(() => {
    const root = document.documentElement
    const mode: ThemeMode = settings.theme
    const dark =
      mode === 'dark' ||
      (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
    root.setAttribute('data-theme', dark ? 'dark' : 'light')
  }, [settings.theme])

  const value = useMemo<AppContextValue>(
    () => ({
      account,
      accounts,
      booting,
      dataVersion,
      bumpData,
      settings,
      saveSettings,
      supabaseUrl: supabaseCfg.url,
      supabasePublishableKey: supabaseCfg.publishableKey,
      supabaseReady,
      saveSupabaseConfig,
      login,
      register,
      logout,
      switchAccount,
      deleteCurrentAccount,
    }),
    [account, accounts, booting, dataVersion, bumpData, settings, saveSettings, supabaseCfg, supabaseReady, saveSupabaseConfig, login, register, logout, switchAccount, deleteCurrentAccount],
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}