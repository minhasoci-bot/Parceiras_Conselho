-- Devolve um único cenário salvo para quem tem o link dele.
-- O identificador é um UUID aleatório; ids curtos não são expostos, para não poderem ser adivinhados.
-- Vendas, equipe e os demais cenários continuam restritos aos membros.
create function mutirao_private.shared_scenario(scenario_id text)
returns jsonb
language sql stable security definer
set search_path = ''
as $$
  select scenario
  from public.mutirao_mentoria_dashboard dashboard
  cross join lateral jsonb_array_elements(coalesce(dashboard.data -> 'scenarios', '[]'::jsonb)) scenario
  where dashboard.id = 1
    and length(scenario_id) >= 32
    and scenario ->> 'id' = scenario_id
  limit 1;
$$;

create function public.mutirao_mentoria_shared_scenario(scenario_id text)
returns jsonb
language sql stable security invoker
set search_path = ''
as $$ select mutirao_private.shared_scenario(scenario_id); $$;

revoke all on function mutirao_private.shared_scenario(text), public.mutirao_mentoria_shared_scenario(text)
  from public, anon, authenticated;
grant execute on function mutirao_private.shared_scenario(text), public.mutirao_mentoria_shared_scenario(text)
  to anon, authenticated;
