-- Etapp 3: gemensam chatt.

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  resident_id uuid not null references public.residents (id) on delete cascade,
  body text not null check (length(trim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index messages_created_at_idx on public.messages (created_at desc);

alter table public.messages enable row level security;

-- Alla inloggade läser och skriver. Man kan bara skriva i eget namn.
create policy "messages_select" on public.messages
  for select to authenticated using (true);

create policy "messages_insert_own" on public.messages
  for insert to authenticated
  with check (resident_id = (select auth.uid()));

-- Bara admin tar bort meddelanden. Ingen kan redigera.
create policy "messages_delete_admin" on public.messages
  for delete to authenticated using ((select public.is_admin()));

alter publication supabase_realtime add table public.messages;
