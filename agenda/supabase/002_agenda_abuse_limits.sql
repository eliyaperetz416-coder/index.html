-- Agenda: limits against abuse of the anonymous "create account" path. Additive; touches only agenda_* objects.
--  * at most `max_new_per_hour` brand-new accounts per hour (global), so a script cannot fill the table in one go
--  * total cap raised 500 -> 2000
--  * a nightly cleanup removes junk: accounts that were created, never updated (version 1), idle 30+ days and have no
--    push subscription. A real user is not harmed: their device still has the data and simply re-creates the account.
-- Existing accounts are never throttled.

create table if not exists public.agenda_creations (at timestamptz not null default now());
create index if not exists agenda_creations_at on public.agenda_creations (at);
alter table public.agenda_creations enable row level security;
revoke all on public.agenda_creations from anon, authenticated;

insert into public.agenda_config (key, value) values ('max_new_per_hour', '30') on conflict (key) do nothing;
update public.agenda_config set value = '2000' where key = 'max_users' and value = '500';

create or replace function public.agenda_push(p_key text, p_base bigint, p_data jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare h text := public.agenda_hash(p_key); r public.agenda_users; n int;
begin
  if p_data is null or jsonb_typeof(p_data) <> 'object' then raise exception 'bad_data'; end if;
  if octet_length(p_data::text) > 1000000 then raise exception 'too_big'; end if;
  select * into r from public.agenda_users where key_hash = h for update;
  if not found then
    select count(*) into n from public.agenda_users;
    if n >= coalesce((select value::int from public.agenda_config where key = 'max_users'), 2000) then raise exception 'full'; end if;
    select count(*) into n from public.agenda_creations where at > now() - interval '1 hour';
    if n >= coalesce((select value::int from public.agenda_config where key = 'max_new_per_hour'), 30) then raise exception 'busy'; end if;
    insert into public.agenda_creations default values;
    insert into public.agenda_users (key_hash, data, version) values (h, p_data, 1);
    return jsonb_build_object('ok', true, 'version', 1);
  end if;
  if coalesce(p_base, 0) <> r.version then
    return jsonb_build_object('ok', false, 'conflict', true, 'version', r.version);
  end if;
  update public.agenda_users set data = p_data, version = r.version + 1, updated_at = now() where key_hash = h;
  return jsonb_build_object('ok', true, 'version', r.version + 1);
end $$;
revoke all on function public.agenda_push(text, bigint, jsonb) from public;
grant execute on function public.agenda_push(text, bigint, jsonb) to anon, authenticated;

create or replace function public.agenda_cleanup() returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from public.agenda_creations where at < now() - interval '2 days';
  delete from public.agenda_users u
   where u.version = 1 and u.updated_at < now() - interval '30 days'
     and not exists (select 1 from public.agenda_push_subs s where s.key_hash = u.key_hash);
end $$;
revoke all on function public.agenda_cleanup() from public, anon, authenticated;

select cron.schedule('agenda-cleanup', '17 3 * * *', 'select public.agenda_cleanup()');
