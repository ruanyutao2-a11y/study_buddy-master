import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { deleteAccount, getAccount, listAccounts, saveAccount, wipeAccount } from '../lib/data'
import { hashPassword, randomSalt } from '../lib/crypto'
import { genId } from '../lib/idb'
import { DEFAULT_SETTINGS, type Account, type Settings, type ThemeMode } from '../lib/types'

const CURRENT_KEY = 'shixi:currentAccountId'
const SETTINGS_PREFIX = 'shixi:settings:'

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

  const bumpData = useCallback(() => setDataVersion((v) => v + 1), [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const all = await listAccounts()
        if (cancelled) return
        setAccounts(all)
        const id = localStorage.getItem(CURRENT_KEY)
        let cur = id ? all.find((a) => a.id === id) : undefined
        if (!cur && all.length > 0) cur = all[0]
        if (cur) setSettings(loadSettings(cur.id))
        setAccount(cur ?? null)
      } finally {
        if (!cancelled) setBooting(false)
      }
    })()
    return () => {
      cancelled = true
    }
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

  const login = useCallback(async (username: string, password: string) => {
    const all = await listAccounts()
    const user = all.find((a) => a.username.toLowerCase() === username.trim().toLowerCase())
    if (!user) return '账号不存在'
    const hash = await hashPassword(password, user.salt)
    if (hash !== user.passwordHash) return '密码错误'
    localStorage.setItem(CURRENT_KEY, user.id)
    setAccount(user)
    setAccounts(all)
    setSettings(loadSettings(user.id))
    setDataVersion((v) => v + 1)
    return null
  }, [])

  const register = useCallback(
    async (username: string, displayName: string, password: string) => {
      const uname = username.trim()
      if (!uname) return '请输入用户名'
      if (uname.length < 2) return '用户名至少 2 个字符'
      if (password.length < 4) return '密码至少 4 位'
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
        createdAt: Date.now(),
      }
      await saveAccount(acc)
      setAccounts([...all, acc])
      localStorage.setItem(CURRENT_KEY, acc.id)
      setAccount(acc)
      setSettings({ ...DEFAULT_SETTINGS })
      setDataVersion((v) => v + 1)
      return null
    },
    [],
  )

  const logout = useCallback(() => {
    localStorage.removeItem(CURRENT_KEY)
    setAccount(null)
  }, [])

  const switchAccount = useCallback(async (id: string) => {
    const cur = await getAccount(id)
    if (!cur) return
    localStorage.setItem(CURRENT_KEY, id)
    setAccount(cur)
    setSettings(loadSettings(cur.id))
    setDataVersion((v) => v + 1)
  }, [])

  const deleteCurrentAccount = useCallback(async () => {
    if (!account) return '未登录'
    await wipeAccount(account.id)
    await deleteAccount(account.id)
    localStorage.removeItem(SETTINGS_PREFIX + account.id)
    const remaining = (await listAccounts()).filter((a) => a.id !== account.id)
    setAccounts(remaining)
    const next = remaining[0]
    if (next) {
      localStorage.setItem(CURRENT_KEY, next.id)
      setAccount(next)
      setSettings(loadSettings(next.id))
    } else {
      localStorage.removeItem(CURRENT_KEY)
      setAccount(null)
    }
    setDataVersion((v) => v + 1)
    return null
  }, [account])

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
      login,
      register,
      logout,
      switchAccount,
      deleteCurrentAccount,
    }),
    [account, accounts, booting, dataVersion, bumpData, settings, saveSettings, login, register, logout, switchAccount, deleteCurrentAccount],
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
