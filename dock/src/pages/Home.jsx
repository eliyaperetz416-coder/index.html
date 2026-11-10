import { useState } from 'react';
import Button from '../components/Button';
import { signOut } from '../lib/auth';

export default function Home({ user }) {
  const [loading, setLoading] = useState(false);
  const name = user.displayName?.split(' ')[0] || user.email || '';

  return (
    <main className="screen screen-home fade-in">
      <header className="topbar">
        <h1>שלום, {name}</h1>
      </header>
      <section className="empty" aria-label="פרויקטים" />
      <div className="actions">
        <Button
          variant="ghost"
          loading={loading}
          onClick={() => {
            setLoading(true);
            signOut().catch(() => setLoading(false));
          }}
        >
          התנתקות
        </Button>
      </div>
    </main>
  );
}
