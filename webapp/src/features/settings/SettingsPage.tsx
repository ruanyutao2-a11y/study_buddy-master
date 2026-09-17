import { useState } from 'react'
import { useApp } from '../../store/appContext'
import { testAiConnection } from '../../lib/ai'
import { NORMAL_SYSTEM_PROMPT, SOCRATIC_SYSTEM_PROMPT } from '../../lib/prompts'
import { BRAND } from '../../lib/brand'
import { normalizeSupabaseUrl, getSupabase } from '../../lib/supabase'
import type { ThemeMode } from '../../lib/types'

export function SettingsPage() {
  const {
    account,
    settings,
    saveSettings,
    deleteCurrentAccount,
    supabaseUrl,
    supabasePublishableKey,
    saveSupabaseConfig,
  } = useApp()

  const [baseUrl, setBaseUrl] = useState(settings.llmBaseUrl)
  const [apiKey, setApiKey] = useState(settings.llmApiKey)
  const [model, setModel] = useState(settings.llmModel)
  const [systemPrompt, setSystemPrompt] = useState(settings.systemPrompt)
  const [sbUrl, setSbUrl] = useState(supabaseUrl)
  const [sbKey, setSbKey] = useState(supabasePublishableKey)
  const [sbTip, setSbTip] = useState('')
  const [sbTest, setSbTest] = useState('')
  const [sbTesting, setSbTesting] = useState(false)
  const [savedTip, setSavedTip] = useState('')
  const [testResult, setTestResult] = useState('')
  const [testing, setTesting] = useState(false)

  if (!account) return null

  const saveSb = () => {
    const url = normalizeSupabaseUrl(sbUrl)
    saveSupabaseConfig(url, sbKey)
    setSbUrl(url)
    setSbTip('已保存')
    setTimeout(() => setSbTip(''), 2000)
  }

  const testSb = async () => {
    setSbTesting(true)
    setSbTest('')
    try {
      const url = normalizeSupabaseUrl(sbUrl)
      const sb = getSupabase({ url, publishableKey: sbKey.trim() })
      if (!sb) throw new Error('请先填写 URL 和 Key')
      await sb.auth.getSession() // 校验配置可达（不强制要求已登录）
      setSbTest('✅ 云端配置可用')
    } catch (e) {
      setSbTest(`❌ 连接失败：${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setSbTesting(false)
    }
  }

  const saveAi = () => {
    saveSettings({ llmBaseUrl: baseUrl.trim(), llmApiKey: apiKey.trim(), llmModel: model.trim(), systemPrompt })
    setSavedTip('已保存')
    setTimeout(() => setSavedTip(''), 2000)
  }

  const runTest = async () => {
    setTesting(true)
    setTestResult('')
    try {
      const reply = await testAiConnection({
        baseUrl: baseUrl.trim(),
        apiKey: apiKey.trim(),
        model: model.trim(),
      })
      setTestResult(`✅ 连接成功：${reply}`)
    } catch (e) {
      setTestResult(`❌ 连接失败：${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setTesting(false)
    }
  }

  const setTheme = (t: ThemeMode) => saveSettings({ theme: t })

  const handleDeleteAccount = async () => {
    if (!window.confirm(`确定删除账号「${account.displayName}」及其全部数据吗？此操作不可撤销。`)) return
    const err = await deleteCurrentAccount()
    if (err) window.alert(err)
  }

  return (
    <div className="container page" style={{ maxWidth: 720 }}>
      <div className="page-head">
        <div>
          <div className="page-title">设置</div>
          <div className="page-sub">AI 配置、外观与账号管理</div>
        </div>
      </div>

      <div className="card settings-section">
        <div className="settings-section-title">🤖 AI 配置</div>
        <div className="field">
          <label className="label">接口地址（Base URL）</label>
          <input
            className="input"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="https://api.deepseek.com/v1"
          />
          <div className="hint">
            兼容 OpenAI Chat Completions 的接口均可。填 <code>…/v1</code> 结尾的地址，例如
            DeepSeek / Moonshot / Qwen / OpenAI 等。
          </div>
        </div>
        <div className="field">
          <label className="label">API 密钥</label>
          <input
            className="input"
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-…"
            autoComplete="off"
          />
          <div className="hint">密钥仅保存在当前浏览器本地，不上传任何服务器。</div>
        </div>
        <div className="field">
          <label className="label">模型名称</label>
          <input
            className="input"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="例如 deepseek-chat（可留空，使用服务默认）"
          />
        </div>
        <div className="field">
          <label className="label">自定义系统提示词（可留空，使用默认）</label>
          <textarea
            className="textarea"
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            placeholder="留空则使用默认提示词"
            style={{ minHeight: 90 }}
          />
          <div className="hint" style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setSystemPrompt(NORMAL_SYSTEM_PROMPT)}>
              填入默认问答提示词
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setSystemPrompt(SOCRATIC_SYSTEM_PROMPT)}>
              填入默认苏格拉底提示词
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setSystemPrompt('')}>
              清空
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button className="btn btn-primary" onClick={saveAi}>
            保存 AI 配置
          </button>
          <button className="btn" onClick={() => void runTest()} disabled={testing || !baseUrl.trim()}>
            {testing ? '测试中…' : '测试连接'}
          </button>
          {savedTip && <span className="ok-text">{savedTip}</span>}
        </div>
        {testResult && (
          <div className="hint" style={{ marginTop: 10, color: testResult.startsWith('✅') ? 'var(--ok)' : 'var(--seal-deep)' }}>
            {testResult}
          </div>
        )}
      </div>

      <div className="card settings-section">
        <div className="settings-section-title">🎨 外观</div>
        <div className="field">
          <label className="label">主题</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {(['light', 'dark', 'system'] as ThemeMode[]).map((t) => (
              <button
                key={t}
                className={`chip${settings.theme === t ? ' active' : ''}`}
                onClick={() => setTheme(t)}
              >
                {t === 'light' ? '亮色' : t === 'dark' ? '暗色' : '跟随系统'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="card settings-section">
        <div className="settings-section-title">🎯 复习</div>
        <div className="field">
          <label className="label">每日复习上限</label>
          <input
            className="input"
            type="number"
            min={1}
            max={500}
            value={settings.dailyReviewLimit}
            onChange={(e) => saveSettings({ dailyReviewLimit: Math.max(1, Number(e.target.value) || 50) })}
            style={{ maxWidth: 140 }}
          />
          <div className="hint">超过该数量的到期卡会顺延到明天。</div>
        </div>
      </div>

      <div className="card settings-section">
        <div className="settings-section-title">👤 账号</div>
        <div className="field">
          <label className="label">昵称</label>
          <div className="muted">{account.displayName}</div>
        </div>
        <div className="field">
          <label className="label">用户名</label>
          <div className="muted">
            {account.username}
            <span className="tag" style={{ marginLeft: 8 }}>
              {account.source === 'supabase' ? '云端账号' : '本地账号'}
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-danger" onClick={() => void handleDeleteAccount()}>
            删除账号及全部数据
          </button>
        </div>
      </div>

      <div className="card settings-section">
        <div className="settings-section-title">☁️ 云端账号（Supabase）</div>
        <div className="field">
          <label className="label">项目 URL</label>
          <input
            className="input"
            value={sbUrl}
            onChange={(e) => setSbUrl(e.target.value)}
            placeholder="https://xxxx.supabase.co"
          />
        </div>
        <div className="field">
          <label className="label">Publishable / Anon Key</label>
          <input
            className="input"
            type="password"
            value={sbKey}
            onChange={(e) => setSbKey(e.target.value)}
            placeholder="sb_publishable_… 或 eyJ…"
            autoComplete="off"
          />
          <div className="hint">
            去 supabase.com 新建项目，在「Project Settings → API」复制 URL 与 anon key 填入。配置后即用
            邮箱注册/登录，实现跨设备登录与本机数据同步。
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button className="btn btn-primary" onClick={saveSb}>
            保存云端配置
          </button>
          <button className="btn" onClick={() => void testSb()} disabled={sbTesting || !sbUrl.trim()}>
            {sbTesting ? '测试中…' : '测试连接'}
          </button>
          {sbTip && <span className="ok-text">{sbTip}</span>}
        </div>
        {sbTest && (
          <div className="hint" style={{ marginTop: 10, color: sbTest.startsWith('✅') ? 'var(--ok)' : 'var(--seal-deep)' }}>
            {sbTest}
          </div>
        )}
      </div>

      <div className="card settings-section">
        <div className="settings-section-title">ℹ️ 关于</div>
        <div className="muted" style={{ lineHeight: 1.8 }}>
          <b className="serif">{BRAND.name}</b> · {BRAND.tagline}
          <br />
          {BRAND.description}
          <br />
          <span className="faint">数据本地存储（IndexedDB），FSRS-4.5 间隔复习，基于 study_buddy 二次开发。</span>
        </div>
      </div>
    </div>
  )
}
