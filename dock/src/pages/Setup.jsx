export default function Setup() {
  return (
    <main className="screen fade-in">
      <div className="brand">
        <h1>חסרים פרטי Firebase</h1>
        <p className="muted">
          צריך למלא את המשתנים <code>VITE_FIREBASE_*</code> בקובץ <code>.env</code> (או ב-Vercel) ולבנות מחדש.
        </p>
      </div>
    </main>
  );
}
