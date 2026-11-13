grant delete on public.mutirao_mentoria_events to authenticated;

create policy "Equipe aprovada apaga eventos"
on public.mutirao_mentoria_events for delete to authenticated
using ((select exists (
  select 1 from public.mutirao_mentoria_members where user_id = (select auth.uid())
)));
