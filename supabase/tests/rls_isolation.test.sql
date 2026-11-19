begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

-- A user with no household, created inside this transaction (rolled back at the end).
insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data)
values ('00000000-0000-0000-0000-000000000000', '44444444-4444-4444-4444-444444444444',
        'authenticated', 'authenticated', 'sin-hogar@homeboard.test', '{"full_name":"Zoe"}');

-- ---------- as Ana (household A = Casa de Ana)
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

select is((select count(*)::int from public.shopping_items where household_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
  0, 'Ana no ve elementos del hogar B');
select is((select count(*)::int from public.households where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
  0, 'Ana no ve el hogar B');
select is((select count(*)::int from public.household_members where household_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
  0, 'Ana no ve los miembros del hogar B');
select ok((select count(*) from public.shopping_items where household_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') > 0,
  'Ana ve los elementos de su hogar');
select throws_ok(
  $$ insert into public.shopping_items (household_id, name, created_by)
     values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Intruso', '11111111-1111-1111-1111-111111111111') $$,
  '42501', null, 'Ana no puede insertar en el hogar B');
select lives_ok(
  $$ update public.shopping_items set name = 'hackeado' where household_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' $$,
  'el UPDATE de Ana sobre el hogar B se ejecuta sin error');
select is((select count(*)::int from public.profiles where id = '33333333-3333-3333-3333-333333333333'),
  0, 'Ana no ve el perfil de Bea');
select throws_ok($$ select public.join_household('BEAHGR78') $$,
  'P0001', 'ya_tiene_hogar', 'Ana ya tiene hogar y no puede unirse a otro');

-- ---------- as Zoe (no household)
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}', true);
select throws_ok($$ select public.join_household('ZZZZZZZZ') $$,
  'P0001', 'codigo_invalido', 'un código inexistente se rechaza');

-- ---------- as the owner of the database (bypasses RLS): Ana's UPDATE changed nothing
reset role;
select is((select count(*)::int from public.shopping_items where name = 'hackeado'),
  0, 'el UPDATE de Ana no cambió ninguna fila del hogar B');

-- ---------- as anon
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select count(*)::int from public.shopping_items), 0, 'anon no ve ningún elemento');

reset role;
select * from finish();
rollback;
