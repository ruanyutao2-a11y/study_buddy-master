// Supabase 云端账号接入（跨设备登录 + 数据同步）。
// 使用 Publishable key（新式 API key，由用户按需配置）。

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export interface SupabaseConfig {
  url: string
  publishableKey: string
}

export function normalizeSupabaseUrl(url: string): string {
  let u = (url || '').trim().replace(/\/+$/, '')
  if (!u) return ''
  if (!/^https?:\/\//i.test(u)) u = 'https://' + u
  return u
}

export function isSupabaseConfigured(cfg: SupabaseConfig): boolean {
  return Boolean(cfg.url && cfg.publishableKey)
}

let clientCache: SupabaseClient | null = null
let clientCacheKey = ''

export function getSupabase(cfg: SupabaseConfig): SupabaseClient | null {
  const url = normalizeSupabaseUrl(cfg.url)
  if (!url || !cfg.publishableKey) return null
  const key = `${url}|${cfg.publishableKey}`
  if (clientCache && clientCacheKey === key) return clientCache
  clientCacheKey = key
  clientCache = createClient(url, cfg.publishableKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  })
  return clientCache
}

export function resetSupabaseClient(): void {
  clientCache = null
  clientCacheKey = ''
}