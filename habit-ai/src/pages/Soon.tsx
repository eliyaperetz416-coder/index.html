import { useT, setLang } from '../i18n'
import AiNotice from '../AiNotice'

export default function Soon({ k }: { k: 'coach' | 'scan' }) {
  const { t, lang } = useT()
  return (
    <div className="screen">
      <header className="top"><h1>{t('tab.' + k)}</h1>
        <button className="btn sm ghost" onClick={() => setLang(lang === 'en' ? 'he' : 'en')}>{lang === 'en' ? 'עברית' : 'EN'}</button></header>
      <AiNotice />
      <section className="card center"><h2>{t('soon')}</h2><p className="muted">{t('soon.' + k)}</p></section>
    </div>
  )
}
