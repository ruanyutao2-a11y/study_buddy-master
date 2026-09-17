// 日期 / 时长格式化工具

const DAY_MS = 86400000

export function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`
}

export function fmtDate(ts: number): string {
  const d = new Date(ts)
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

export function fmtDateTime(ts: number): string {
  const d = new Date(ts)
  return `${fmtDate(ts)} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

export function fmtTime(ts: number): string {
  const d = new Date(ts)
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

export function fmtDuration(sec: number): string {
  const s = Math.max(0, Math.round(sec))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (h > 0) return `${h} 小时 ${m} 分`
  if (m > 0) return `${m} 分钟`
  return `${s} 秒`
}

export function fmtDurationShort(sec: number): string {
  const s = Math.max(0, Math.round(sec))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const r = Math.floor(s % 60)
  if (h > 0) return `${h}:${pad2(m)}:${pad2(r)}`
  return `${pad2(m)}:${pad2(r)}`
}

export function relativeDue(ts: number, now = Date.now()): string {
  const diff = ts - now
  if (diff <= 0) return '已到期'
  const days = Math.ceil(diff / DAY_MS)
  if (days === 0) return '今天'
  if (days === 1) return '明天'
  if (days < 7) return `${days} 天后`
  if (days < 30) return `${Math.round(days / 7)} 周后`
  if (days < 365) return `${Math.round(days / 30)} 个月后`
  return `${(days / 365).toFixed(1)} 年后`
}

export function dayKey(ts: number): string {
  return fmtDate(ts)
}

export function todayKey(): string {
  return dayKey(Date.now())
}

export function startOfDay(ts: number): number {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}
