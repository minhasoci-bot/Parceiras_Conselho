-- Migração: Sistema de aprovação de acesso e administração do Mutirão da Mentoria

-- 1. Tabela de administradores
create table if not exists public.mutirao_mentoria_admins (
  user_id uuid primary key references public.mutirao_mentoria_members(user_id) on delete cascade
);

-- 2. Tabela de solicitações de acesso
create table if not exists public.mutirao_mentoria_access_requests (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null default '',
  requested_at timestamptz not null default now(),
  approved_at timestamptz
);

alter table public.mutirao_mentoria_admins enable row level security;
alter table public.mutirao_mentoria_access_requests enable row level security;

revoke all on public.mutirao_mentoria_admins, public.mutirao_mentoria_access_requests from public, anon, authenticated;
grant select on public.mutirao_mentoria_admins to authenticated;
grant select on public.mutirao_mentoria_access_requests to authenticated;

-- Políticas de segurança (RLS)
drop policy if exists "Admin consulta o próprio papel" on public.mutirao_mentoria_admins;
create policy "Admin consulta o próprio papel"
on public.mutirao_mentoria_admins for select to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "Conta consulta sua solicitação e admin consulta a fila" on public.mutirao_mentoria_access_requests;
create policy "Conta consulta sua solicitação e admin consulta a fila"
on public.mutirao_mentoria_access_requests for select to authenticated
using (
  user_id = (select auth.uid())
  or (select exists (select 1 from public.mutirao_mentoria_admins where user_id = (select auth.uid())))
);

create schema if not exists mutirao_private;
revoke all on schema mutirao_private from public, anon, authenticated;
grant usage on schema mutirao_private to anon, authenticated;

-- 3. Função para solicitar acesso ao painel (chamada pelo usuário após login)
create or replace function mutirao_private.request_access()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  uemail text;
begin
  if uid is null then
    return;
  end if;

  if exists (select 1 from public.mutirao_mentoria_members where user_id = uid) then
    return;
  end if;

  select email into uemail from auth.users where id = uid and email_confirmed_at is not null;
  if uemail is null or uemail = '' then
    raise insufficient_privilege using message = 'Confirme seu e-mail antes de solicitar acesso.';
  end if;

  insert into public.mutirao_mentoria_access_requests (user_id, email, requested_at, approved_at)
  values (uid, uemail, now(), null)
  on conflict (user_id) do nothing;
end;
$$;

-- 4. Função para o administrador aprovar solicitação
create or replace function mutirao_private.approve_access(applicant_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.mutirao_mentoria_admins where user_id = (select auth.uid())
  ) then
    raise insufficient_privilege using message = 'Apenas administradores podem aprovar solicitações.';
  end if;

  perform 1 from public.mutirao_mentoria_access_requests
    where user_id = applicant_id and approved_at is null
    for update;
  if not found then return false; end if;

  insert into public.mutirao_mentoria_members (user_id)
  values (applicant_id) on conflict (user_id) do nothing;

  update public.mutirao_mentoria_access_requests
    set approved_at = now() where user_id = applicant_id;
  return true;
end;
$$;

-- 5. Função para o administrador recusar solicitação
create or replace function mutirao_private.reject_access(applicant_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.mutirao_mentoria_admins where user_id = (select auth.uid())
  ) then
    raise insufficient_privilege using message = 'Apenas administradores podem recusar solicitações.';
  end if;

  delete from public.mutirao_mentoria_access_requests
    where user_id = applicant_id and approved_at is null;
  return true;
end;
$$;

