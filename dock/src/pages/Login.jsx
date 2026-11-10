import { useState } from 'react';
import Button from '../components/Button';
import GoogleMark from '../components/GoogleMark';
import Logo from '../components/Logo';
import { signInWithGoogle, errorMessage } from '../lib/auth';

export default function Login({ initialError }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(initialError ? errorMessage(initialError) : null);

  async function handleClick() {
    setError(null);
    setLoading(true);
    try {
      await signInWithGoogle();
    } catch (e) {
      setError(errorMessage(e));
      setLoading(false);
    }
  }

  return (
    <main className="screen screen-login fade-in">
      <div className="brand">
        <Logo />
        <h1>Dock</h1>
        <p className="muted">כל הפרויקטים שלך, והצעד הבא של כל אחד.</p>
      </div>
      <div className="actions">
        {error ? (
          <p className="error" role="alert">
            {error}
          </p>
        ) : null}
        <Button onClick={handleClick} loading={loading}>
          <GoogleMark />
          התחבר עם Google
        </Button>
      </div>
    </main>
  );
}
