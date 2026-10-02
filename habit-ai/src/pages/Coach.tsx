import { useEffect, useRef, useState } from 'react'
import { useT } from '../i18n'
import { useStore, pushChat, clearChat, savePlan, mondayKey } from '../store'
import { askAI, aiConfigured, type AiError } from '../ai'
import { systemPrompt, planPrompt } from '../coachPrompt'
import { canListen, canSpeak, listen, speak, stopSpeaking } from '../voice'
import AiNotice from '../AiNotice'

export default function Coach() {
  const { t, lang } = useT()
  const s = useStore(x => x)
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<AiError | null>(null)
  const [ready, setReady] = useState(false)
  const [mic, setMic] = useState<null | (() => void)>(null)
  const [voice, setVoice] = useState(false)
  const end = useRef<HTMLDivElement>(null)
  useEffect(() => { aiConfigured().then(setReady) }, [])
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }) }, [s.chat.length, busy])
  useEffect(() => () => { stopSpeaking() }, [])

  const send = async (text: string, say = voice) => {
    text = text.trim()
    if (!text || busy) return
    setInput(''); setErr(null); setBusy(true)
    pushChat({ role: 'user', content: text })
    const msgs = [...s.chat, { role: 'user' as const, content: text }].slice(-8) // only last 8 sent
    const r = await askAI({ kind: 'chat', system: systemPrompt(s), messages: msgs })
    setBusy(false)
    if ('error' in r) return setErr(r.error)
    pushChat({ role: 'assistant', content: r.text })
    if (say) speak(r.text, lang)
  }
  const plan = s.plans[mondayKey()]
  const genPlan = async () => {
    setBusy(true); setErr(null)
    const r = await askAI({ kind: 'chat', system: systemPrompt(s), messages: [{ role: 'user', content: planPrompt(s) }] })
    setBusy(false)
    'error' in r ? setErr(r.error) : savePlan(r.text)
  }
  const toggleMic = () => {
    if (mic) { mic(); setMic(null); return }
    setMic(() => listen(lang, txt => { setVoice(true); send(txt, true) }, () => setMic(null)))
  }

  return (
    <div className="screen coach">
      <header className="top"><h1>{t('tab.coach')}</h1>
        <span>
          {canSpeak && <button className={'btn sm ghost' + (voice ? ' on' : '')} onClick={() => { stopSpeaking(); setVoice(!voice) }}>{voice ? '🔊' : '🔈'}</button>}{' '}
          {s.chat.length > 0 && <button className="btn sm ghost" onClick={clearChat}>{t('coach.clear')}</button>}
        </span></header>
      <AiNotice />
      {ready && (
        <section className="card">
          <b>{t('coach.plan')}</b>
          {plan && <p className="pre">{plan}</p>}
          <button className="btn sm ghost" disabled={busy} onClick={genPlan}>{plan ? t('coach.plan.redo') : t('coach.plan.make')}</button>
        </section>
      )}
      <div className="msgs">
        {s.chat.map((m, i) => <div key={i} className={'msg ' + m.role}>{m.content}</div>)}
        {busy && <div className="msg assistant muted">…</div>}
        {err && err !== 'not_configured' && <p className="hint center">{t('ai.err.' + err)}</p>}
        <div ref={end} />
      </div>
      {ready && (
        <form className="chatbar" onSubmit={e => { e.preventDefault(); send(input) }}>
          {canListen && <button type="button" className={'btn ghost mic' + (mic ? ' rec' : '')} onClick={toggleMic}>🎙️</button>}
          <input value={input} placeholder={t('coach.ph')} onChange={e => setInput(e.target.value)} />
          <button className="btn send" disabled={busy || !input.trim()}>↑</button>
        </form>
      )}
    </div>
  )
}
