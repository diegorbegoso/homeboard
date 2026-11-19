-- HomeBoard · init_schema
-- Tablas, funciones, RLS y publicación Realtime. Todas las tablas tienen RLS activado.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 60),
  avatar_url text,
  created_at timestamptz not null default now()
);

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 60),
  invite_code text not null unique check (invite_code ~ '^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$'),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.household_members (
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null unique references auth.users (id) on delete cascade,
  role text not null check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

create table public.shopping_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  quantity text check (quantity is null or char_length(quantity) <= 40),
  note text check (note is null or char_length(note) <= 200),
  is_done boolean not null default false,
  done_by uuid references auth.users (id) on delete set null,
  done_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint shopping_items_done_consistent check (is_done = (done_at is not null))
);

create index shopping_items_list_idx on public.shopping_items (household_id, deleted_at, is_done);

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

create index push_subscriptions_household_idx on public.push_subscriptions (household_id);

-- ---------- helper functions (security definer: they read household_members without recursing into its RLS)

create or replace function public.is_household_member(hid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.household_members m
    where m.household_id = hid and m.user_id = (select auth.uid())
  );
$$;

create or replace function public.is_household_owner(hid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.household_members m
    where m.household_id = hid and m.user_id = (select auth.uid()) and m.role = 'owner'
  );
$$;

create or replace function public.shares_household(other uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.household_members me
    join public.household_members them on them.household_id = me.household_id
    where me.user_id = (select auth.uid()) and them.user_id = other
  );
$$;

create or replace function public.generate_invite_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text := '';
begin
  for i in 1..8 loop
    code := code || substr(alphabet, 1 + floor(random() * 32)::int, 1);
  end loop;
  return code;
end;
$$;

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
  if exists (select 1 from public.household_members where user_id = uid) then
    raise exception 'ya_tiene_hogar' using errcode = 'P0001';
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
  if exists (select 1 from public.household_members where user_id = uid) then
    raise exception 'ya_tiene_hogar' using errcode = 'P0001';
  end if;
  select id into hid from public.households where invite_code = upper(trim(coalesce(p_code, '')));
  if hid is null then
    raise exception 'codigo_invalido' using errcode = 'P0001';
  end if;
  if (select count(*) from public.household_members where household_id = hid) >= 6 then
    raise exception 'hogar_lleno' using errcode = 'P0001';
  end if;
  insert into public.household_members (household_id, user_id, role) values (hid, uid, 'member');
  return hid;
end;
$$;

revoke execute on function public.create_household(text) from public, anon;
revoke execute on function public.join_household(text) from public, anon;
grant execute on function public.create_household(text) to authenticated;
grant execute on function public.join_household(text) to authenticated;

-- ---------- triggers

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    left(
      coalesce(
        nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
        nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
        nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
        'Miembro'
      ),
      60
    ),
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger shopping_items_touch_updated_at
  before update on public.shopping_items
  for each row execute function public.touch_updated_at();

-- ---------- row level security

alter table public.profiles enable row level security;
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.shopping_items enable row level security;
alter table public.push_subscriptions enable row level security;

create policy profiles_select on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or public.shares_household(id));

create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy households_select on public.households
  for select to authenticated
  using (public.is_household_member(id));

create policy households_update_owner on public.households
  for update to authenticated
  using (public.is_household_owner(id))
  with check (public.is_household_owner(id));

create policy household_members_select on public.household_members
  for select to authenticated
  using (public.is_household_member(household_id));

create policy shopping_items_select on public.shopping_items
  for select to authenticated
  using (public.is_household_member(household_id));

create policy shopping_items_insert on public.shopping_items
  for insert to authenticated
  with check (public.is_household_member(household_id) and created_by = (select auth.uid()));

create policy shopping_items_update on public.shopping_items
  for update to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

-- No DELETE policy on shopping_items: deletion is `update ... set deleted_at = now()`.

create policy push_subscriptions_select_own on public.push_subscriptions
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy push_subscriptions_insert_own on public.push_subscriptions
  for insert to authenticated
  with check (user_id = (select auth.uid()) and public.is_household_member(household_id));

create policy push_subscriptions_update_own on public.push_subscriptions
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and public.is_household_member(household_id));

create policy push_subscriptions_delete_own on public.push_subscriptions
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- ---------- realtime

alter publication supabase_realtime add table public.shopping_items;
