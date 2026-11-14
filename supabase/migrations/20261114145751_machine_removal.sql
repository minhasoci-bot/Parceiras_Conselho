grant delete on public.mutirao_mentoria_machines to authenticated;

create policy "Equipe aprovada apaga máquinas"
on public.mutirao_mentoria_machines for delete to authenticated
using ((select exists (
  select 1 from public.mutirao_mentoria_members where user_id = (select auth.uid())
)));
