create table public.mutirao_mentoria_event_copy_references (
  template_code text primary key,
  source_code text not null unique,
  source_url text not null
);

alter table public.mutirao_mentoria_event_copy_references enable row level security;
revoke all on public.mutirao_mentoria_event_copy_references from public, anon, authenticated;
grant select on public.mutirao_mentoria_event_copy_references to authenticated;

create policy "Equipe aprovada lê referências de copy"
on public.mutirao_mentoria_event_copy_references for select to authenticated
using ((select exists (
  select 1 from public.mutirao_mentoria_members where user_id = (select auth.uid())
)));
