-- HomeBoard · delete_account
-- Elimina la cuenta de quien llama. Primero sale de cada hogar (traspasa la propiedad o borra el hogar
-- si queda vacío) y luego borra el usuario; profiles, membresías y suscripciones push caen en cascada.

create or replace function public.delete_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  hid uuid;
begin
  if uid is null then
    raise exception 'no_autenticado' using errcode = 'P0001';
  end if;
  for hid in select household_id from public.household_members where user_id = uid loop
    perform public.leave_household(hid);
  end loop;
  delete from auth.users where id = uid;
end;
$$;

revoke execute on function public.delete_account() from public, anon;
grant execute on function public.delete_account() to authenticated;
