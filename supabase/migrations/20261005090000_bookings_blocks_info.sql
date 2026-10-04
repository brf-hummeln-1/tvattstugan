-- Etapp 2: bokningar, blockeringar, info-sida och bokningsreglerna som RPC.
-- All tid räknas i Europe/Stockholm.

-- ---------------------------------------------------------------------------
-- Tabeller
-- ---------------------------------------------------------------------------

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  apartment_id uuid not null references public.apartments (id) on delete cascade,
  resident_id uuid not null references public.residents (id) on delete cascade,
  date date not null,
  slot smallint not null check (slot between 1 and 4),
  reminder_sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (date, slot)
);

create index bookings_apartment_id_idx on public.bookings (apartment_id);
create index bookings_resident_id_idx on public.bookings (resident_id);

create table public.blocks (
  id uuid primary key default gen_random_uuid(),
  start_date date not null,
  end_date date not null check (end_date >= start_date),
  slot smallint check (slot between 1 and 4), -- null = hela dagen
  reason text not null check (length(trim(reason)) between 1 and 200),
  created_by uuid references public.residents (id) on delete set null,
  created_at timestamptz not null default now()
);

create index blocks_dates_idx on public.blocks (start_date, end_date);

create table public.info_page (
  id smallint primary key default 1 check (id = 1),
  content text not null default '',
  updated_at timestamptz not null default now(),
  updated_by uuid references public.residents (id) on delete set null
);

-- Kö för notiser som skickas av Edge Functions (etapp 4). Bara service role läser den.
create table public.notification_queue (
  id bigint generated always as identity primary key,
  resident_id uuid not null references public.residents (id) on delete cascade,
  type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create index notification_queue_unsent_idx on public.notification_queue (created_at) where sent_at is null;

insert into public.info_page (id, content) values (1, $md$
# Regler för tvättstugan

- Tvättstugan bokas i appen. Fyra pass per dag: 10–13, 13–16, 16–19 och 19–22.
- Varje lägenhet kan ha **en** bokad tid åt gången. När passet är klart kan du boka nästa.
- Du kan boka upp till en månad framåt.
- En bokad tid som inte har börjat användas inom **30 minuter** från passets start får användas av någon annan.
- Avboka i appen om du inte ska använda din tid, så kan grannarna boka den.
- Lämna tvättstugan städad: torka av maskinerna, rensa luddfiltret i torktumlaren och ta med dina saker.
- Frågor? Hör av dig till styrelsen.
$md$);

-- ---------------------------------------------------------------------------
-- Tidsfunktioner (Europe/Stockholm)
-- ---------------------------------------------------------------------------

create function public.stockholm_today()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'Europe/Stockholm')::date;
$$;

-- Pass 1 börjar 10:00, pass 2 13:00, pass 3 16:00, pass 4 19:00 lokal tid.
create function public.slot_start(p_date date, p_slot int)
returns timestamptz
language sql
immutable
set search_path = ''
as $$
  select (p_date::timestamp + make_interval(hours => 7 + 3 * p_slot)) at time zone 'Europe/Stockholm';
$$;

create function public.slot_end(p_date date, p_slot int)
returns timestamptz
language sql
immutable
set search_path = ''
as $$
  select (p_date::timestamp + make_interval(hours => 10 + 3 * p_slot)) at time zone 'Europe/Stockholm';
$$;

create function public.is_slot_blocked(p_date date, p_slot int)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.blocks b
    where p_date between b.start_date and b.end_date
      and (b.slot is null or b.slot = p_slot)
  );
$$;

grant execute on function public.stockholm_today(), public.slot_start(date, int), public.slot_end(date, int), public.is_slot_blocked(date, int) to authenticated;

-- ---------------------------------------------------------------------------
-- Interna hjälpfunktioner (inte anropbara från klienten)
-- ---------------------------------------------------------------------------

-- Lägenhetens aktiva bokning: slutar i framtiden.
create function public.active_booking_for(p_apartment_id uuid)
returns public.bookings
language sql
stable
set search_path = ''
as $$
  select b.* from public.bookings b
  where b.apartment_id = p_apartment_id
    and public.slot_end(b.date, b.slot) > now()
  order by b.date, b.slot
  limit 1;
$$;

revoke all on function public.active_booking_for(uuid) from public;

