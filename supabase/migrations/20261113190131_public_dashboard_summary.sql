-- O resumo público devolve somente contagens e totais, sem os registros do painel.
create function mutirao_private.dashboard_summary()
returns jsonb
language sql stable security definer
set search_path = ''
as $$
  with dashboard as (
    select data from public.mutirao_mentoria_dashboard where id = 1
  ), settings as (
    select case when data ->> 'default_plan' = '1y' then '1y' else '6m' end as default_plan,
           data -> 'member_plans' as member_plans,
           data -> 'sales' as sales
    from (select (select data from dashboard) as data) configuration
  ), member_plans as (
    select case s.member_plans ->> lower(btrim(coalesce(r.email, u.email, 'Participante')))
             when '6m' then '6m'
             when '1y' then '1y'
             else s.default_plan
           end as plan
    from public.mutirao_mentoria_members m
    left join auth.users u on u.id = m.user_id
    left join public.mutirao_mentoria_access_requests r on r.user_id = m.user_id
    cross join settings s
  ), sales as (
    select sale.amount, sale.status, sale.date
    from settings s
    cross join lateral jsonb_to_recordset(coalesce(s.sales, '[]'::jsonb))
      as sale(amount bigint, status text, date text)
  )
  select jsonb_build_object(
    'defaultPlan', (select default_plan from settings),
    'plans', (
      select jsonb_build_object(
        '6m', count(*) filter (where plan = '6m'),
        '1y', count(*) filter (where plan = '1y')
      ) from member_plans
    ),
    'received', coalesce(sum(amount) filter (where status = 'recebido' and date <= '2026-11-30'), 0),
    'pipeline', coalesce(sum(amount) filter (where status = 'fechado' and date <= '2026-11-30'), 0),
    'late', coalesce(sum(amount) filter (where status = 'recebido' and date > '2026-11-30'), 0)
  )
  from sales;
$$;

create function public.mutirao_mentoria_dashboard_summary()
returns jsonb
language sql stable security invoker
set search_path = ''
as $$ select mutirao_private.dashboard_summary(); $$;

revoke all on function mutirao_private.dashboard_summary(), public.mutirao_mentoria_dashboard_summary()
  from public, anon, authenticated;
grant execute on function mutirao_private.dashboard_summary(), public.mutirao_mentoria_dashboard_summary()
  to anon, authenticated;