-- 6. Função para listar os membros aprovados
create or replace function mutirao_private.list_members()
returns table (
  user_id uuid,
  email text,
  is_admin boolean,
  joined_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    m.user_id,
    coalesce(r.email, u.email, 'Participante')::text as email,
    exists (select 1 from public.mutirao_mentoria_admins a where a.user_id = m.user_id) as is_admin,
    coalesce(r.approved_at, u.created_at, now()) as joined_at
  from public.mutirao_mentoria_members m
  left join auth.users u on u.id = m.user_id
  left join public.mutirao_mentoria_access_requests r on r.user_id = m.user_id
  where exists (
    select 1 from public.mutirao_mentoria_members caller where caller.user_id = (select auth.uid())
  )
  order by is_admin desc, joined_at asc;
$$;

-- 7. Função para o administrador remover membro
create or replace function mutirao_private.remove_member(target_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.mutirao_mentoria_admins where user_id = (select auth.uid())
  ) then
    raise insufficient_privilege using message = 'Apenas administradores podem gerenciar participantes.';
  end if;

  if target_user_id = (select auth.uid()) then
    raise exception 'Você não pode remover seu próprio acesso de administrador.';
  end if;

  delete from public.mutirao_mentoria_admins where user_id = target_user_id;
  delete from public.mutirao_mentoria_members where user_id = target_user_id;
  delete from public.mutirao_mentoria_access_requests where user_id = target_user_id;
  return true;
end;
$$;

-- 8. Contagem pública de participantes aprovados
create or replace function mutirao_private.team_count()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer from public.mutirao_mentoria_members;
$$;

-- 9. Expor apenas as funções de entrada pela API; as funções que ignoram RLS ficam em um esquema privado.
create or replace function public.mutirao_mentoria_request_access()
returns void
language sql volatile security invoker
set search_path = ''
as $$ select mutirao_private.request_access(); $$;

revoke all on function mutirao_private.request_access() from public, anon, authenticated;
revoke all on function public.mutirao_mentoria_request_access() from public, anon, authenticated;
grant execute on function mutirao_private.request_access() to authenticated;
grant execute on function public.mutirao_mentoria_request_access() to authenticated;

create or replace function public.mutirao_mentoria_approve_access(applicant_id uuid)
returns boolean
language sql volatile security invoker
set search_path = ''
as $$ select mutirao_private.approve_access(applicant_id); $$;

revoke all on function mutirao_private.approve_access(uuid) from public, anon, authenticated;
revoke all on function public.mutirao_mentoria_approve_access(uuid) from public, anon, authenticated;
grant execute on function mutirao_private.approve_access(uuid) to authenticated;
grant execute on function public.mutirao_mentoria_approve_access(uuid) to authenticated;

create or replace function public.mutirao_mentoria_reject_access(applicant_id uuid)
returns boolean
language sql volatile security invoker
set search_path = ''
as $$ select mutirao_private.reject_access(applicant_id); $$;

revoke all on function mutirao_private.reject_access(uuid) from public, anon, authenticated;
revoke all on function public.mutirao_mentoria_reject_access(uuid) from public, anon, authenticated;
grant execute on function mutirao_private.reject_access(uuid) to authenticated;
grant execute on function public.mutirao_mentoria_reject_access(uuid) to authenticated;

create or replace function public.mutirao_mentoria_list_members()
returns table (user_id uuid, email text, is_admin boolean, joined_at timestamptz)
language sql stable security invoker
set search_path = ''
as $$ select * from mutirao_private.list_members(); $$;

revoke all on function mutirao_private.list_members() from public, anon, authenticated;
revoke all on function public.mutirao_mentoria_list_members() from public, anon, authenticated;
grant execute on function mutirao_private.list_members() to authenticated;
grant execute on function public.mutirao_mentoria_list_members() to authenticated;

create or replace function public.mutirao_mentoria_remove_member(target_user_id uuid)
returns boolean
language sql volatile security invoker
set search_path = ''
as $$ select mutirao_private.remove_member(target_user_id); $$;

revoke all on function mutirao_private.remove_member(uuid) from public, anon, authenticated;
revoke all on function public.mutirao_mentoria_remove_member(uuid) from public, anon, authenticated;
grant execute on function mutirao_private.remove_member(uuid) to authenticated;
grant execute on function public.mutirao_mentoria_remove_member(uuid) to authenticated;

create or replace function public.mutirao_mentoria_team_count()
returns integer
language sql stable security invoker
set search_path = ''
as $$ select mutirao_private.team_count(); $$;

revoke all on function mutirao_private.team_count() from public, anon, authenticated;
revoke all on function public.mutirao_mentoria_team_count() from public, anon, authenticated;
grant execute on function mutirao_private.team_count() to anon, authenticated;
grant execute on function public.mutirao_mentoria_team_count() to anon, authenticated;
