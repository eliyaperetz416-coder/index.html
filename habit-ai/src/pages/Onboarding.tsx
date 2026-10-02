import { useState } from 'react'
import { useT, setLang } from '../i18n'
import { update, uid, dateKey } from '../store'
import { APP_NAME } from '../config'

const GOALS = ['fitness', 'social', 'appearance', 'focus']

export default function Onboarding() {
  const { t, lang } = useT()
  const [step, setStep] = useState(0)
  const [goals, setGoals] = useState<string[]>([])
  const [wake, setWake] = useState('07:00')
  const [main, setMain] = useState('')
  const last = 3

  const finish = () =>
    update(s => {
      const names = [main.trim(), ...goals.map(g => t('h.' + g))].filter(Boolean)
      return {
        ...s, onboarded: true, goals, wake, mainHabit: main.trim(),
        habits: names.map(name => ({ id: uid(), name, created: dateKey() })),
      }
    })
  const ok = step === 0 ? true : step === 1 ? goals.length > 0 : step === 2 ? !!wake : true

  return (
    <div className="screen onb">
      <div className="brand">{APP_NAME}</div>
      <div className="dots">{[0, 1, 2, 3].map(i => <i key={i} className={i <= step ? 'on' : ''} />)}</div>
      <div className="onb-body">
        {step === 0 && (<>
          <h1>{t('ob.lang')}</h1>
          <div className="opts">
            {(['en', 'he'] as const).map(l => (
              <button key={l} className={'opt' + (lang === l ? ' sel' : '')} onClick={() => setLang(l)}>
                {l === 'en' ? 'English' : 'עברית'}
              </button>
            ))}
          </div>
        </>)}
        {step === 1 && (<>
          <h1>{t('ob.goals')}</h1><p className="muted">{t('ob.goals.sub')}</p>
          <div className="opts">
            {GOALS.map(g => (
              <button key={g} className={'opt' + (goals.includes(g) ? ' sel' : '')}
                onClick={() => setGoals(goals.includes(g) ? goals.filter(x => x !== g) : [...goals, g])}>
                {t('goal.' + g)}
              </button>
            ))}
          </div>
        </>)}
        {step === 2 && (<>
          <h1>{t('ob.wake')}</h1>
          <input type="time" value={wake} onChange={e => setWake(e.target.value)} />
        </>)}
        {step === 3 && (<>
          <h1>{t('ob.main')}</h1>
          <input value={main} placeholder={t('ob.main.ph')} onChange={e => setMain(e.target.value)} />
          <p className="hint">{t('habits.tiny')}</p>
        </>)}
      </div>
      <div className="row">
        {step > 0 && <button className="btn ghost" onClick={() => setStep(step - 1)}>{t('ob.back')}</button>}
        <button className="btn" disabled={!ok} onClick={() => (step === last ? finish() : setStep(step + 1))}>
          {step === last ? t('ob.finish') : t('ob.next')}
        </button>
      </div>
    </div>
  )
}
