// Serves Firebase's sign-in pages from this site's own domain (/__/auth/*).
// iPhone Safari and installed home-screen apps block the cross-site storage that
// Google sign-in needs when it runs on <project>.firebaseapp.com, so we proxy it here.
// The project id comes from the environment, never from code.
export const config = { runtime: 'edge' };

const HOP = ['host', 'connection', 'content-length', 'accept-encoding', 'x-forwarded-host'];

export default async function handler(req) {
  const projectId = process.env.VITE_FIREBASE_PROJECT_ID;
  if (!projectId) return new Response('Missing VITE_FIREBASE_PROJECT_ID', { status: 500 });

  const url = new URL(req.url);
  const path = (url.searchParams.get('path') || '').replace(/[^\w./-]/g, '');
  url.searchParams.delete('path');
  const qs = url.searchParams.toString();
  const target = `https://${projectId}.firebaseapp.com/__/auth/${path}${qs ? `?${qs}` : ''}`;

  const headers = new Headers(req.headers);
  HOP.forEach((h) => headers.delete(h));

  const upstream = await fetch(target, {
    method: req.method,
    headers,
    body: req.method === 'GET' || req.method === 'HEAD' ? undefined : req.body,
    redirect: 'manual',
  });

  const out = new Headers(upstream.headers);
  out.delete('content-encoding');
  out.delete('content-length');
  return new Response(upstream.body, { status: upstream.status, headers: out });
}
