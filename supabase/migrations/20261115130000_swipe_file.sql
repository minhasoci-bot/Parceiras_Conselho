create table public.mutirao_mentoria_swipe_items (
  id uuid primary key default gen_random_uuid(),
  url text not null check (char_length(btrim(url)) between 5 and 500),
  title text not null check (char_length(btrim(title)) between 1 and 180),
  format text not null default 'carrossel' check (format in ('carrossel', 'video', 'estatico', 'outro')),
  category text not null default 'geral',
  author text not null default '',
  caption text not null default '',
  notes text not null default '',
  thumbnail_url text not null default '',
  likes integer not null default 0,
  comments integer not null default 0,
  shares integer not null default 0,
  views integer not null default 0,
  revision integer not null default 0 check (revision >= 0),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) default auth.uid()
);

alter table public.mutirao_mentoria_swipe_items enable row level security;
revoke all on public.mutirao_mentoria_swipe_items from public, anon, authenticated;
grant select, insert, update, delete on public.mutirao_mentoria_swipe_items to authenticated;

create policy "Equipe aprovada lê swipe items"
on public.mutirao_mentoria_swipe_items for select to authenticated
using ((select exists (
  select 1 from public.mutirao_mentoria_members where user_id = (select auth.uid())
)));

create policy "Equipe aprovada cria swipe items"
on public.mutirao_mentoria_swipe_items for insert to authenticated
with check ((select exists (
  select 1 from public.mutirao_mentoria_members where user_id = (select auth.uid())
)));

create policy "Equipe aprovada atualiza swipe items"
on public.mutirao_mentoria_swipe_items for update to authenticated
using ((select exists (
  select 1 from public.mutirao_mentoria_members where user_id = (select auth.uid())
)))
with check ((select exists (
  select 1 from public.mutirao_mentoria_members where user_id = (select auth.uid())
)));

create policy "Equipe aprovada apaga swipe items"
on public.mutirao_mentoria_swipe_items for delete to authenticated
using ((select exists (
  select 1 from public.mutirao_mentoria_members where user_id = (select auth.uid())
)));