-- Gemensam validering + insert. Förutsätter att lägenhetens rad redan är låst.
create function public.insert_booking_checked(
  p_apartment_id uuid,
  p_resident_id uuid,
  p_date date,
  p_slot int
)
returns public.bookings
language plpgsql
set search_path = ''
as $$
declare
  v_today date := public.stockholm_today();
  v_last date := (public.stockholm_today() + interval '1 month')::date;
  v_booking public.bookings;
begin
  if p_slot is null or p_slot < 1 or p_slot > 4 then
    raise exception 'Ogiltigt pass' using errcode = 'P0001';
  end if;
  if p_date is null or p_date < v_today then
    raise exception 'Datumet har passerat' using errcode = 'P0001';
  end if;
  if p_date > v_last then
    raise exception 'Du kan bara boka till och med %', to_char(v_last, 'YYYY-MM-DD') using errcode = 'P0001';
  end if;
  if public.slot_end(p_date, p_slot) <= now() then
    raise exception 'Passet har redan slutat' using errcode = 'P0001';
  end if;
  if public.is_slot_blocked(p_date, p_slot) then
    raise exception 'Passet är spärrat' using errcode = 'P0001';
  end if;
  if (public.active_booking_for(p_apartment_id)).id is not null then
    raise exception 'Lägenheten har redan en aktiv bokning' using errcode = 'P0001';
  end if;

  begin
    insert into public.bookings (apartment_id, resident_id, date, slot)
    values (p_apartment_id, p_resident_id, p_date, p_slot)
    returning * into v_booking;
  exception when unique_violation then
    raise exception 'Passet är redan bokat' using errcode = 'P0001';
  end;

  return v_booking;
end;
$$;

revoke all on function public.insert_booking_checked(uuid, uuid, date, int) from public;

-- ---------------------------------------------------------------------------
-- RPC: boka, avboka, flytta
-- ---------------------------------------------------------------------------

-- Boka ett pass. Admin kan ange annan lägenhet, övriga bokar för sin egen.
create function public.book_slot(p_date date, p_slot int, p_apartment_id uuid default null)
returns public.bookings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller public.residents;
  v_apartment_id uuid;
begin
  select * into v_caller from public.residents where id = (select auth.uid());
  if v_caller.id is null then
    raise exception 'Inte inloggad' using errcode = 'P0001';
  end if;

  v_apartment_id := coalesce(p_apartment_id, v_caller.apartment_id);
  if v_apartment_id is null then
    raise exception 'Du är inte kopplad till någon lägenhet. Kontakta styrelsen.' using errcode = 'P0001';
  end if;
  if v_apartment_id <> v_caller.apartment_id and not v_caller.is_admin then
    raise exception 'Du kan bara boka för din egen lägenhet' using errcode = 'P0001';
  end if;

  -- Lås lägenheten så att två samtidiga anrop inte kan ge två bokningar.
  perform 1 from public.apartments where id = v_apartment_id for update;
  if not found then
    raise exception 'Lägenheten finns inte' using errcode = 'P0001';
  end if;

  return public.insert_booking_checked(v_apartment_id, v_caller.id, p_date, p_slot);
end;
$$;

