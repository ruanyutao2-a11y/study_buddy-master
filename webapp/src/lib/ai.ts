// OpenAI 兼容接口的流式调用客户端（Chat Completions + SSE）

export interface AiConfig {
  baseUrl: string
  apiKey: string
  model: string
}

export interface ChatTurn {
  role: 'system' | 'user' | 'assistant'
  content: string
}

// 归一化接口地址：支持输入 …/v1、…/v1/chat/completions 或裸域名。
export function chatEndpoint(baseUrl: string): string {
  let b = (baseUrl || '').trim().replace(/\/+$/, '')
  if (!b) return ''
  if (b.endsWith('/chat/completions')) return b
  if (!/\/v\d+$/.test(b)) b += '/v1'
  return `${b}/chat/completions`
}

export async function streamChat(
  cfg: AiConfig,
  turns: ChatTurn[],
  onDelta: (text: string) => void,
  signal?: AbortSignal,
): Promise<void> {
  const endpoint = chatEndpoint(cfg.baseUrl)
  if (!endpoint) throw new Error('请先在「设置 → AI 配置」填写接口地址')

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify({
      model: cfg.model || undefined,
      messages: turns,
      stream: true,
      temperature: 0.7,
    }),
    signal,
  })

  if (!res.ok || !res.body) {
    let detail = ''
    try {
      const t = await res.text()
      detail = t.slice(0, 400)
    } catch {
      /* ignore */
    }
    throw new Error(`请求失败（HTTP ${res.status}）${detail ? '：' + detail : ''}`)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed.startsWith('data:')) continue
      const data = trimmed.slice(5).trim()
      if (data === '[DONE]') return
      try {
        const json = JSON.parse(data)
        const delta =
          json?.choices?.[0]?.delta?.content ?? json?.choices?.[0]?.text ?? ''
        if (delta) onDelta(delta)
      } catch {
        /* 忽略无法解析的流式行 */
      }
    }
  }
}

// 连通性测试：发送一次极小的非流式请求。
export async function testAiConnection(cfg: AiConfig): Promise<string> {
  const endpoint = chatEndpoint(cfg.baseUrl)
  if (!endpoint) throw new Error('请先填写接口地址')
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify({
      model: cfg.model || undefined,
      messages: [{ role: 'user', content: '请回复两个字：连通' }],
      stream: false,
      max_tokens: 8,
    }),
  })
  if (!res.ok) {
    let detail = ''
    try {
      detail = (await res.text()).slice(0, 300)
    } catch {
      /* ignore */
    }
    throw new Error(`HTTP ${res.status}${detail ? '：' + detail : ''}`)
  }
  const json = await res.json()
  return json?.choices?.[0]?.message?.content ?? '（已连通）'
}
