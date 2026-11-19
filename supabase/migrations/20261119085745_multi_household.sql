-- HomeBoard · multi_household
-- Un usuario puede crear y pertenecer a varios hogares. El hogar "activo" se guarda en el perfil.

-- ---------- a user may belong to several households
alter table public.household_members drop constraint household_members_user_id_key;
create index household_members_user_idx on public.household_members (user_id);

-- ---------- active household (validated against membership by the app; ignored when not a member)
alter table public.profiles
  add column active_household_id uuid references public.households (id) on delete set null;

-- ---------- push: one row per (device, household) so every household the user belongs to can notify them
alter table public.push_subscriptions drop constraint push_subscriptions_endpoint_key;
alter table public.push_subscriptions
  add constraint push_subscriptions_endpoint_household_key unique (endpoint, household_id);

-- ---------- create / join no longer reject users who already have a household
create or replace function public.create_household(p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  hid uuid;
  code text;
begin
  if uid is null then
    raise exception 'no_autenticado' using errcode = 'P0001';
  end if;
  if p_name is null or char_length(trim(p_name)) not between 1 and 60 then
    raise exception 'nombre_invalido' using errcode = 'P0001';
  end if;
  loop
    code := public.generate_invite_code();
    exit when not exists (select 1 from public.households where invite_code = code);
  end loop;
  insert into public.households (name, invite_code, created_by)
  values (trim(p_name), code, uid)
  returning id into hid;
  insert into public.household_members (household_id, user_id, role) values (hid, uid, 'owner');
  insert into public.push_subscriptions (user_id, household_id, endpoint, p256dh, auth, user_agent)
    select distinct on (endpoint) user_id, hid, endpoint, p256dh, auth, user_agent
    from public.push_subscriptions where user_id = uid
    on conflict do nothing;
  update public.profiles set active_household_id = hid where id = uid;
  return hid;
end;
$$;

create or replace function public.join_household(p_code text)
returns uuid
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
  select id into hid from public.households where invite_code = upper(trim(coalesce(p_code, '')));
  if hid is null then
    raise exception 'codigo_invalido' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.household_members where household_id = hid and user_id = uid) then
    if (select count(*) from public.household_members where household_id = hid) >= 6 then
      raise exception 'hogar_lleno' using errcode = 'P0001';
    end if;
    insert into public.household_members (household_id, user_id, role) values (hid, uid, 'member');
    insert into public.push_subscriptions (user_id, household_id, endpoint, p256dh, auth, user_agent)
      select distinct on (endpoint) user_id, hid, endpoint, p256dh, auth, user_agent
      from public.push_subscriptions where user_id = uid
      on conflict do nothing;
  end if;
  update public.profiles set active_household_id = hid where id = uid;
  return hid;
end;
$$;