-- Avboka. Alla boende i lägenheten får avboka lägenhetens bokning, admin får avboka allas.
create function public.cancel_booking(p_booking_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller public.residents;
  v_booking public.bookings;
begin
  select * into v_caller from public.residents where id = (select auth.uid());
  if v_caller.id is null then
    raise exception 'Inte inloggad' using errcode = 'P0001';
  end if;

  select * into v_booking from public.bookings where id = p_booking_id for update;
  if v_booking.id is null then
    raise exception 'Bokningen finns inte längre' using errcode = 'P0001';
  end if;
  if v_booking.apartment_id is distinct from v_caller.apartment_id and not v_caller.is_admin then
    raise exception 'Du kan bara avboka din egen lägenhets bokning' using errcode = 'P0001';
  end if;

  delete from public.bookings where id = p_booking_id;
end;
$$;

-- Flytta = avboka och boka nytt i samma transaktion. Misslyckas det nya passet behålls det gamla.
create function public.move_booking(p_booking_id uuid, p_date date, p_slot int)
returns public.bookings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller public.residents;
  v_booking public.bookings;
begin
  select * into v_caller from public.residents where id = (select auth.uid());
  if v_caller.id is null then
    raise exception 'Inte inloggad' using errcode = 'P0001';
  end if;

  select * into v_booking from public.bookings where id = p_booking_id for update;
  if v_booking.id is null then
    raise exception 'Bokningen finns inte längre' using errcode = 'P0001';
  end if;
  if v_booking.apartment_id is distinct from v_caller.apartment_id and not v_caller.is_admin then
    raise exception 'Du kan bara flytta din egen lägenhets bokning' using errcode = 'P0001';
  end if;
  if v_booking.date = p_date and v_booking.slot = p_slot then
    raise exception 'Bokningen ligger redan på det passet' using errcode = 'P0001';
  end if;

  perform 1 from public.apartments where id = v_booking.apartment_id for update;

  delete from public.bookings where id = p_booking_id;
  -- Fel här rullar tillbaka raderingen ovan.
  return public.insert_booking_checked(v_booking.apartment_id, v_caller.id, p_date, p_slot);
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: blockeringar (bara admin)
-- ---------------------------------------------------------------------------

-- Spärrar pass/dag/intervall. Bokningar som ännu inte passerat tas bort och
-- de som bokade får en notis med anledningen (via notification_queue).
create function public.create_block(p_start_date date, p_end_date date, p_slot int, p_reason text)
returns public.blocks
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller public.residents;
  v_block public.blocks;
  v_removed record;
begin
  select * into v_caller from public.residents where id = (select auth.uid());
  if v_caller.id is null or not v_caller.is_admin then
    raise exception 'Bara admin kan spärra pass' using errcode = 'P0001';
  end if;
  if p_slot is not null and (p_slot < 1 or p_slot > 4) then
    raise exception 'Ogiltigt pass' using errcode = 'P0001';
  end if;
  if p_end_date < p_start_date then
    raise exception 'Slutdatum måste vara samma som eller efter startdatum' using errcode = 'P0001';
  end if;
  if length(trim(coalesce(p_reason, ''))) = 0 then
    raise exception 'Ange en anledning' using errcode = 'P0001';
  end if;

  insert into public.blocks (start_date, end_date, slot, reason, created_by)
  values (p_start_date, p_end_date, p_slot, trim(p_reason), v_caller.id)
  returning * into v_block;

  for v_removed in
    delete from public.bookings b
    where b.date between p_start_date and p_end_date
      and (p_slot is null or b.slot = p_slot)
      and public.slot_end(b.date, b.slot) > now()
    returning b.id, b.apartment_id, b.resident_id, b.date, b.slot
  loop
    -- Notis till alla boende i lägenheten (inte bara den som bokade).
    insert into public.notification_queue (resident_id, type, payload)
    select r.id, 'booking_cancelled_by_block',
      jsonb_build_object(
        'date', v_removed.date,
        'slot', v_removed.slot,
        'reason', trim(p_reason),
        'booked_by', v_removed.resident_id
      )
    from public.residents r
    where r.apartment_id = v_removed.apartment_id;
  end loop;

  return v_block;
end;
$$;

revoke all on function public.book_slot(date, int, uuid), public.cancel_booking(uuid), public.move_booking(uuid, date, int), public.create_block(date, date, int, text) from public;
grant execute on function public.book_slot(date, int, uuid), public.cancel_booking(uuid), public.move_booking(uuid, date, int), public.create_block(date, date, int, text) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.bookings enable row level security;
alter table public.blocks enable row level security;
alter table public.info_page enable row level security;
alter table public.notification_queue enable row level security;

-- Bokningar: alla inloggade ser alla (namn + lägenhet visas). Ändras bara via RPC.
create policy "bookings_select" on public.bookings
  for select to authenticated using (true);

-- Blockeringar: alla ser, skapas via RPC, admin tar bort.
create policy "blocks_select" on public.blocks
  for select to authenticated using (true);
create policy "blocks_delete_admin" on public.blocks
  for delete to authenticated using ((select public.is_admin()));

-- Info-sidan: alla läser, admin redigerar.
create policy "info_page_select" on public.info_page
  for select to authenticated using (true);
create policy "info_page_update_admin" on public.info_page
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- notification_queue: inga policies för authenticated, bara service role.

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------

alter publication supabase_realtime add table public.bookings, public.blocks, public.info_page;
