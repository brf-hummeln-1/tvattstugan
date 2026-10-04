-- Etapp 1: lägenheter, boende, notisinställningar och RLS.

create table public.apartments (
  id uuid primary key default gen_random_uuid(),
  label text not null unique check (length(trim(label)) between 1 and 30),
  created_at timestamptz not null default now()
);

create table public.residents (
  id uuid primary key references auth.users (id) on delete cascade,
  apartment_id uuid references public.apartments (id) on delete restrict,
  name text not null check (length(trim(name)) between 1 and 80),
  email text not null unique,
  phone text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create index residents_apartment_id_idx on public.residents (apartment_id);

create table public.notification_settings (
  resident_id uuid primary key references public.residents (id) on delete cascade,
  reminders boolean not null default true,
  chat boolean not null default true
);

-- Skapa standardinställningar när en boende läggs till.
create function public.handle_new_resident()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.notification_settings (resident_id) values (new.id)
  on conflict do nothing;
  return new;
end;
$$;

create trigger on_resident_created
  after insert on public.residents
  for each row execute function public.handle_new_resident();

-- Är den inloggade användaren admin (styrelsen)?
create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select r.is_admin from public.residents r where r.id = (select auth.uid())),
    false
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- RLS
alter table public.apartments enable row level security;
alter table public.residents enable row level security;
alter table public.notification_settings enable row level security;

-- Lägenheter: alla inloggade läser, bara admin ändrar.
create policy "apartments_select" on public.apartments
  for select to authenticated using (true);
create policy "apartments_insert_admin" on public.apartments
  for insert to authenticated with check ((select public.is_admin()));
create policy "apartments_update_admin" on public.apartments
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "apartments_delete_admin" on public.apartments
  for delete to authenticated using ((select public.is_admin()));

-- Boende: alla inloggade ser namn och lägenhet (behövs för att visa vem som bokat).
-- Skapa, ändra och radera görs via Edge Function med service role, inte från klienten.
create policy "residents_select" on public.residents
  for select to authenticated using (true);

-- Notisinställningar: bara egna.
create policy "notification_settings_select_own" on public.notification_settings
  for select to authenticated using (resident_id = (select auth.uid()));
create policy "notification_settings_update_own" on public.notification_settings
  for update to authenticated
  using (resident_id = (select auth.uid()))
  with check (resident_id = (select auth.uid()));
