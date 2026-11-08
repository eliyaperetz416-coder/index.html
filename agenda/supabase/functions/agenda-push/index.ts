// Sends due agenda reminders as web push. Called once a minute by the database (public.agenda_tick), and only when
// something is due, with a secret header. Deployed with JWT verification off because the secret header is the check.
// VAPID keys are created on first call and kept in public.agenda_config (not reachable by the app).
import webpush from "npm:web-push@3.6.7";

const BASE = Deno.env.get("SUPABASE_URL")!;
const KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };
const rest = (path: string, init: RequestInit = {}) => fetch(`${BASE}/rest/v1/${path}`, { ...init, headers: { ...H, ...((init.headers as Record<string, string>) ?? {}) } });
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { "Content-Type": "application/json" } });

async function cfg(key: string): Promise<string | null> {
  const j = await (await rest(`agenda_config?key=eq.${key}&select=value`)).json();
  return Array.isArray(j) && j[0] ? j[0].value : null;
}
const b64u = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromB64u = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(s.length / 4) * 4, "=")), (c) => c.charCodeAt(0));

async function vapid(): Promise<{ pub: string; priv: string }> {
  const pub0 = await cfg("vapid_public"), priv0 = await cfg("vapid_private");
  if (pub0 && priv0) return { pub: pub0, priv: priv0 };
  const kp = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const jwk = await crypto.subtle.exportKey("jwk", kp.privateKey);
  const raw = new Uint8Array(65);
  raw[0] = 4; raw.set(fromB64u(jwk.x!), 1); raw.set(fromB64u(jwk.y!), 33);
  const pub = b64u(raw), priv = jwk.d!;
  await rest("agenda_config", { method: "POST", headers: { Prefer: "resolution=merge-duplicates" }, body: JSON.stringify([{ key: "vapid_public", value: pub }, { key: "vapid_private", value: priv }]) });
  return { pub, priv };
}

Deno.serve(async (req) => {
  const secret = await cfg("notify_secret");
  if (!secret || req.headers.get("x-agenda-secret") !== secret) return json({ error: "forbidden" }, 403);
  const body = await req.json().catch(() => ({}));
  const keys = await vapid();
  if (body.init) return json({ ok: true, public: keys.pub });

  // claim every due reminder in one statement (so two overlapping runs can never send the same one twice)
  const now = new Date(), floor = new Date(now.getTime() - 30 * 60 * 1000);
  const claimed = await (await rest(
    `agenda_reminders?sent=eq.false&and=(at.lte.${encodeURIComponent(now.toISOString())},at.gte.${encodeURIComponent(floor.toISOString())})&select=key_hash,rid,title,body,url`,
    { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ sent: true }) },
  )).json();
  if (!Array.isArray(claimed) || !claimed.length) return json({ ok: true, claimed: 0, sent: 0 });

  const hashes = [...new Set(claimed.map((r: { key_hash: string }) => r.key_hash))];
  const subs = await (await rest(`agenda_push_subs?key_hash=in.(${hashes.join(",")})&select=key_hash,endpoint,sub`)).json();
  const byKey = new Map<string, { endpoint: string; sub: webpush.PushSubscription }[]>();
  for (const s of Array.isArray(subs) ? subs : []) byKey.set(s.key_hash, [...(byKey.get(s.key_hash) ?? []), s]);

  webpush.setVapidDetails("https://eliyaperetz416-coder.github.io/index.html/agenda/", keys.pub, keys.priv);
  let sent = 0, dead = 0;
  await Promise.all(claimed.flatMap((r: { key_hash: string; rid: string; title: string; body: string; url: string }) =>
    (byKey.get(r.key_hash) ?? []).map(async (s) => {
      const payload = JSON.stringify({ title: r.title, body: r.body, tag: r.rid, url: r.url || "./" });
      try { await webpush.sendNotification(s.sub, payload, { TTL: 1800, urgency: "high" }); sent++; }
      catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) {
          dead++;
          await rest(`agenda_push_subs?key_hash=eq.${s.key_hash}&endpoint=eq.${encodeURIComponent(s.endpoint)}`, { method: "DELETE" });
        }
      }
    })));
  return json({ ok: true, claimed: claimed.length, sent, dead });
});
