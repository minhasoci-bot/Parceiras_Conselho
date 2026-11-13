-- Lista os cenários salvos para qualquer visitante, só para leitura.
-- Vendas, equipe e demais dados do painel continuam restritos aos membros.
create function mutirao_private.public_scenarios()
returns jsonb
language sql stable security definer
set search_path = ''
as $$
  select coalesce(data -> 'scenarios', '[]'::jsonb)
  from public.mutirao_mentoria_dashboard
  where id = 1;
$$;

create function public.mutirao_mentoria_public_scenarios()
returns jsonb
language sql stable security invoker
set search_path = ''
as $$ select coalesce(mutirao_private.public_scenarios(), '[]'::jsonb); $$;

revoke all on function mutirao_private.public_scenarios(), public.mutirao_mentoria_public_scenarios()
  from public, anon, authenticated;
grant execute on function mutirao_private.public_scenarios(), public.mutirao_mentoria_public_scenarios()
  to anon, authenticated;
