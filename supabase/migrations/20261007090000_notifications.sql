-- Etapp 4: notiser. Push-prenumerationer, kö-trigger för chatt, pg_cron + pg_net
-- som anropar Edge Function send-notifications.

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Push-prenumerationer
-- ---------------------------------------------------------------------------

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  resident_id uuid not null references public.residents (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

create index push_subscriptions_resident_id_idx on public.push_subscriptions (resident_id);

alter table public.push_subscriptions enable row level security;

create policy "push_subscriptions_select_own" on public.push_subscriptions
  for select to authenticated using (resident_id = (select auth.uid()));
create policy "push_subscriptions_insert_own" on public.push_subscriptions
  for insert to authenticated with check (resident_id = (select auth.uid()));
create policy "push_subscriptions_update_own" on public.push_subscriptions
  for update to authenticated
  using (resident_id = (select auth.uid()))
  with check (resident_id = (select auth.uid()));
create policy "push_subscriptions_delete_own" on public.push_subscriptions
  for delete to authenticated using (resident_id = (select auth.uid()));

-- notification_settings: insert saknas för boende som skapats innan triggern fanns.
create policy "notification_settings_insert_own" on public.notification_settings
  for insert to authenticated with check (resident_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Intern konfiguration (schema private är inte åtkomligt via API:et)
-- ---------------------------------------------------------------------------

create schema if not exists private;

create table private.config (
  key text primary key,
  value text not null
);

-- Hemligheten genereras i databasen och lämnar aldrig repot.
insert into private.config (key, value) values
  ('cron_secret', encode(extensions.gen_random_bytes(32), 'hex')),
  ('functions_url', 'https://sbnafogvwkxaqrjzmzhe.supabase.co/functions/v1');

-- Läses av Edge Functions via service role (bara den rollen får köra funktionen).
create function public.internal_config(p_key text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select value from private.config where key = p_key;
$$;

revoke all on function public.internal_config(text) from public, anon, authenticated;
grant execute on function public.internal_config(text) to service_role;

-- Anropar send-notifications. Används av pg_cron och triggers.
create function private.call_send_notifications()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
begin
  select value into v_url from private.config where key = 'functions_url';
  select value into v_secret from private.config where key = 'cron_secret';
  perform net.http_post(
    url := v_url || '/send-notifications',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', v_secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Chattnotiser: köa en rad per mottagare när ett meddelande skrivs
-- ---------------------------------------------------------------------------

create function public.queue_chat_notifications()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sender public.residents;
begin
  select * into v_sender from public.residents where id = new.resident_id;
  insert into public.notification_queue (resident_id, type, payload)
  select r.id, 'chat_message',
    jsonb_build_object(
      'message_id', new.id,
      'sender_name', v_sender.name,
      'body', left(new.body, 200)
    )
  from public.residents r
  join public.notification_settings s on s.resident_id = r.id
  where r.id <> new.resident_id
    and s.chat;
  return new;
end;
$$;

create trigger on_message_created
  after insert on public.messages
  for each row execute function public.queue_chat_notifications();

-- När något hamnar i kön: be funktionen skicka direkt (en gång per sats).
create function public.notify_queue_changed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.call_send_notifications();
  return null;
end;
$$;

create trigger on_notification_queued
  after insert on public.notification_queue
  for each statement execute function public.notify_queue_changed();

-- ---------------------------------------------------------------------------
-- Påminnelser: pass som börjar inom en timme
-- ---------------------------------------------------------------------------

-- Returnerar bokningar som ska påminnas om nu (en timme innan) och inte redan påmints.
-- p_now kan sättas i tester. Bara service role.
create function public.due_reminders(p_now timestamptz default now())
returns table (
  booking_id uuid,
  apartment_id uuid,
  date date,
  slot smallint,
  starts_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select b.id, b.apartment_id, b.date, b.slot, public.slot_start(b.date, b.slot)
  from public.bookings b
  where b.reminder_sent_at is null
    and public.slot_start(b.date, b.slot) > p_now
    and public.slot_start(b.date, b.slot) <= p_now + interval '60 minutes';
$$;

revoke all on function public.due_reminders(timestamptz) from public, anon, authenticated;
grant execute on function public.due_reminders(timestamptz) to service_role;

-- Var 10:e minut: skicka påminnelser och eventuella köade notiser som inte gått iväg.
select cron.schedule(
  'send-notifications',
  '*/10 * * * *',
  $$select private.call_send_notifications()$$
);

-- Städa pg_net-loggen så den inte växer (behåller en vecka).
select cron.schedule(
  'cleanup-net-log',
  '0 3 * * *',
  $$delete from net._http_response where created < now() - interval '7 days'$$
);
