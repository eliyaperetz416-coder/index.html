// Single AI endpoint. Keys live in env only (Vercel project settings), never in the client.
// Env: AI_PROVIDER=anthropic|gemini, ANTHROPIC_API_KEY, GEMINI_API_KEY, AI_MODEL (optional), AI_DAILY_LIMIT (default 30)
type Req = { method?: string; body?: any; headers: Record<string, string | string[] | undefined> }
type Res = { status(n: number): Res; json(b: unknown): void }
type Msg = { role: 'user' | 'assistant'; content: string }

const provider = () => (process.env.AI_PROVIDER || 'anthropic').toLowerCase()
const key = () => (provider() === 'gemini' ? process.env.GEMINI_API_KEY : process.env.ANTHROPIC_API_KEY)
const model = () => process.env.AI_MODEL || (provider() === 'gemini' ? 'gemini-2.5-flash' : 'claude-haiku-4-5-20251001')
const MAX_TOKENS = { chat: 400, scan: 600 }
const LIMIT = +(process.env.AI_DAILY_LIMIT || 30)

// Loose server-side cap: in-memory per IP/day (resets on cold start; the client keeps the real counter)
const hits = new Map<string, number>()
function allowed(ip: string) {
  const k = ip + new Date().toISOString().slice(0, 10)
  const n = (hits.get(k) || 0) + 1
  if (hits.size > 5000) hits.clear()
  hits.set(k, n)
  return n <= LIMIT * 2
}

async function callAnthropic(system: string, msgs: Msg[], image: string | undefined, max: number) {
  const messages: any[] = msgs.map(m => ({ role: m.role, content: m.content }))
  if (image) {
    const last = messages[messages.length - 1]
    last.content = [
      { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: image } },
      { type: 'text', text: last.content },
    ]
  }
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': key()!, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: model(), max_tokens: max, system, messages }),
  })
  const j = await r.json()
  if (!r.ok) throw new Error(j?.error?.message || 'provider error')
  return (j.content || []).map((c: any) => c.text || '').join('')
}

async function callGemini(system: string, msgs: Msg[], image: string | undefined, max: number) {
  const contents: any[] = msgs.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }))
  if (image) contents[contents.length - 1].parts.unshift({ inlineData: { mimeType: 'image/jpeg', data: image } })
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model()}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': key()! },
    body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents, generationConfig: { maxOutputTokens: max } }),
  })
  const j = await r.json()
  if (!r.ok) throw new Error(j?.error?.message || 'provider error')
  return (j.candidates?.[0]?.content?.parts || []).map((p: any) => p.text || '').join('')
}

export default async function handler(req: Req, res: Res) {
  if (req.method === 'GET') return res.status(200).json({ configured: !!key(), provider: provider() })
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' })
  if (!key()) return res.status(503).json({ error: 'not_configured' })
  const ip = String(req.headers['x-forwarded-for'] || 'x').split(',')[0].trim()
  if (!allowed(ip)) return res.status(429).json({ error: 'limit' })

  const b = req.body || {}
  const kind: 'chat' | 'scan' = b.kind === 'scan' ? 'scan' : 'chat'
  const system = String(b.system || '').slice(0, 4000)
  const msgs: Msg[] = (Array.isArray(b.messages) ? b.messages : []).slice(-8)
    .map((m: any) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content || '').slice(0, 2000) }))
  if (!msgs.length || msgs[msgs.length - 1].role !== 'user') return res.status(400).json({ error: 'bad_request' })
  const image = typeof b.image === 'string' && b.image.length < 1_500_000 ? b.image : undefined // base64 jpeg, no data: prefix
  try {
    const call = provider() === 'gemini' ? callGemini : callAnthropic
    const text = await call(system, msgs, kind === 'scan' ? image : undefined, MAX_TOKENS[kind])
    res.status(200).json({ text })
  } catch (e) {
    res.status(502).json({ error: 'provider', detail: (e as Error).message.slice(0, 200) })
  }
}
