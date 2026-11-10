import { isConfigured } from './lib/firebase';
import { useAuth } from './lib/auth';
import Login from './pages/Login';
import Home from './pages/Home';
import Setup from './pages/Setup';

function AuthedApp() {
  const { user, error } = useAuth();
  if (user === undefined) return <main className="screen" aria-busy="true" />;
  return user ? <Home key="home" user={user} /> : <Login key="login" initialError={error} />;
}

export default function App() {
  return isConfigured ? <AuthedApp /> : <Setup />;
}
