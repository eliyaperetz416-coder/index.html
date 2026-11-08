-- Agenda ("סדר יום"): device sync + push reminders.
-- Additive only. Every object is prefixed agenda_ and nothing that already exists is touched.
--
-- Security model (same idea as the Demigod "member token" model, no Supabase Auth needed):
--   * the user's "sync key" is 26 random characters (130 bits), made on the device;
--   * the database only stores sha256(key); the key itself never reaches the server in the clear tables;
--   * all four tables have RLS on and no policies, and anon/authenticated have no table grants:
--     the app can only call the agenda_* functions below, and every one of them needs the key.

create table if not exists public.agenda_users (
  key_hash   text primary key,
  data       jsonb not null default '{}'::jsonb,
  version    bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint agenda_users_size check (octet_length(data::text) <= 1000000)
);

create table if not exists public.agenda_push_subs (
  key_hash   text not null references public.agenda_users(key_hash) on delete cascade,
  endpoint   text not null,
  sub        jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (key_hash, endpoint)
);

create table if not exists public.agenda_reminders (
  key_hash text not null references public.agenda_users(key_hash) on delete cascade,
  rid      text not null,
  at       timestamptz not null,
  title    text not null,
  body     text not null default '',
  url      text not null default '',
  sent     boolean not null default false,
  primary key (key_hash, rid)
);
create index if not exists agenda_reminders_due on public.agenda_reminders (at) where not sent;

create table if not exists public.agenda_config (
  key   text primary key,
  value text not null
);

alter table public.agenda_users     enable row level security;
alter table public.agenda_push_subs enable row level security;
alter table public.agenda_reminders enable row level security;
alter table public.agenda_config    enable row level security;
revoke all on public.agenda_users, public.agenda_push_subs, public.agenda_reminders, public.agenda_config from anon, authenticated;

insert into public.agenda_config (key, value) values
  ('notify_secret', encode(extensions.gen_random_bytes(24), 'hex')),
  ('max_users', '500')
on conflict (key) do nothing;

-- ───────── helpers (not callable by the app) ─────────
create or replace function public.agenda_hash(p_key text) returns text
language plpgsql immutable set search_path = public, extensions as $$
begin
  if p_key is null or p_key !~ '^[A-Z0-9]{20,64}$' then raise exception 'bad_key'; end if;
  return encode(digest(p_key, 'sha256'), 'hex');
end $$;
revoke all on function public.agenda_hash(text) from public, anon, authenticated;

