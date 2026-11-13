create table public.mutirao_mentoria_events (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 1 and 120),
  event_date date,
  status text not null default 'planejado' check (status in ('planejado', 'em_andamento', 'concluido', 'arquivado')),
  revision integer not null default 0 check (revision >= 0),
  plan jsonb not null default '{"brief":{},"items":[]}'::jsonb,
  created_at timestamptz not null default now(),
  constraint event_plan_shape check (
    jsonb_typeof(plan) = 'object'
    and plan ?& array['brief', 'items']
    and jsonb_typeof(plan -> 'brief') = 'object'
    and jsonb_typeof(plan -> 'items') = 'array'
    and octet_length(plan::text) <= 500000
  )
);

alter table public.mutirao_mentoria_events enable row level security;
revoke all on public.mutirao_mentoria_events from public, anon, authenticated;
grant select on public.mutirao_mentoria_events to authenticated;
grant insert (title, event_date, status, plan) on public.mutirao_mentoria_events to authenticated;
grant update (title, event_date, status, plan, revision) on public.mutirao_mentoria_events to authenticated;

create policy "Equipe aprovada lê eventos"
on public.mutirao_mentoria_events for select to authenticated
using ((select exists (
  select 1 from public.mutirao_mentoria_members where user_id = (select auth.uid())
)));

create policy "Equipe aprovada cria eventos"
on public.mutirao_mentoria_events for insert to authenticated
with check ((select exists (
  select 1 from public.mutirao_mentoria_members where user_id = (select auth.uid())
)));

create policy "Equipe aprovada atualiza eventos"
on public.mutirao_mentoria_events for update to authenticated
using ((select exists (
  select 1 from public.mutirao_mentoria_members where user_id = (select auth.uid())
)))
with check ((select exists (
  select 1 from public.mutirao_mentoria_members where user_id = (select auth.uid())
)));
