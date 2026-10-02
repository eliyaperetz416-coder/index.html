import { useState } from 'react'
import { useT } from '../i18n'
import { askAI, type AiError } from '../ai'
import { resizeImage, b64 } from './image'
import { addPhoto } from './gallery'
import { isSensitive } from './safety'
import { physiquePrompt, outfitPrompt } from './prompts'
import AiNotice from '../AiNotice'

export default function AiPhotoView({ kind }: { kind: 'physique' | 'outfit' }) {
  const { t, lang } = useT()
  const [note, setNote] = useState('')
  const [img, setImg] = useState('')
  const [out, setOut] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<AiError | null>(null)
  const [saved, setSaved] = useState(false)

  const pick = async (f?: File) => { if (f) { setImg(await resizeImage(f)); setOut(''); setSaved(false); setErr(null) } }
  const go = async () => {
    if (kind === 'physique' && isSensitive(note)) return setOut(t('scan.sensitive'))
    setBusy(true); setErr(null)
    const L = lang === 'he' ? 'Hebrew' : 'English'
    const r = await askAI({
      kind: 'scan', system: kind === 'physique' ? physiquePrompt(L) : outfitPrompt(L), image: b64(img),
      messages: [{ role: 'user', content: note.trim() || 'Please give feedback on this photo.' }],
    })
    setBusy(false)
    'error' in r ? setErr(r.error) : setOut(r.text)
  }
  return (
    <>
      <AiNotice />
      <p className="hint">☁️ {t('scan.cloud')}</p>
      <label className="btn block">{t('scan.photo')}
        <input hidden type="file" accept="image/*" onChange={e => { pick(e.target.files?.[0]); e.target.value = '' }} /></label>
      {img && (<>
        <img className="preview" src={img} alt="" />
        <input value={note} placeholder={t('scan.note')} onChange={e => setNote(e.target.value)} />
        <div className="row"><button className="btn" disabled={busy} onClick={go}>{busy ? '…' : t('scan.go')}</button>
          {kind === 'physique' && <button className="btn ghost" disabled={saved} onClick={() => { addPhoto(img); setSaved(true) }}>{saved ? t('gal.saved') : t('gal.save')}</button>}</div>
      </>)}
      {err && err !== 'not_configured' && <p className="hint center">{t('ai.err.' + err)}</p>}
      {out && <section className="card"><div className="muted">{t('scan.feedback')}</div><p className="pre">{out}</p><p className="hint">{t('scan.subjective')}</p></section>}
    </>
  )
}
