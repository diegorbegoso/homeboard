-- HomeBoard · leave_household
-- Salir de un hogar. Si quien sale es el dueño y quedan miembros, el miembro más antiguo pasa a ser dueño.
-- Si era la última persona, el hogar se elimina (no queda nadie que pueda ver sus filas).

create or replace function public.leave_household(p_household_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  my_role text;
  next_owner uuid;
begin
  if uid is null then
    raise exception 'no_autenticado' using errcode = 'P0001';
  end if;
  select role into my_role from public.household_members
    where household_id = p_household_id and user_id = uid;
  if my_role is null then
    raise exception 'no_es_miembro' using errcode = 'P0001';
  end if;

  delete from public.household_members where household_id = p_household_id and user_id = uid;
  delete from public.push_subscriptions where household_id = p_household_id and user_id = uid;
  update public.profiles set active_household_id = null
    where id = uid and active_household_id = p_household_id;

  if not exists (select 1 from public.household_members where household_id = p_household_id) then
    delete from public.households where id = p_household_id;
  elsif my_role = 'owner'
    and not exists (select 1 from public.household_members where household_id = p_household_id and role = 'owner') then
    select user_id into next_owner from public.household_members
      where household_id = p_household_id order by joined_at asc limit 1;
    update public.household_members set role = 'owner'
      where household_id = p_household_id and user_id = next_owner;
  end if;
end;
$$;

revoke execute on function public.leave_household(uuid) from public, anon;
grant execute on function public.leave_household(uuid) to authenticated;
