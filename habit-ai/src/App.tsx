import { useEffect } from 'react'
import { HashRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom'
import { I18nProvider, useT } from './i18n'
import { useStore } from './store'
import { maybeRemind } from './remind'
import Settings from './pages/Settings'
import Onboarding from './pages/Onboarding'
import Home from './pages/Home'
import Habits from './pages/Habits'
import Progress from './pages/Progress'
import Review from './pages/Review'
import Coach from './pages/Coach'
import Scan from './pages/Scan'

const TABS = [['/', 'home', '🏠'], ['/habits', 'habits', '✅'], ['/coach', 'coach', '💬'], ['/scan', 'scan', '📷'], ['/progress', 'progress', '📈']]

function Shell() {
  const { t } = useT()
  const onboarded = useStore(s => s.onboarded)
  const st = useStore(s => s)
  useEffect(() => {
    const go = () => document.visibilityState === 'visible' && maybeRemind(st, t('remind.title'), t('remind.body'))
    go(); const id = setInterval(go, 60000)
    document.addEventListener('visibilitychange', go)
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', go) }
  }, [st, t])
  if (!onboarded) return <main><Onboarding /></main>
  return (
    <HashRouter>
      <main><Routes>
        <Route path="/" element={<Home />} />
        <Route path="/habits" element={<Habits />} />
        <Route path="/coach" element={<Coach />} />
        <Route path="/scan" element={<Scan />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/review" element={<Review />} />
        <Route path="/progress" element={<Progress />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes></main>
      <nav className="tabs">
        {TABS.map(([to, k, ic]) => (
          <NavLink key={to} to={to} end>
            <i>{ic}</i><span>{t('tab.' + k)}</span>
          </NavLink>
        ))}
      </nav>
    </HashRouter>
  )
}
export default function App() { return <I18nProvider><Shell /></I18nProvider> }
