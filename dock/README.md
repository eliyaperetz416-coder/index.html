# Dock

מרכז פרויקטים אישי: לכל פרויקט השלב שלו והצעד הבא. **שלב 1 מתוך 6:** התחברות עם Google ומסך ריק עם ברכה.

React + Vite, PWA (אפשר להתקין למסך הבית), Firebase (Auth עם Google + Firestore), פריסה ב-Vercel.

## מבנה
```
src/components   כפתור, לוגו, סמל Google
src/pages        Login, Home, Setup (מוצג רק כשחסרים פרטי Firebase)
src/lib          firebase.js (חיבור), auth.js (התחברות/התנתקות)
api/auth-proxy.js  מגיש את דפי ההתחברות של Firebase מהדומיין של האתר (נדרש לאייפון)
firestore.rules  כל משתמש ניגש רק ל-users/{uid}/...
```

## הרצה מקומית
```
cp .env.example .env    # למלא מ-Firebase console
npm install
npm run dev
```
מקומית `VITE_FIREBASE_AUTH_DOMAIN` = `<project-id>.firebaseapp.com`.

## Vercel
- פרויקט `dock`, Root Directory = `dock`. כל push ל-`main` נפרס אוטומטית.
- משתני הסביבה `VITE_FIREBASE_*` מוגדרים ב-Vercel (לא בקוד).
- ב-Vercel `VITE_FIREBASE_AUTH_DOMAIN` = הדומיין של האתר עצמו. `/__/auth/*` מועבר דרך `api/auth-proxy.js` ל-`<project-id>.firebaseapp.com`,
  כי Safari באייפון חוסם את ההתחברות כשהיא רצה על דומיין אחר.
  לכן ב-Google Cloud → Credentials → OAuth client (Web) צריך להוסיף Redirect URI: `https://<הדומיין>/__/auth/handler`.

## כללי Firestore
`firestore.rules` נפרס עם `firebase deploy --only firestore:rules`, או בהדבקה ב-Firebase console → Firestore → Rules.
