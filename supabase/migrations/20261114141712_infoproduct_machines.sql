create table public.mutirao_mentoria_machines (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 1 and 120),
  status text not null default 'rascunho' check (status in ('rascunho', 'validacao', 'no_ar', 'arquivado')),
  revision integer not null default 0 check (revision >= 0),
  plan jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint machine_plan_shape check (jsonb_typeof(plan) = 'object' and octet_length(plan::text) <= 500000)
);

alter table public.mutirao_mentoria_machines enable row level security;
revoke all on public.mutirao_mentoria_machines from public, anon, authenticated;
grant select on public.mutirao_mentoria_machines to authenticated;
grant insert (title, status, plan) on public.mutirao_mentoria_machines to authenticated;
grant update (title, status, plan, revision) on public.mutirao_mentoria_machines to authenticated;

create policy "Equipe aprovada lê máquinas"
on public.mutirao_mentoria_machines for select to authenticated
using ((select exists (
  select 1 from public.mutirao_mentoria_members where user_id = (select auth.uid())
)));

create policy "Equipe aprovada cria máquinas"
on public.mutirao_mentoria_machines for insert to authenticated
with check ((select exists (
  select 1 from public.mutirao_mentoria_members where user_id = (select auth.uid())
)));

create policy "Equipe aprovada atualiza máquinas"
on public.mutirao_mentoria_machines for update to authenticated
using ((select exists (
  select 1 from public.mutirao_mentoria_members where user_id = (select auth.uid())
)))
with check ((select exists (
  select 1 from public.mutirao_mentoria_members where user_id = (select auth.uid())
)));
