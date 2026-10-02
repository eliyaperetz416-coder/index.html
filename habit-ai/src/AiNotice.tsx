import { useEffect, useState } from 'react'
import { useT } from './i18n'
import { aiConfigured, remaining, getLimit } from './ai'

// Friendly gate: shows a notice when AI isn't configured, else the remaining daily requests.
export default function AiNotice() {
  const { t } = useT()
  const [ok, setOk] = useState<boolean | null>(null)
  useEffect(() => { aiConfigured().then(setOk) }, [])
  if (ok === null) return null
  return ok
    ? <p className="hint center">{t('ai.left', { n: remaining(), max: getLimit() })}</p>
    : <section className="card center"><h2 style={{ justifyContent: 'center' }}>🤖 {t('ai.off')}</h2><p className="muted">{t('ai.off.sub')}</p></section>
}