-- ───────── what the app can call ─────────
create or replace function public.agenda_pull(p_key text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare r public.agenda_users;
begin
  select * into r from public.agenda_users where key_hash = public.agenda_hash(p_key);
  if not found then return jsonb_build_object('version', 0, 'data', null); end if;
  return jsonb_build_object('version', r.version, 'data', r.data, 'updated_at', r.updated_at);
end $$;

-- optimistic concurrency: the caller states which version it last saw; if the server moved on, it must pull+merge first
create or replace function public.agenda_push(p_key text, p_base bigint, p_data jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare h text := public.agenda_hash(p_key); r public.agenda_users; n int;
begin
  if p_data is null or jsonb_typeof(p_data) <> 'object' then raise exception 'bad_data'; end if;
  if octet_length(p_data::text) > 1000000 then raise exception 'too_big'; end if;
  select * into r from public.agenda_users where key_hash = h for update;
  if not found then
    select count(*) into n from public.agenda_users;
    if n >= coalesce((select value::int from public.agenda_config where key = 'max_users'), 500) then raise exception 'full'; end if;
    insert into public.agenda_users (key_hash, data, version) values (h, p_data, 1);
    return jsonb_build_object('ok', true, 'version', 1);
  end if;
  if coalesce(p_base, 0) <> r.version then
    return jsonb_build_object('ok', false, 'conflict', true, 'version', r.version);
  end if;
  update public.agenda_users set data = p_data, version = r.version + 1, updated_at = now() where key_hash = h;
  return jsonb_build_object('ok', true, 'version', r.version + 1);
end $$;

-- only real push services are accepted, so the sender (which posts to every saved endpoint) can't be aimed elsewhere
create or replace function public.agenda_save_push(p_key text, p_sub jsonb) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare h text := public.agenda_hash(p_key); ep text;
begin
  perform 1 from public.agenda_users where key_hash = h;
  if not found then raise exception 'no_account'; end if;
  if p_sub is null or jsonb_typeof(p_sub) <> 'object' or not (p_sub ? 'endpoint') or length(p_sub::text) > 2000 then raise exception 'bad_sub'; end if;
  ep := p_sub->>'endpoint';
  if ep is null or ep !~ '^https://(web\.push\.apple\.com|fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|[a-z0-9-]+\.notify\.windows\.com)/' then raise exception 'bad_sub'; end if;
  if (select count(*) from public.agenda_push_subs where key_hash = h and endpoint <> ep) >= 10 then raise exception 'too_many'; end if;
  insert into public.agenda_push_subs (key_hash, endpoint, sub) values (h, ep, p_sub)
    on conflict (key_hash, endpoint) do update set sub = excluded.sub, updated_at = now();
end $$;

create or replace function public.agenda_drop_push(p_key text, p_endpoint text) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  delete from public.agenda_push_subs where key_hash = public.agenda_hash(p_key) and endpoint = p_endpoint;
end $$;

-- replaces this user's pending reminders with the given set. Already-sent ones that did not change stay "sent".
create or replace function public.agenda_set_reminders(p_key text, p_items jsonb) returns int
language plpgsql security definer set search_path = public, extensions as $$
declare h text := public.agenda_hash(p_key); it jsonb; n int := 0; keep text[] := '{}'; v_at timestamptz;
begin
  perform 1 from public.agenda_users where key_hash = h;
  if not found then raise exception 'no_account'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' then raise exception 'bad_items'; end if;
  if jsonb_array_length(p_items) > 800 then raise exception 'too_many'; end if;
  for it in select * from jsonb_array_elements(p_items) loop
    if jsonb_typeof(it) <> 'object' or coalesce(length(it->>'rid'), 0) not between 1 and 80
       or coalesce(length(it->>'title'), 0) not between 1 and 120 then continue; end if;
    begin v_at := (it->>'at')::timestamptz; exception when others then continue; end;
    if v_at is null or v_at < now() - interval '1 day' or v_at > now() + interval '60 days' then continue; end if;
    insert into public.agenda_reminders (key_hash, rid, at, title, body, url)
      values (h, it->>'rid', v_at, left(it->>'title', 120), left(coalesce(it->>'body', ''), 200), left(coalesce(it->>'url', ''), 100))
      on conflict (key_hash, rid) do update set
        sent = case when public.agenda_reminders.at = excluded.at then public.agenda_reminders.sent else false end,
        at = excluded.at, title = excluded.title, body = excluded.body, url = excluded.url;
    keep := keep || (it->>'rid'); n := n + 1;
  end loop;
  delete from public.agenda_reminders where key_hash = h and not sent and not (rid = any (keep));
  delete from public.agenda_reminders where key_hash = h and sent and at < now() - interval '2 days';
  return n;
end $$;

create or replace function public.agenda_vapid() returns text
language sql security definer stable set search_path = public as $$
  select value from public.agenda_config where key = 'vapid_public'
$$;

-- wipes everything stored for this key (privacy: "delete my cloud data")
create or replace function public.agenda_delete_account(p_key text) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  delete from public.agenda_users where key_hash = public.agenda_hash(p_key);
end $$;

revoke all on function public.agenda_pull(text), public.agenda_push(text, bigint, jsonb), public.agenda_save_push(text, jsonb),
  public.agenda_drop_push(text, text), public.agenda_set_reminders(text, jsonb), public.agenda_vapid(), public.agenda_delete_account(text) from public;
grant execute on function public.agenda_pull(text), public.agenda_push(text, bigint, jsonb), public.agenda_save_push(text, jsonb),
  public.agenda_drop_push(text, text), public.agenda_set_reminders(text, jsonb), public.agenda_vapid(), public.agenda_delete_account(text) to anon, authenticated;

-- ───────── scheduler: once a minute, call the sender only if something is due ─────────
create or replace function public.agenda_tick() returns void
language plpgsql security definer set search_path = public as $$
declare s text;
begin
  update public.agenda_reminders set sent = true where not sent and at < now() - interval '30 minutes';   -- too late to be useful
  delete from public.agenda_reminders where sent and at < now() - interval '2 days';
  if exists (select 1 from public.agenda_reminders where not sent and at <= now()) then
    select value into s from public.agenda_config where key = 'notify_secret';
    perform net.http_post(
      url := 'https://szhdasydkoqtbmbrmzpi.supabase.co/functions/v1/agenda-push',
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-agenda-secret', s),
      body := '{}'::jsonb);
  end if;
end $$;
revoke all on function public.agenda_tick() from public, anon, authenticated;

select cron.schedule('agenda-reminders', '* * * * *', 'select public.agenda_tick()');
