-- HomeBoard · explicit_table_grants
-- Los proyectos nuevos de Supabase ya no dan privilegios por defecto a anon/authenticated sobre las tablas
-- de public. Sin GRANT, PostgREST responde "permission denied" aunque la política RLS lo permita.
-- RLS sigue siendo la barrera real: estos GRANT solo dejan que las políticas se evalúen.

grant select, update on public.profiles to authenticated;
grant select, update on public.households to authenticated;
grant select on public.household_members to authenticated;
grant select, insert, update on public.shopping_items to authenticated;
grant select, insert, update, delete on public.push_subscriptions to authenticated;

-- El cliente de servicio (push y health) usa estas tablas sin pasar por RLS.
grant all on public.profiles, public.households, public.household_members,
  public.shopping_items, public.push_subscriptions to service_role;
