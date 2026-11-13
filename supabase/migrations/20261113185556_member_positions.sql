alter table public.mutirao_mentoria_members
  add column position text check (position in ('estrategia', 'comercial', 'design', 'copy', 'video', 'dev'));

-- Mantém os campos existentes e acrescenta o cargo à lista da equipe.
drop function public.mutirao_mentoria_list_members();
drop function mutirao_private.list_members();

create function mutirao_private.list_members()
returns table (user_id uuid, email text, is_admin boolean, joined_at timestamptz, "position" text)
language sql stable security definer
set search_path = ''
as $$
  select
    m.user_id,
    coalesce(r.email, u.email, 'Participante')::text,
    exists (select 1 from public.mutirao_mentoria_admins a where a.user_id = m.user_id),
    coalesce(r.approved_at, u.created_at, now()),
    m.position
  from public.mutirao_mentoria_members m
  left join auth.users u on u.id = m.user_id
  left join public.mutirao_mentoria_access_requests r on r.user_id = m.user_id
  where exists (
    select 1 from public.mutirao_mentoria_members caller where caller.user_id = (select auth.uid())
  )
  order by 3 desc, 4 asc;
$$;

create function public.mutirao_mentoria_list_members()
returns table (user_id uuid, email text, is_admin boolean, joined_at timestamptz, "position" text)
language sql stable security invoker
set search_path = ''
as $$ select * from mutirao_private.list_members(); $$;

create function mutirao_private.set_member_position(target_user_id uuid, new_position text)
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.mutirao_mentoria_admins where user_id = (select auth.uid())
  ) then
    raise insufficient_privilege using message = 'Apenas administradores podem atribuir cargos.';
  end if;

  update public.mutirao_mentoria_members
    set position = new_position where user_id = target_user_id;
  if not found then
    raise no_data_found using message = 'Este participante não faz mais parte da equipe.';
  end if;
end;
$$;

create function public.mutirao_mentoria_set_member_position(target_user_id uuid, new_position text)
returns void
language sql security invoker
set search_path = ''
as $$ select mutirao_private.set_member_position(target_user_id, new_position); $$;

revoke all on function mutirao_private.list_members(), public.mutirao_mentoria_list_members()
  from public, anon, authenticated;
revoke all on function mutirao_private.set_member_position(uuid, text), public.mutirao_mentoria_set_member_position(uuid, text)
  from public, anon, authenticated;
grant execute on function mutirao_private.list_members(), public.mutirao_mentoria_list_members()
  to authenticated;
grant execute on function mutirao_private.set_member_position(uuid, text), public.mutirao_mentoria_set_member_position(uuid, text)
  to authenticated;
