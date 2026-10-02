// Client for /api/ai. No keys here. Daily counter is per device (localStorage).
import { dateKey } from './store'

export type AiMsg = { role: 'user' | 'assistant'; content: string }
export type AiError = 'not_configured' | 'limit' | 'network' | 'provider'

const LIMIT_KEY = 'habitai:ailimit', COUNT_KEY = 'habitai:aicount'
const safe = <T,>(f: () => T, d: T): T => { try { return f() } catch { return d } }

export const getLimit = () => safe(() => +(localStorage.getItem(LIMIT_KEY) || 30) || 30, 30)
export const setLimit = (n: number) => safe(() => localStorage.setItem(LIMIT_KEY, String(n)), undefined)
export function used(): number {
  return safe(() => { const [d, n] = (localStorage.getItem(COUNT_KEY) || '').split(':'); return d === dateKey() ? +n : 0 }, 0)
}
export const remaining = () => Math.max(0, getLimit() - used())

let status: Promise<boolean> | null = null
export function aiConfigured(): Promise<boolean> {
  return (status ??= fetch('/api/ai').then(r => r.ok ? r.json() : { configured: false }).then(j => !!j.configured).catch(() => false))
}

export async function askAI(a: { kind: 'chat' | 'scan'; system: string; messages: AiMsg[]; image?: string }): Promise<{ text: string } | { error: AiError }> {
  if (!(await aiConfigured())) return { error: 'not_configured' }
  if (remaining() <= 0) return { error: 'limit' }
  try {
    const r = await fetch('/api/ai', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(a) })
    const j = await r.json().catch(() => ({}))
    if (!r.ok) return { error: (j.error === 'limit' ? 'limit' : j.error === 'not_configured' ? 'not_configured' : 'provider') as AiError }
    safe(() => localStorage.setItem(COUNT_KEY, `${dateKey()}:${used() + 1}`), undefined)
    return { text: j.text || '' }
  } catch { return { error: 'network' } }
}
