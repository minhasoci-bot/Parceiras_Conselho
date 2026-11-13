create table public.mutirao_mentoria_members (
  user_id uuid primary key references auth.users(id) on delete cascade
);

create table public.mutirao_mentoria_dashboard (
  id integer primary key check (id = 1),
  revision integer not null default 0 check (revision >= 0),
  data jsonb,
  constraint mutirao_mentoria_document check (
    (revision = 0 and data is null)
    or (revision > 0 and data is not null and pg_column_size(data) <= 750000
      and jsonb_typeof(data) = 'object'
      and data ?& array['people', 'sales', 'scenarios']
      and jsonb_typeof(data -> 'people') = 'array'
      and jsonb_typeof(data -> 'sales') = 'array'
      and jsonb_typeof(data -> 'scenarios') = 'array')
  )
);

insert into public.mutirao_mentoria_dashboard (id) values (1);

alter table public.mutirao_mentoria_members enable row level security;
alter table public.mutirao_mentoria_dashboard enable row level security;
revoke all on public.mutirao_mentoria_members from public, anon, authenticated;
revoke all on public.mutirao_mentoria_dashboard from public, anon, authenticated;
grant select on public.mutirao_mentoria_members to authenticated;
grant select on public.mutirao_mentoria_dashboard to authenticated;
grant update (revision, data) on public.mutirao_mentoria_dashboard to authenticated;

create policy "Participante consulta o próprio acesso"
on public.mutirao_mentoria_members for select to authenticated
using (user_id = (select auth.uid()));

create policy "Equipe lê o painel"
on public.mutirao_mentoria_dashboard for select to authenticated
using ((select exists (
  select 1 from public.mutirao_mentoria_members where user_id = (select auth.uid())
)));

create policy "Equipe atualiza o painel"
on public.mutirao_mentoria_dashboard for update to authenticated
using ((select exists (
  select 1 from public.mutirao_mentoria_members where user_id = (select auth.uid())
)))
with check ((select exists (
  select 1 from public.mutirao_mentoria_members where user_id = (select auth.uid())
)));
