import { HashRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom'
import { I18nProvider, useT } from './i18n'
import { useStore } from './store'
import Onboarding from './pages/Onboarding'
import Home from './pages/Home'
import Habits from './pages/Habits'
import Progress from './pages/Progress'
import Review from './pages/Review'
import Soon from './pages/Soon'

const TABS = [['/', 'home', '🏠'], ['/habits', 'habits', '✅'], ['/coach', 'coach', '💬'], ['/scan', 'scan', '📷'], ['/progress', 'progress', '📈']]

function Shell() {
  const { t } = useT()
  const onboarded = useStore(s => s.onboarded)
  if (!onboarded) return <Onboarding />
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/habits" element={<Habits />} />
        <Route path="/coach" element={<Soon k="coach" />} />
        <Route path="/scan" element={<Soon k="scan" />} />
        <Route path="/review" element={<Review />} />
        <Route path="/progress" element={<Progress />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
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
