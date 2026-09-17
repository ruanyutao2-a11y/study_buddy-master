import { useState, type FormEvent } from 'react'
import { useApp } from '../../store/appContext'
import { BRAND } from '../../lib/brand'

export function AuthPage() {
  const { login, register, supabaseReady } = useApp()
  const [tab, setTab] = useState<'login' | 'register'>('login')
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    const err =
      tab === 'login'
        ? await login(username, password)
        : await register(username, displayName, password)
    setBusy(false)
    if (err) setError(err)
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-brand">
          <div className="brand-seal">时</div>
          <div className="brand-name">{BRAND.name}</div>
        </div>
        <div className="auth-tagline">{BRAND.tagline}</div>

        <div className="auth-tabs">
          <button
            className={`auth-tab${tab === 'login' ? ' active' : ''}`}
            onClick={() => {
              setTab('login')
              setError('')
            }}
          >
            登录
          </button>
          <button
            className={`auth-tab${tab === 'register' ? ' active' : ''}`}
            onClick={() => {
              setTab('register')
              setError('')
            }}
          >
            注册
          </button>
        </div>

        <form onSubmit={submit}>
          {tab === 'register' && (
            <div className="field">
              <label className="label">昵称</label>
              <input
                className="input"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="你的昵称（可选）"
              />
            </div>
          )}
          <div className="field">
            <label className="label">{supabaseReady ? '用户名 / 邮箱' : '用户名'}</label>
            <input
              className="input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={supabaseReady ? '邮箱可跨设备登录，用户名仅本机' : '用户名'}
              autoComplete="username"
              required
            />
            <div className="hint">
              {supabaseReady
                ? '填邮箱（如 a@b.com）注册到云端，任意设备都能登录并同步数据。'
                : '云端未配置，账号仅保存在当前浏览器。'}
            </div>
          </div>
          <div className="field">
            <label className="label">密码</label>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="密码"
              autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
              required
            />
          </div>
          <button className="btn btn-primary btn-block" disabled={busy}>
            {busy ? '处理中…' : tab === 'login' ? '登录' : '注册并开始学习'}
          </button>
          <div className="auth-error">{error}</div>
        </form>

        <div className="auth-note">
          {supabaseReady
            ? '已接入云端账号：用邮箱注册/登录，即可跨设备同步。普通用户名注册的账号仍为本地账号（仅本机）。'
            : '本地账号：数据仅保存在当前浏览器，不上传。要跨设备登录，请先在「设置 → 云端账号」填入 Supabase 的 URL 与 Key。'}
        </div>
      </div>
    </div>
  )
}
