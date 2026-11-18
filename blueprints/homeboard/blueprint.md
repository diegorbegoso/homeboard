# HomeBoard — Blueprint

> Generado por The Architect el 2026-11-17
> Shape: saas-webapp (multi-tenant, tenant = hogar; sin facturación ni superficie de marketing) · `knowledge/shapes/saas-webapp.md`
> Runtime track: ts-node · `knowledge/runtime-tracks/ts-node.md`
> Emission mode: bundle (14 pasos en §9 → bundle)
> Blueprint version: 1
> Versions last verified: 2026-11-17 — ver §11 para la procedencia por paquete

**Cómo se usa este bundle.** `blueprint.md` explica el porqué. `tasks.json` es el grafo de tareas que decide
qué sigue. `epics/01-cimientos.md` y `epics/02-hogar-y-compras.md` son las unidades de ejecución
autocontenidas. `workspace/` se copia **una sola vez** a la raíz del proyecto en §10 Bootstrap (copia
protegida por un marcador, ver §19). El bundle vive dentro del proyecto en `blueprints/homeboard/` y todas las
configs emitidas lo excluyen.

---

## 1. Project Overview & Non-Goals

### Vision

HomeBoard es una PWA para la convivencia en casa: los miembros de un hogar comparten "micro apps" internas que se
sincronizan al instante entre sus teléfonos. La v1 trae una sola micro app — la **Lista de compras
compartida**: cualquiera de los dos añade "Leche", el otro lo ve aparecer en su iPhone en menos de cinco
segundos, lo marca como comprado en el súper y a quien se quedó en casa le llega "Ana compró Leche". El
producto existe porque las listas en grupos de chat se pierden entre mensajes y las apps genéricas de notas
no saben quién es "nosotros".

Es para un hogar de dos personas (el usuario y su pareja/compañero), instalada en iPhone desde Safari con
"Añadir a pantalla de inicio" — sin App Store, sin cuenta de Apple Developer, y con coste cero: Supabase Free,
Vercel Hobby, Sentry Developer. La pantalla de Inicio es un registro de micro apps para que tareas, gastos y
otras lleguen después sin rehacer el armazón.

### Users

| Persona | What they come to do | Frequency |
|---|---|---|
| Miembro del hogar que hace la compra | Abrir la lista en el súper, marcar lo comprado, ver al instante lo que el otro añadió | 2–4 veces por semana |
| Miembro del hogar que se queda en casa | Añadir lo que falta en cuanto lo nota; recibir el aviso de que ya se compró | Diario |
| Quien crea el hogar | Crear el hogar una vez y compartir el código de invitación | Una vez |

### Goals — v1 scope

1. Una persona se registra (correo + contraseña o Google), crea un hogar y obtiene un código de 8 caracteres que su pareja usa para unirse.
2. Los miembros de un hogar crean, editan, marcan/desmarcan como comprado y borran (con "Deshacer") elementos de la lista de compras compartida.
3. Cada cambio aparece en el teléfono del otro miembro en menos de 5 segundos sin recargar.
4. La app se instala en iPhone como PWA a pantalla completa y, ya instalada, envía notificaciones push cuando alguien añade o compra algo.
5. Ningún dato de un hogar es visible para otro hogar: lo impone la base de datos (RLS), no la interfaz.
6. Todo funciona en planes gratuitos y la base de datos no se pausa por inactividad.

### Non-Goals — explicitly out of scope for v1

| Not building | Why not now | Revisit when |
|---|---|---|
| Pagos o planes de suscripción | Uso privado de un hogar; no hay nada que cobrar | Otro hogar ajeno quiere usarla y pregunta por precio |
| Landing pública / marketing / SEO | Los usuarios llegan por enlace directo; una superficie pública es trabajo sin lector | Se decide abrir HomeBoard a más hogares |
| Varios hogares por usuario | `UNIQUE(user_id)` en `household_members` simplifica proxy, RLS y UI | Alguien necesita separar "casa" y "casa de los padres" |
| App nativa / App Store | Evita la cuota de Apple Developer; la PWA cubre instalación y push en iOS ≥ 16.4 | La push de PWA en iOS resulta poco fiable en el uso real |
| Modo offline con escritura | Requiere cola de sincronización y resolución de conflictos; v1 solo muestra una página `/offline` | Los usuarios intentan añadir cosas sin cobertura con frecuencia |
| Otras micro apps (tareas, gastos…) | v1 valida el armazón con una sola; el registro ya está listo para más | La lista de compras se usa a diario durante 4 semanas |
| Internacionalización | Hogar hispanohablante; todo el copy está en español | Un hogar no hispanohablante quiere usarla |
| Abandonar hogar / expulsar miembros / regenerar código | Hogar de 2 personas estable; se gestiona a mano en el dashboard si hiciera falta | Un hogar cambia de miembros |

**The builder must not implement anything in this table**, even if it seems like a small addition while
working on an adjacent step. If a step appears to require a non-goal, that is a blueprint defect — stop and
report it rather than expanding scope.

### Success metrics

| Metric | Target | How measured |
|---|---|---|
| Tiempo de propagación de un cambio | < 5 s p95 entre dos teléfonos | E2E `tests/e2e/realtime.spec.ts` (5000 ms) y prueba manual en dos iPhone (§20.1) |
| Uso real | ≥ 10 elementos añadidos por semana durante las 4 semanas tras el lanzamiento | `select count(*) from shopping_items where created_at > now() - interval '7 days'` en el SQL editor de Supabase |
| Disponibilidad de la base | 0 pausas del proyecto Supabase en 30 días | Dashboard de Supabase (estado del proyecto) + logs del cron `/api/health` en Vercel |
| Coste | 0 USD/mes | Facturas de Vercel, Supabase y Sentry |

---

## 2. Tech Stack

**Runtime track: ts-node.** This table names *choices*, not versions. Every version pin lives in Section 11
and nowhere else.

Pins come from the `stack-researcher` report produced in this session (checked 2026-11-17), which is the
authority. `knowledge/runtime-tracks/ts-node.md` is the fallback only for `vite` and `@types/node`.

| Layer | Choice | Why this, over what |
|---|---|---|
| Language / runtime | TypeScript 6 on Node (`.nvmrc` 26, `engines >=24`) | Un solo lenguaje de servidor a cliente. TypeScript 7 se descarta: sin API de compilador estable para herramientas. Node 26 es el LTS activo; `>=24` porque la máquina de desarrollo tiene 24.19.0 y el soporte de Node 26 en Vercel no está verificado |
| Framework | Next.js 16 App Router (Turbopack) | Server Actions + Server Components dan mutaciones autorizadas sin API propia, y Vercel lo despliega sin configuración. Vite + SPA se descarta: necesitaríamos un backend aparte para las acciones con service role y el cron |
| Styling | Tailwind CSS 4, configuración CSS-first con `@theme` y variables CSS | Tokens light/dark como variables, cero archivos de config JS. CSS Modules se descarta: más archivos por componente sin ganar nada |
| Component layer | Componentes propios + Phosphor icons + sonner + motion | La app tiene ~10 componentes; shadcn añadiría primitivas Radix que no necesitamos. sonner da toasts con acción "Deshacer" accesibles |
| Database | Supabase Postgres (plan Free) con RLS | Postgres + Auth + Realtime en un servicio gratuito, y RLS ve directamente `auth.uid()`. Firebase se descarta: reglas fuera de SQL y sin RLS relacional |
| ORM / data access | Sin ORM: SQL en `supabase/migrations/` + `@supabase/supabase-js` con tipos generados | Una sola herramienta dueña del esquema (la CLI de Supabase). Drizzle se descarta: dos sistemas de migraciones sobre una base es la combinación que `stack-compatibility.md` marca como rota |
| Auth | Supabase Auth: Google OAuth (PKCE) + correo/contraseña, vía `@supabase/ssr` | Los usuarios viven en el mismo Postgres que las políticas RLS. Correo/contraseña es el respaldo porque el viaje de Google desde una PWA instalada en iOS no está verificado |
| Background work | Vercel Cron diario (`GET /api/health`) | Única tarea programada: mantener Supabase Free activo. Una cola se descarta: no hay trabajo asíncrono que la justifique; el envío push ocurre al final de la Server Action |
| Payments | NOT APPLICABLE — sin pagos en v1 (Non-Goal) | — |
| File storage | NOT APPLICABLE — v1 no sube archivos; los avatares de Google son URLs externas | — |
| Email / notifications | Web Push con VAPID (`web-push`), service worker propio | Gratis y llega al iPhone con la PWA instalada. Correo se descarta: un hogar de dos no lee correos de "Ana compró Leche". Supabase envía los correos de auth |
| Hosting | Vercel Hobby | Gratis, despliegue nativo de Next 16, Cron incluido. Hostinger se descarta: sin Server Actions ni cron gestionado sin montar Node a mano |
| Package manager | pnpm 12 (`packageManager` en `package.json`) | Lo fija el runtime track; `node_modules` estricto detecta dependencias fantasma |

### Compatibility check

Checked against `knowledge/stack-compatibility.md`. Rows that touch this stack and how this blueprint stays
on the safe side:

- **Two migration systems on one database** — evitado: el editor de esquema del dashboard es de solo lectura; `supabase/migrations/` es el único dueño.
- **In-memory realtime state + horizontally scaled host** — no aplica: el estado en tiempo real lo mantiene Supabase Realtime (externo); ningún módulo del servidor guarda colecciones mutables.
- **Platform auth bundled with the database (Supabase)** — es la combinación recomendada: la sesión está en el contexto de RLS.
- **Biome + Tailwind v4** — `css.parser.tailwindDirectives: true` en `biome.json` (emitido en §19.6).

No known-bad combinations remain.

---

## 3. Directory Structure

```
homeboard/                                   # raíz del proyecto (repo git creado en §10 Bootstrap)
  .claude/                              # §19 — copiado desde workspace/
    settings.json                       # allowlist de los comandos de verificación
    rules/{database,server-actions,ui,pwa,tests}.md   # convenciones con paths:
    skills/add-migration/SKILL.md
    skills/add-micro-app/SKILL.md
  .github/workflows/ci.yml              # §19.6 — workflow de CI (JSON válido = YAML válido)
  blueprints/homeboard/                      # este bundle; excluido de Biome, tsc, Vitest y Playwright
  public/
    sw.js                               # paso 3 — service worker propio (offline + push)
    icons/                              # paso 3 — PNG generados por `pnpm icons`, commiteados
  scripts/                              # §19.6 — Node .mjs, nunca importan de src/
    apply-scaffold-edits.mjs            # Bootstrap — edita package.json, tsconfig.json, next.config.ts
    patch-supabase-config.mjs           # paso 4 — ajustes en supabase/config.toml
    write-env-local.mjs                 # paso 4 — escribe .env.local desde `supabase status`
    gen-types.mjs                       # paso 4 — genera src/lib/database.types.ts
    generate-icons.mjs                  # paso 3 — dibuja los iconos PNG
    smoke.mjs                           # paso 1 — arranca el build de producción y pide `/`
  src/
    app/
      layout.tsx                        # paso 2 — <html lang="es">, fuentes, metadata PWA, registro del SW
      globals.css                       # paso 2 — tokens (:root, .dark, @theme inline)
      manifest.ts                       # paso 3 — /manifest.webmanifest
      global-error.tsx                  # paso 11 — frontera de error raíz (reporta a Sentry si hay DSN)
      offline/page.tsx                  # paso 3 — página que el SW sirve sin red
      (app)/                            # rutas autenticadas con barra de pestañas
        layout.tsx                      # paso 2 — shell + <TabBar />
        page.tsx                        # pasos 1 y 9 — Inicio (saludo + tiles de micro apps)
        compras/page.tsx                # paso 10 — lista de compras (Server Component)
        compras/actions.ts              # pasos 10 y 12 — Server Actions del CRUD + disparadores push
        compras/shopping-list.tsx       # pasos 10 y 11 — cliente: UI optimista, motion, sonner
        compras/use-realtime-items.ts   # paso 11 — suscripción Realtime + reconciliación
        ajustes/page.tsx                # pasos 8 y 13 — código de invitación, miembros, push, cerrar sesión
      (auth)/                           # rutas públicas de autenticación, sin barra de pestañas
        entrar/page.tsx                 # pasos 6 y 7 — correo/contraseña + "Continuar con Google"
        registro/page.tsx               # paso 6
        actions.ts                      # pasos 6 y 7 — signIn, signUp, signOut, signInWithGoogle
      auth/callback/route.ts            # paso 7 — intercambio del código OAuth (PKCE)
      bienvenida/page.tsx               # paso 8 — crear hogar o unirse con código
      api/health/route.ts               # paso 14 — keep-alive del cron (GET + CRON_SECRET)
    components/
      tab-bar.tsx                       # paso 2 — barra inferior estilo iOS (cliente)
      micro-app-tile.tsx                # paso 9
      push-toggle.tsx                   # paso 13 — botón "Activar notificaciones" (cliente)
    lib/
      site.ts                           # paso 1 — nombre y descripción
      env.ts                            # paso 4 — getPublicEnv() / requireServerEnv()
      database.types.ts                 # paso 4 — GENERADO por `pnpm db:types`
      log.ts                            # paso 12 — logs JSON estructurados con redacción
      auth/safe-next.ts                 # paso 7 — evita open redirects en `next`
      shopping/schema.ts                # paso 10 — esquemas zod de la lista
      supabase/server.ts                # paso 6 — createClient() para servidor (cookies getAll/setAll)
      supabase/client.ts                # paso 11 — createClient() para navegador
      supabase/admin.ts                 # paso 12 — cliente service role (solo servidor)
      push/send.ts                      # paso 12 — sendPushToHousehold, buildItemPush
      push/actions.ts                   # paso 13 — Server Action saveSubscription
      push/support.ts                   # paso 13 — pushSupportState, subscriptionSchema
    micro-apps/registry.ts              # paso 9 — registro de micro apps (datos, sin React)
    types/web-push.d.ts                 # §19.6 — tipos propios de web-push 4
    proxy.ts                            # paso 8 — sesión + redirecciones (Next 16: no es middleware.ts)
    instrumentation.ts                  # paso 14 — Sentry servidor (no-op sin DSN)
    instrumentation-client.ts           # paso 14 — Sentry navegador (no-op sin DSN)
  supabase/
    config.toml                         # paso 4 — generado por `supabase init`, ajustado por db:config
    migrations/                         # paso 4 — el archivo que crea `supabase migration new init_schema`
    seed.sql                            # paso 4 — 3 usuarios, 2 hogares, elementos de ejemplo
    tests/rls_isolation.test.sql        # paso 5 — pgTAP
  tests/
    setup/unit.ts                       # §19.6 — setup de Vitest
    unit/*.test.ts                      # pasos 1, 7, 9, 12, 13, 14
    e2e/helpers.ts                      # §19.6 — helpers compartidos de Playwright
    e2e/*.spec.ts                       # pasos 2, 3, 6, 8, 9, 10, 11
  .env.example                          # §19.6 — commiteado (excepción en .gitignore)
  .gitignore                            # §19.6 — llega en Bootstrap ANTES del primer commit
  .nvmrc                                # paso 1 — `26`
  .workspace-applied                    # Bootstrap — marcador de la copia única de workspace/, commiteado
  biome.json                            # §19.6 — sustituye deliberadamente al del scaffold
  pnpm-workspace.yaml                   # §19.6 — allowBuilds de pnpm 12
  playwright.config.ts                  # §19.6
  vitest.config.ts                      # §19.6
  vercel.json                           # §19.6 — cron diario a /api/health
  next.config.ts                        # scaffold; Bootstrap pone cacheComponents: false
  tsconfig.json                         # scaffold; Bootstrap añade "blueprints" a exclude
  package.json / pnpm-lock.yaml         # scaffold + edits de Bootstrap (nunca se emite package.json)
  CLAUDE.md / AGENTS.md                 # §19.1 / §19.2
```

**Boundary rules**
- Nada en `src/components/` importa `src/lib/supabase/server.ts`, `src/lib/supabase/admin.ts` ni `src/lib/push/send.ts`.
- `src/lib/supabase/admin.ts` (service role) solo lo importan `src/lib/push/send.ts` y `src/app/api/health/route.ts`.
- Toda lectura/escritura de datos pasa por un cliente de `src/lib/supabase/*`; ninguna ruta construye clientes por su cuenta.
- `src/micro-apps/registry.ts` es datos puros: no importa React ni Supabase.
- `scripts/*.mjs` nunca importan de `src/`.
- Convención de imports: ver §19.6 *Resolution convention matrix* (alias `@/` sin extensión en `src/` y `tests/`; los scripts no importan código del proyecto).

Every file above has exactly one origin: a §9 step (named in its **Do** and in that task's `files`), the
create-next-app scaffold plus Bootstrap edits (§10), or a real file under `workspace/` (§19.6).

---

## 4. Data Model

Tenancy: **multi-tenant, tenant = hogar** (`households`). Every tenant-owned row carries `household_id`; RLS
decides visibility through `public.is_household_member(hid)`. v1 limits a user to one household
(`UNIQUE(user_id)`), which keeps `src/proxy.ts` to a single membership lookup.

### Entities

**profiles** — espejo público de `auth.users`; lo crea un trigger al registrarse y vive mientras exista el usuario.

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `id` | uuid | PK, FK → `auth.users.id` ON DELETE CASCADE | mismo id que la cuenta de auth |
| `display_name` | text | NOT NULL, 1–60 chars | de `raw_user_meta_data.full_name` → `.name` → parte local del correo → `Miembro` |
| `avatar_url` | text | NULL | foto de Google si existe |
| `created_at` | timestamptz | NOT NULL default `now()` | |

**households** — el hogar (tenant). Se crea solo con `create_household()`; no se borra en v1.

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `id` | uuid | PK default `gen_random_uuid()` | |
| `name` | text | NOT NULL, 1–60 chars | "Casa de Ana" |
| `invite_code` | text | NOT NULL, UNIQUE, `^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$` | 8 caracteres sin ambiguos (sin I, O, 0, 1) |
| `created_by` | uuid | NULL, FK → `auth.users.id` ON DELETE SET NULL | quién lo creó |
| `created_at` | timestamptz | NOT NULL default `now()` | |

**household_members** — tabla de unión usuario ↔ hogar con rol.

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `household_id` | uuid | PK (con user_id), FK → `households.id` ON DELETE CASCADE | |
| `user_id` | uuid | PK (con household_id), UNIQUE, FK → `auth.users.id` ON DELETE CASCADE | UNIQUE = un hogar por usuario en v1 |
| `role` | text | NOT NULL, CHECK in (`owner`,`member`) | `owner` puede renombrar el hogar |
| `joined_at` | timestamptz | NOT NULL default `now()` | |

**shopping_items** — elemento de la lista de compras. Se borra de forma lógica (`deleted_at`) para que todo cambio visible sea INSERT/UPDATE: Supabase Realtime no aplica RLS a eventos DELETE.

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `id` | uuid | PK default `gen_random_uuid()` | lo puede generar el cliente para la UI optimista |
| `household_id` | uuid | NOT NULL, FK → `households.id` ON DELETE CASCADE | tenant |
| `name` | text | NOT NULL, 1–120 chars | "Leche" |
| `quantity` | text | NULL, ≤ 40 chars | texto libre: "2 L", "1 docena" |
| `note` | text | NULL, ≤ 200 chars | "la sin lactosa" |
| `is_done` | boolean | NOT NULL default false | comprado |
| `done_by` | uuid | NULL, FK → `auth.users.id` ON DELETE SET NULL | quién lo marcó |
| `done_at` | timestamptz | NULL; CHECK `is_done = (done_at is not null)` | |
| `created_by` | uuid | NULL, FK → `auth.users.id` ON DELETE SET NULL | autor (para "Ana añadió…") |
| `created_at` | timestamptz | NOT NULL default `now()` | orden de la lista |
| `updated_at` | timestamptz | NOT NULL default `now()`, trigger | |
| `deleted_at` | timestamptz | NULL | borrado lógico; `Deshacer` lo vuelve a NULL |

**push_subscriptions** — una suscripción Web Push por dispositivo.

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `id` | uuid | PK default `gen_random_uuid()` | |
| `user_id` | uuid | NOT NULL, FK → `auth.users.id` ON DELETE CASCADE | dueño del dispositivo |
| `household_id` | uuid | NOT NULL, FK → `households.id` ON DELETE CASCADE | a quién se notifica |
| `endpoint` | text | NOT NULL, UNIQUE | URL del servicio push; se borra al recibir 404/410 |
| `p256dh` | text | NOT NULL | clave pública del navegador |
| `auth` | text | NOT NULL | secreto de autenticación del navegador |
| `user_agent` | text | NULL | diagnóstico |
| `created_at` | timestamptz | NOT NULL default `now()` | |

The micro-app registry is **not** a table: it lives in code (`src/micro-apps/registry.ts`, §6).

### Relationships

- `auth.users —(1:1)→ profiles` — ON DELETE CASCADE (borrar la cuenta borra su perfil).
- `households —(1:N)→ household_members` — CASCADE.
- `auth.users —(1:0..1)→ household_members` — CASCADE; UNIQUE(user_id).
- `households —(1:N)→ shopping_items` — CASCADE (no hay borrado de hogares en v1; la cascada solo protege la integridad).
- `auth.users —(1:N)→ shopping_items.created_by / done_by` — SET NULL (el elemento sobrevive a quien lo creó).
- `households —(1:N)→ push_subscriptions` y `auth.users —(1:N)→ push_subscriptions` — CASCADE.

### Indexes

| Table | Index | Why |
|---|---|---|
| `shopping_items` | `(household_id, deleted_at, is_done)` | la consulta de la lista: `where household_id = $1 and deleted_at is null order by is_done, created_at` |
| `household_members` | UNIQUE `(user_id)` | búsqueda de membresía en `src/proxy.ts` en cada petición |
| `households` | UNIQUE `(invite_code)` | `join_household(code)` |
| `push_subscriptions` | `(household_id)` y UNIQUE `(endpoint)` | envío a un hogar; upsert por endpoint |

### Schema

The complete content of the `init_schema` migration (step 4 creates the file with
`pnpm exec supabase migration new init_schema` and pastes this verbatim):

```sql
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
```

### Migrations

- Tool: Supabase CLI (§11). One migration per change, created with `pnpm exec supabase migration new <name>`; **the CLI names the file** (timestamp prefix). In this document the first one is "the `init_schema` migration" — the newest file in `supabase/migrations/` after step 4.
- Local apply: `pnpm db:reset` (drops, re-applies every migration, runs `supabase/seed.sql`).
- Production: `pnpm exec supabase db push` against the linked cloud project — a launch-checklist action (§20.1), never run by the builder, and denied in `.claude/settings.json`.
- Rule: once a migration has been pushed to the cloud it is never edited; changes are new migrations. Expand-then-contract for anything destructive (add the new column, deploy code that writes both, then drop in a later migration).

### Seed data

`supabase/seed.sql` (step 4) runs on every `pnpm db:reset`, local only. It creates three users who can sign
in with password `homeboard-dev-1234`, two households and a few items. Full content:

```sql
-- HomeBoard · seed local. Contraseña de todos: homeboard-dev-1234
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
) values
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'authenticated', 'authenticated',
   'ana@homeboard.test', extensions.crypt('homeboard-dev-1234', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"full_name":"Ana"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '22222222-2222-2222-2222-222222222222', 'authenticated', 'authenticated',
   'luis@homeboard.test', extensions.crypt('homeboard-dev-1234', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"full_name":"Luis"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '33333333-3333-3333-3333-333333333333', 'authenticated', 'authenticated',
   'bea@homeboard.test', extensions.crypt('homeboard-dev-1234', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"full_name":"Bea"}', now(), now(), '', '', '', '');

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
values
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111',
   '{"sub":"11111111-1111-1111-1111-111111111111","email":"ana@homeboard.test"}', 'email', now(), now(), now()),
  (gen_random_uuid(), '22222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222',
   '{"sub":"22222222-2222-2222-2222-222222222222","email":"luis@homeboard.test"}', 'email', now(), now(), now()),
  (gen_random_uuid(), '33333333-3333-3333-3333-333333333333', '33333333-3333-3333-3333-333333333333',
   '{"sub":"33333333-3333-3333-3333-333333333333","email":"bea@homeboard.test"}', 'email', now(), now(), now());

-- profiles are created by the on_auth_user_created trigger

insert into public.households (id, name, invite_code, created_by) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Casa de Ana', 'CASA2345', '11111111-1111-1111-1111-111111111111'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Casa de Bea', 'BEAHGR78', '33333333-3333-3333-3333-333333333333');

insert into public.household_members (household_id, user_id, role) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'owner'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 'member'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '33333333-3333-3333-3333-333333333333', 'owner');

insert into public.shopping_items (household_id, name, quantity, is_done, done_by, done_at, created_by) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Leche', '2 L', false, null, null, '11111111-1111-1111-1111-111111111111'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Huevos', '1 docena', false, null, null, '22222222-2222-2222-2222-222222222222'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Pan', null, true, '22222222-2222-2222-2222-222222222222', now(), '11111111-1111-1111-1111-111111111111'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Café', '250 g', false, null, null, '33333333-3333-3333-3333-333333333333');
```

---

## 5. API Design

HomeBoard has no public REST API. The server surface is **Server Actions** (called by the app's own forms) plus
three route handlers.

### Conventions
- Base path: Server Actions have no path (POST to the page that renders them); route handlers live under `src/app/**/route.ts`.
- Response envelope (Server Actions): `{ ok: true, data: T } | { ok: false, error: ErrorCode }` — one shape, no exceptions. Route handler `/api/health` returns `{ ok: true }` or `{ ok: false, error: "unauthorized" | "db" }`.
- Error codes (Server Actions → Spanish copy in the UI):

| Code | Meaning | UI copy |
|---|---|---|
| `no_autenticado` | no session | redirect to `/entrar` |
| `sin_hogar` | user has no household | redirect to `/bienvenida` |
| `datos_invalidos` | zod rejected the input | field message, e.g. `Escribe qué hay que comprar` |
| `credenciales_invalidas` | wrong email/password | `Correo o contraseña incorrectos` |
| `correo_en_uso` | sign-up with an existing email | `Ya hay una cuenta con ese correo` |
| `contrasena_corta` | password < 8 chars | `La contraseña necesita al menos 8 caracteres` |
| `codigo_invalido` | join with unknown code | `Ese código no existe` |
| `ya_tiene_hogar` | user already in a household | `Ya perteneces a un hogar` |
| `hogar_lleno` | household has 6 members | `Ese hogar ya está completo` |
| `no_encontrado` | item id not visible to this user | `Ese elemento ya no existe` |
| `suscripcion_invalida` | malformed push subscription | `No pudimos activar las notificaciones` |
| `error_inesperado` | anything else (logged) | `Algo salió mal. Inténtalo de nuevo.` |

- Validation: zod 4. Item schemas in `src/lib/shopping/schema.ts`; auth and household inputs parsed inside their action files; push subscription in `src/lib/push/support.ts`.
- Pagination: none — a household list is small (dozens of items). The list query has no limit; revisit above 500 items.
- Idempotency: `addItem` accepts a client-generated `id` (uuid) and inserts with `on conflict (id) do nothing`, so a double submit from the optimistic UI creates one row. `saveSubscription` upserts on `endpoint`.
- Rate limits: none in v1 — two known users, Supabase Auth applies its own auth rate limits. Revisit if HomeBoard opens to other households.

### Routes

| Method | Path | Description | Auth | Rate limit |
|---|---|---|---|---|
| GET | `/auth/callback` | Exchanges the OAuth `code` for a session, redirects to a safe `next` | public (code-bound) | Supabase Auth limits |
| GET | `/api/health` | Keep-alive: trivial DB select; called daily by Vercel Cron | `Authorization: Bearer CRON_SECRET` | none |
| GET | `/manifest.webmanifest` | PWA manifest (from `src/app/manifest.ts`) | public | none |
| POST (Server Action) | `signIn`, `signUp`, `signOut`, `signInWithGoogle` — `src/app/(auth)/actions.ts` | Auth flows | public / user | Supabase Auth limits |
| POST (Server Action) | `crearHogar`, `unirseAHogar` — inline in `src/app/bienvenida/page.tsx` | Calls `create_household` / `join_household` RPC | user | none |
| POST (Server Action) | `addItem`, `updateItem`, `toggleItem`, `deleteItem`, `restoreItem` — `src/app/(app)/compras/actions.ts` | Shopping list CRUD | household member | none |
| POST (Server Action) | `saveSubscription` — `src/lib/push/actions.ts` | Stores the device's push subscription | household member | none |

### Critical endpoints — full detail

**`addItem(input)`** — input `{ id: uuid, name: string, quantity?: string, note?: string }`. Rules: `name`
trimmed 1–120 chars (`Escribe qué hay que comprar` when empty), `quantity` ≤ 40, `note` ≤ 200, `id` a uuid.
Steps: `getUser()` → `no_autenticado`; membership lookup → `sin_hogar`; insert with `household_id` from the
membership and `created_by = user.id`, `on conflict (id) do nothing`; then fire-and-forget
`notify(householdId, user.id, buildItemPush("added", actorName, name))`. Returns `{ ok: true, data: item }`.
Side effects: one row; one push per *other* member's device.

**`toggleItem({ id, isDone })`** — sets `is_done`, `done_by = isDone ? user.id : null`, `done_at = isDone ?
now() : null`, filtered by `id` and `deleted_at is null`; RLS restricts it to the member's household. 0 rows
updated → `no_encontrado`. When `isDone` is true, push `buildItemPush("done", actorName, name)`.

**`deleteItem({ id })` / `restoreItem({ id })`** — `deleted_at = now()` / `deleted_at = null`. Never a SQL
DELETE. 0 rows → `no_encontrado`. No push.

**`updateItem({ id, name, quantity?, note? })`** — same validation as `addItem`; 0 rows → `no_encontrado`.

**`GET /auth/callback?code&next`** — no `code` → 307 `/entrar?error=oauth`; `exchangeCodeForSession` error →
307 `/entrar?error=oauth`; success → 307 to `safeNextPath(next)` on `https://${x-forwarded-host}` when that
header is present and `NODE_ENV !== "development"`, else on the request origin. `safeNextPath` returns `/`
for anything not starting with a single `/` (`//x`, `/\x`, absolute URLs).

**`GET /api/health`** — missing/wrong bearer → 401 `{ ok: false, error: "unauthorized" }`; DB error → 503
`{ ok: false, error: "db" }` (logged `health.db_failed`); else 200 `{ ok: true }`. Idempotent and read-only, as
Vercel Cron may skip or duplicate runs.

---

## 6. Frontend Architecture

### Routes

| Route | Page | Data source | Auth |
|---|---|---|---|
| `/entrar` | Iniciar sesión (correo/contraseña + Google) | none | public (signed-in → `/`) |
| `/registro` | Crear cuenta | none | public (signed-in → `/`) |
| `/auth/callback` | route handler | Supabase Auth | public |
| `/bienvenida` | Crear hogar / unirse con código | server: membership | user without household |
| `/` | Inicio: saludo, nombre del hogar, tiles de micro apps | server: profile + household | member |
| `/compras` | Lista de compras | server: items; client: Realtime | member |
| `/ajustes` | Código de invitación, miembros, notificaciones, cerrar sesión | server: household + members | member |
| `/offline` | Sin conexión (servida por el SW) | static | public |

### Rendering strategy

`cacheComponents` is **off** (`next.config.ts`, set by Bootstrap) so pages that read cookies render
dynamically without `<Suspense>` gymnastics. Every page under `(app)`, `/bienvenida` and the `(auth)` pages
are dynamic Server Components (they call `cookies()` through `createClient()`). `/offline` and
`/manifest.webmanifest` are static. `/api/health` sets `export const dynamic = "force-dynamic"`. Mutations call
`revalidatePath("/compras")` (or `"/"`, `"/ajustes"`) after writing. No `"use cache"` anywhere in v1.

### UI contract — labels and test ids (used verbatim by `tests/e2e/helpers.ts`)

| Page | Element | Exact text / attribute |
|---|---|---|
| `/entrar` | heading | `Entra a HomeBoard` (contains `HomeBoard`, which `pnpm smoke` asserts once `/` redirects here) |
| `/entrar` | inputs | label `Correo` (type email), label `Contraseña` (type password) |
| `/entrar` | buttons | `Entrar`; from step 7 also `Continuar con Google`; link `Crear cuenta nueva` → `/registro` |
| `/registro` | inputs / button | labels `Nombre`, `Correo`, `Contraseña`; button `Crear cuenta`; link `Ya tengo cuenta` → `/entrar` |
| `/bienvenida` | create form | label `Nombre del hogar`, button `Crear hogar` |
| `/bienvenida` | join form | label `Código de invitación`, button `Unirme` |
| `/ajustes` | invite code | `<p data-testid="codigo-invitacion">` holding the 8-char code |
| `/ajustes` | members | `<ul aria-label="Miembros">` with one `<li>` per member display name |
| `/ajustes` | buttons | `Cerrar sesión`; from step 13 `Activar notificaciones` (only when supported) |
| `/` | heading | `Hola, {display_name}` (h1) and household name in a `<p>` |
| `/` | tiles | one `<a>` per enabled micro app, accessible name = its `nombre` |
| `/compras` | add form | label `Qué hay que comprar`, label `Cantidad`, button `Añadir` |
| `/compras` | each item | `<li data-testid="item">` with a checkbox labelled by the item name, button `Editar {name}`, button `Borrar {name}` |
| `/compras` | edit | inline input labelled `Nombre`, button `Guardar` |
| `/compras` | sections | heading `Por comprar`, heading `Comprado` (only when it has items) |
| `/compras` | empty | `Nada por comprar. ¡Qué paz!` |
| errors | any form | text inside an element with `role="alert"` |
| tab bar | `<nav aria-label="Navegación principal">` | links `Inicio` (`/`), `Compras` (`/compras`), `Ajustes` (`/ajustes`); active one has `aria-current="page"` |

### Component hierarchy

```
src/app/layout.tsx (server) — <html lang="es">, fonts, metadata, viewport, SW registration <Script>
├─ (auth)/entrar/page.tsx (server) — <form action={signIn}> … error from ?error= / action state
├─ bienvenida/page.tsx (server) — two <form>s with inline "use server" actions; error from ?error=
└─ (app)/layout.tsx (server) — <main> with bottom padding + <TabBar /> (client: usePathname)
   ├─ page.tsx (server) — reads profile + household, maps registry → <MicroAppTile /> (server)
   ├─ compras/page.tsx (server) — reads items + household id + member names
   │  └─ <ShoppingList initialItems householdId names /> (client)
   │     ├─ useOptimistic + useTransition → actions.ts
   │     ├─ useRealtimeItems(householdId) (step 11) → reconciles by id
   │     └─ <Toaster /> (sonner) + motion <AnimatePresence>
   └─ ajustes/page.tsx (server) — code, members, <form action={signOut}>, <PushToggle /> (client, step 13)
```

### Micro-app registry (`src/micro-apps/registry.ts`, step 9)

```ts
export const ICONOS = ["ShoppingCart", "CheckSquare", "Wallet"] as const;
export type Icono = (typeof ICONOS)[number];

export type MicroApp = {
  id: string;
  nombre: string;
  descripcion: string;
  icono: Icono;
  ruta: `/${string}`;
  enabled: boolean;
};

export const MICRO_APPS: readonly MicroApp[] = [
  {
    id: "lista-compras",
    nombre: "Lista de compras",
    descripcion: "Lo que falta en casa, compartido al instante.",
    icono: "ShoppingCart",
    ruta: "/compras",
    enabled: true,
  },
];

export const enabledMicroApps = (): MicroApp[] => MICRO_APPS.filter((app) => app.enabled);
```

`src/components/micro-app-tile.tsx` maps the `icono` name to the Phosphor component (imported from
`@phosphor-icons/react/ssr`, `weight="duotone"`). `CheckSquare` and `Wallet` are reserved names for future
micro apps; no entry uses them in v1.

### State management

Server state comes from Server Components (no client fetching library). The only client state is the
shopping list: `useOptimistic` over the server-provided items, reconciled by Realtime events (step 11) keyed
by `id` — an incoming row replaces the local one whose `id` matches, rows with `deleted_at` are removed. The
optimistic add generates the item `id` with `crypto.randomUUID()` so the echo from Realtime dedupes
naturally. No global store, no React Query, no localStorage of data.

### Loading, empty, and error states

| Surface | Loading | Empty | Error |
|---|---|---|---|
| `/compras` list | `src/app/(app)/compras/loading.tsx` is NOT added; the server render is the first paint and optimistic UI covers writes | `Nada por comprar. ¡Qué paz!` with a Phosphor `Basket` illustration | failed action → item rolls back + `toast.error("Algo salió mal. Inténtalo de nuevo.")` |
| Realtime | — | — | channel `CHANNEL_ERROR`/`TIMED_OUT` → small banner `Sin sincronización en vivo — recarga para ver lo último` (`role="status"`) |
| `/` tiles | server render | impossible in v1 (one enabled app) | — |
| Forms (auth, hogar) | submit button shows `…` and `disabled` while pending (`useFormStatus`) | — | `role="alert"` text from the error code table (§5) |
| Whole app | — | — | `src/app/global-error.tsx`: `Algo salió mal` + button `Reintentar` (calls `reset()`) |

---

## 7. Design System

Produced with `ui-ux-pro-max` in the design phase ("flat soft UI", friendly and modern). Every value is a
literal; `src/app/globals.css` (step 2, full content in step 2's **Do**) is the single source.

### Colors

| Token | Light | Dark | Usage |
|---|---|---|---|
| `--primary` | `#C2410C` | `#FB923C` | primary buttons, active tab, links, focus ring (`--ring` = same) |
| `--primary-fg` (`--on-primary`) | `#FFFFFF` | `#1C1917` | text on primary |
| `--primary-soft` | `#FFEDD5` | `#3A3431` | selected tile background, chips |
| `--background` | `#FFFBEB` | `#1C1917` | page |
| `--surface` | `#FFFFFF` | `#292524` | cards, sheets, tab bar |
| `--border` | `#EDE4D8` | `#44403C` | dividers, inputs |
| `--fg` (`--foreground`) | `#1C1917` | `#FAFAF9` | body text |
| `--fg-muted` (`--muted-foreground`) | `#57534E` | `#D6D3D1` | secondary text, quantities |
| `--muted` | `#F5F0E8` | `#3A3431` | input fill, bought items |
| `--destructive` | `#DC2626` | `#F87171` | errors, delete |
| `--success` | `#047857` | `#34D399` (text on it `#052E16`) | checkmarks, "Comprado" |
| `--accent` | `#D97706` | `#D97706` | decorative only (illustrations, tile glyph duotone) — never text |

**Contrast** (WCAG 2.2 AA, computed from the hex values above):
- `#FFFFFF` on `--primary` `#C2410C`: **5.2:1** — passes for button text.
- `--fg-muted` `#57534E` on `--muted` `#F5F0E8`: **6.7:1** — passes.
- `#1C1917` on dark `--primary` `#FB923C`: **7.7:1** — passes.
- The brief's success `#059669` measured **3.8:1** with white text and failed 4.5:1, so `--success` light is
  **`#047857` (5.5:1 with white)**. Accent `#D97706` is ~3.1:1 on the background and is therefore never
  used for text.

### Typography

| Role | Family | Size / line-height | Weight | Tracking |
|---|---|---|---|---|
| Display (h1) | Nunito (`--font-heading`) | 34px / 1.15 | 800 | -0.01em |
| Heading (h2/h3) | Nunito | 22px / 1.25 · 18px / 1.3 | 800 | 0 |
| Body | DM Sans (`--font-sans`) | 16px / 1.5 | 400 (500 for labels and buttons) | 0 |
| Small | DM Sans | 14px / 1.45 | 400 | 0 |
| Mono | NOT APPLICABLE — no code or tabular data in the UI | — | — | — |

**Font loading:** `next/font/google` self-hosts both fonts at build time (needs network during `pnpm build`),
`subsets: ["latin"]`, `display: "swap"` at the loader call site, exposed as CSS variables `--font-nunito` and
`--font-dm-sans`. Fallback stack: `ui-rounded, system-ui, sans-serif` (headings), `system-ui, -apple-system,
sans-serif` (body). next/font's generated metric-fallback `@font-face` rules carry no `font-display`, so no
criterion asserts font-display over the built CSS.

### Spacing, radius, elevation
- Spacing scale: 4px base — 4, 8, 12, 16, 20, 24, 32, 40 (Tailwind 1, 2, 3, 4, 5, 6, 8, 10).
- Radius: cards `20px` (`--radius-card`), inputs `14px` (`--radius-input`), buttons and chips `9999px`.
- Shadows: flat by default (borders only); one token `--shadow-sheet: 0 -8px 32px rgb(28 25 23 / 0.12)` for toasts and the bottom tab bar.
- Max content width: `640px` centred · Breakpoints: Tailwind defaults; design target 375px (iPhone) — no layout above `sm` changes structure.
- Safe areas: `viewport-fit=cover`; body padding-top `env(safe-area-inset-top)`; tab bar padding-bottom `env(safe-area-inset-bottom)`; `(app)` main padding-bottom `calc(72px + env(safe-area-inset-bottom))`.

### Motion
- Library: `motion/react`. Default spring `{ type: "spring", stiffness: 500, damping: 40 }` (~200 ms settle).
- Check-off: the checkmark scales 0.6→1 (180 ms) and the name gets a strike-through whose width animates 0→100% (200 ms); the row then moves to `Comprado` with `layout` animation.
- New item (local or realtime): enter `opacity 0→1, y 8→0` 200 ms; realtime batches stagger 40 ms per item.
- Exit (delete): `opacity →0, height →0` in 130 ms (≈ 65% of enter).
- Tab switch / pages: no page transitions.
- `prefers-reduced-motion: reduce`: `useReducedMotion()` true → no transforms, no stagger; state changes are instant. Toasts still appear.

### Component style

Flat soft UI: warm cream background, white cards with a 1px `--border` and 20px corners, pill buttons in the
burnt-orange primary, generous 16–20px padding, rounded Nunito headings and friendly Spanish copy ("¡Qué
paz!"). No gradients, no glassmorphism, near-zero shadows. A new component belongs if it is a bordered white
card or a pill, uses tokens only, and is at least 44px tall when interactive. Bottom tab bar iOS-style with
three Phosphor icons + labels (Inicio `House`, Compras `ShoppingCart`, Ajustes `GearSix`).

---

## 8. Authentication & Authorization

### Provider and rationale
Supabase Auth via `@supabase/ssr` (cookies, PKCE). The users live in the same Postgres as the RLS policies,
so `auth.uid()` is the authorization primitive everywhere. Google OAuth is primary; email + password is the
always-available fallback because the Google round trip from an **installed** iPhone PWA is unverified
(§20.2 risk 1).

### Flows
- **Registro (correo):** `/registro` → `signUp` action validates (`Nombre` 1–60, valid `Correo`, `Contraseña` ≥ 8) → `supabase.auth.signUp({ email, password, options: { data: { full_name } } })`. Email confirmation is disabled locally (`supabase/config.toml`) and in the cloud dashboard (§20.1), so a session exists immediately → redirect `/` → proxy sends a user without household to `/bienvenida`. Existing email → `correo_en_uso`.
- **Entrar (correo):** `signInWithPassword`; failure → `credenciales_invalidas` (`Correo o contraseña incorrectos`), no detail about which field.
- **Google:** button `Continuar con Google` submits `signInWithGoogle` → `signInWithOAuth({ provider: "google", options: { redirectTo: `${origin}/auth/callback` } })` (origin from the request `origin` header, falling back to `NEXT_PUBLIC_SITE_URL`) → `redirect(data.url)` → Google → `/auth/callback` exchanges the code → `/` (or safe `next`). Error → `/entrar?error=oauth` showing `No pudimos entrar con Google. Prueba con tu correo.`
- **Onboarding:** `/bienvenida` → `Crear hogar` (RPC `create_household`) or `Unirme` (RPC `join_household`), errors mapped per §5.
- **Password reset:** NOT in v1 — two known users; reset is done from the Supabase dashboard (Authentication → Users → Send password recovery). Listed in §20.4.
- **Session expiry:** access tokens refresh in `src/proxy.ts` on every request; an expired refresh token → no user → `/entrar?next=<path>`.
- **Sign-out:** `signOut` action in `/ajustes` → `supabase.auth.signOut()` → redirect `/entrar`.
- **Account deletion:** NOT in v1 (manual from the dashboard; cascades remove profile, membership, subscriptions; items keep `created_by = null`).

### Route protection

| Surface | Rule | Enforced where |
|---|---|---|
| `/`, `/compras`, `/ajustes` | authenticated **and** member of a household | `src/proxy.ts` (redirect) + RLS (data) |
| `/bienvenida` | authenticated without household (members → `/`) | `src/proxy.ts` |
| `/entrar`, `/registro` | anonymous (signed-in → `/`) | `src/proxy.ts` |
| `/auth/callback`, `/offline`, `/manifest.webmanifest`, `/sw.js`, `/icons/*`, `/api/health` | public (health checks its bearer itself) | proxy matcher excludes them / `PUBLIC_PATHS` |
| Every Server Action | `getUser()` non-null, household from DB | inside each action file |
| Every row | membership | Postgres RLS (§4) |

**Enforcement rule:** authorization is checked server-side on every request. Client-side route guards are
cosmetic and never the only check. A hidden button is not a permission.

### Roles and permissions

| Role | Can | Cannot |
|---|---|---|
| `owner` | everything a member can + rename the household (`households_update_owner`) | leave or delete the household (v1) |
| `member` | read the household, its members' profiles and items; create/edit/check/soft-delete/restore items; manage own push subscriptions | rename the household; see any other household's rows |
| anonymous | sign up / sign in | read any table row (RLS: `to authenticated` only) |

### Sessions
Supabase JWT access token + refresh token stored by `@supabase/ssr` in cookies `sb-<project-ref>-auth-token`
(chunked). Cookie flags are set by `@supabase/ssr`: `Path=/`, `SameSite=Lax`, `Secure` in production; the
cookie is readable by JS because the browser Realtime client needs the token. Access token lifetime 3600 s
(Supabase default), refreshed in `src/proxy.ts`. Cookie adapters implement **only** `getAll`/`setAll`. CSRF:
Server Actions are POST-only and Next.js compares the `Origin` header against the host; there are no
cookie-authenticated GET mutations.

### Multi-tenancy / row-level isolation
Mechanism: **Postgres RLS on every table**, with membership resolved by the security-definer helpers
`is_household_member`, `is_household_owner`, `shares_household`. Server Actions additionally derive
`household_id` from the caller's membership row, never from client input. Realtime subscriptions are filtered
by `household_id` and Supabase Realtime re-checks the `select` policy for each INSERT/UPDATE event; DELETE
events would bypass RLS, which is why items are soft-deleted. Isolation is proven by pgTAP in step 5.

---

## 9. BUILD ORDER

**This is the section the whole blueprint exists to produce.** A builder that follows Section 9 exactly and
stops when each gate goes green ships the project.

### The rules of a step

1. **One sitting per step.** At most **5 files** and **2–6 acceptance criteria** per step — the same numbers `tasks.json` and the epics use.
2. **Every step carries all four fields:** `Do`, `Done when`, `Verify`, `Checkpoint`. The Checkpoint commits and tags `step-NN-<slug>`; that tag is the rollback target for the next step.
3. **"Done when" conditions are observable and machine-checkable**, in EARS form: **WHEN** `<trigger>` **THE SYSTEM SHALL** `<observable response>`.
4. **"It looks right" is banned.** Every criterion names a status, a computed value, a row, a text, an exit code.
5. **`Verify` is literal shell** run from the project root (Git Bash on Windows, bash in CI). Every line exits 0 when the step is correct; expected-failure checks use `status=0; cmd || status=$?; test "$status" -eq N`.
6. **A step is not done until its own verify commands pass** *and* every earlier step's still do.
7. **Rollback:** if a step goes wrong, `git reset --hard <previous step's tag>` and retry; never debug forward through a broken checkpoint.
8. **Never skip ahead.** If step 7 is blocked, stop and report.
9. **No step retroactively breaks an earlier gate.** Env validation degrades by step (§10 "Required by step"): `src/lib/env.ts` only parses the public Supabase pair when a Supabase client is created (step 6 on), and every server secret is read with `requireServerEnv()` at the call site of the feature that needs it. The one deliberate cross-step edit — step 8 makes `/` require a session, so step 8 also edits `tests/e2e/shell.spec.ts` to sign in first — ships in the same step that introduces the requirement.
10. **Never assert a derived number you did not count.** Gates assert properties ("every table §4 defines appears in the generated types", "exit 0, 0 failed"). The only counts are invariants: exactly one enabled micro app in v1, `select plan(11)` counted from the pgTAP file written in step 5, exactly two pushes for two non-actor subscriptions.
11. **A Verify may not depend on its own Checkpoint.** No `git status`, `git ls-files` or tag lookup appears in any step's `Verify`; tracked-file checks live in §20.1.
12. **Local services:** steps 4–6 and 8–13 need Docker Desktop running; their Verify starts Supabase with `pnpm db:start` (exits 0 when already running) and resets it with `pnpm db:reset`.

### One step, one unit — the counting rule

**One Section 9 step = one `tasks.json` task = one task block in an epic file.** 14 steps → 14 tasks →
2 epics: `epics/01-cimientos.md` (steps 1–7, `E1-T1`…`E1-T7`) and `epics/02-hogar-y-compras.md`
(steps 8–14, `E2-T1`…`E2-T7`). With 14 steps the legal epic count is exactly 2 (`ceil(14 ÷ 9)` = 2,
`floor(14 ÷ 5)` = 2).

### Step map

| # | Step | Depends on | Touches | Gate |
|---|---|---|---|---|
| 1 | Scaffold and toolchain gates green | — | `.nvmrc`, `src/app/page.tsx` (deleted), `src/app/(app)/page.tsx`, `src/lib/site.ts`, `tests/unit/site.test.ts` | `pnpm build && pnpm smoke` |
| 2 | Design tokens, fonts and app shell | 1 | `src/app/globals.css`, `src/app/layout.tsx`, `src/app/(app)/layout.tsx`, `src/components/tab-bar.tsx`, `tests/e2e/shell.spec.ts` | `pnpm test:e2e tests/e2e/shell.spec.ts` |
| 3 | Installable PWA: manifest, icons, worker | 2 | `public/icons/**`, `src/app/manifest.ts`, `public/sw.js`, `src/app/offline/page.tsx`, `tests/e2e/pwa.spec.ts` | `pnpm test:e2e tests/e2e/pwa.spec.ts` |
| 4 | Local Supabase, schema, RLS, seed and types | 1 | `supabase/config.toml`, `supabase/migrations/**` (the `init_schema` migration the CLI creates), `supabase/seed.sql`, `src/lib/database.types.ts`, `src/lib/env.ts` | `pnpm db:reset && pnpm db:types` |
| 5 | RLS isolation tests with pgTAP | 4 | `supabase/tests/rls_isolation.test.sql` | `pnpm db:test` |
| 6 | Email and password sign-up and sign-in | 2, 4 | `src/lib/supabase/server.ts`, `src/app/(auth)/entrar/page.tsx`, `src/app/(auth)/registro/page.tsx`, `src/app/(auth)/actions.ts`, `tests/e2e/auth.spec.ts` | `pnpm test:e2e tests/e2e/auth.spec.ts` |
| 7 | Google sign-in and OAuth callback route | 6 | `src/app/auth/callback/route.ts`, `src/lib/auth/safe-next.ts`, `src/app/(auth)/actions.ts`, `src/app/(auth)/entrar/page.tsx`, `tests/unit/auth-callback.test.ts` | `pnpm test tests/unit/auth-callback.test.ts` |
| 8 | Households: create, join by code, settings | 3, 5, 6 | `src/proxy.ts`, `src/app/bienvenida/page.tsx`, `src/app/(app)/ajustes/page.tsx`, `tests/e2e/household.spec.ts`, `tests/e2e/shell.spec.ts` | `pnpm test:e2e tests/e2e/household.spec.ts …` |
| 9 | Micro-app registry and Inicio tiles | 8 | `src/micro-apps/registry.ts`, `src/app/(app)/page.tsx`, `src/components/micro-app-tile.tsx`, `tests/unit/registry.test.ts`, `tests/e2e/home.spec.ts` | `pnpm test:e2e tests/e2e/home.spec.ts` |
| 10 | Shopping list CRUD with optimistic UI and undo | 9 | `src/app/(app)/compras/page.tsx`, `src/app/(app)/compras/actions.ts`, `src/app/(app)/compras/shopping-list.tsx`, `src/lib/shopping/schema.ts`, `tests/e2e/compras.spec.ts` | `pnpm test:e2e tests/e2e/compras.spec.ts` |
| 11 | Realtime sync of the shopping list | 10 | `src/lib/supabase/client.ts`, `src/app/(app)/compras/use-realtime-items.ts`, `src/app/(app)/compras/shopping-list.tsx`, `src/app/global-error.tsx`, `tests/e2e/realtime.spec.ts` | `pnpm test:e2e tests/e2e/realtime.spec.ts` |
| 12 | Push sender, logger and item triggers | 10 | `src/lib/supabase/admin.ts`, `src/lib/log.ts`, `src/lib/push/send.ts`, `src/app/(app)/compras/actions.ts`, `tests/unit/push-send.test.ts` | `pnpm test tests/unit/push-send.test.ts` |
| 13 | Enable-notifications button and subscription save | 8, 12 | `src/lib/push/actions.ts`, `src/lib/push/support.ts`, `src/components/push-toggle.tsx`, `src/app/(app)/ajustes/page.tsx`, `tests/unit/push-support.test.ts` | `pnpm test tests/unit/push-support.test.ts` |
| 14 | Sentry, health keep-alive and deploy config | 12 | `src/instrumentation.ts`, `src/instrumentation-client.ts`, `src/app/api/health/route.ts`, `tests/unit/deploy.test.ts`, `tests/e2e/health.spec.ts` | `pnpm test … && pnpm build && pnpm smoke && pnpm test:e2e` |

Ordering: the served entry point is **run** at step 1 (`pnpm smoke` starts the production build and requests
`/`). Steps 1–3 need no services, so the toolchain, the shell and the PWA contract are proven before Docker is
involved. The vertical slice (auth → household → list → realtime) follows the data layer; push, hardening and
deploy come last. Step 12 relabels the brief's "push" step as server-side only and step 13 carries the client
button, because the push work is seven files and the 5-file ceiling forces the split; Sentry moves to step 14
beside the health route for the same reason.

---

#### Step 1 — Scaffold and toolchain gates green

**Do**
§10 Bootstrap has already scaffolded Next.js, copied `workspace/`, pinned every dependency and made the first
commit. This step makes the scaffold *HomeBoard's* and proves the four toolchain gates plus the running server.
Create or change exactly these files:

- `.nvmrc` — one line: `26`
- `src/app/page.tsx` — **delete it** (the scaffold's demo page; the home route moves into the `(app)` group so step 2 can wrap it with the tab bar).
- `src/lib/site.ts`:

```ts
export const SITE_NAME = "HomeBoard";
export const SITE_DESCRIPTION = "Las micro apps de tu hogar, compartidas al instante.";
```

- `src/app/(app)/page.tsx`:

```tsx
import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/site";

export default function HomePage() {
  return (
    <section>
      <h1>{SITE_NAME}</h1>
      <p>{SITE_DESCRIPTION}</p>
    </section>
  );
}
```

- `tests/unit/site.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/site";

describe("site", () => {
  it("names the product HomeBoard", () => {
    expect(SITE_NAME).toBe("HomeBoard");
  });

  it("describes it in Spanish", () => {
    expect(SITE_DESCRIPTION).toMatch(/hogar/);
  });
});
```

Then run `pnpm format` once so the new files match `biome.json`. `pnpm smoke` (`scripts/smoke.mjs`, emitted in
§19.6) starts `.next` with the Next binary on port 3101, requests `/`, follows redirects, asserts status 200
and the text `HomeBoard`, and kills the server. It needs no env: nothing in the tree reads Supabase yet.

**Done when**
- [ ] **WHEN** `pnpm lint` and `pnpm typecheck` run on the bootstrapped tree with the bundle present at `blueprints/homeboard/` **THE SYSTEM SHALL** exit 0 on both.
- [ ] **WHEN** `pnpm test` runs **THE SYSTEM SHALL** execute `tests/unit/site.test.ts` and exit 0 with 0 failed and 0 skipped.
- [ ] **WHEN** `pnpm smoke` runs after `pnpm build` **THE SYSTEM SHALL** start the production server on port 3101, receive HTTP 200 for `/` with a body containing `HomeBoard`, stop the server and exit 0.
- [ ] **WHEN** `git check-ignore -q --no-index .env.example` runs **THE SYSTEM SHALL** exit 1 (not ignored), and **WHEN** `git check-ignore -q .env.local` runs **THE SYSTEM SHALL** exit 0 (ignored).

**Verify**
```bash
pnpm lint                                                                                  # expect: exit 0
pnpm typecheck                                                                             # expect: exit 0
pnpm test                                                                                  # expect: exit 0
pnpm build                                                                                 # expect: exit 0
pnpm smoke                                                                                 # expect: exit 0
status=0; git check-ignore -q --no-index .env.example || status=$?; test "$status" -eq 1   # expect: exit 0
git check-ignore -q .env.local                                                             # expect: exit 0
```

**Checkpoint**
```bash
git add -A && git commit -m "step 1: scaffold"
git tag step-01-scaffold
# rollback target if this step goes wrong: the Bootstrap commit (git reset --hard HEAD)
```

---

#### Step 2 — Design tokens, fonts and app shell

**Do**
Implement §7 as code. Use the `ui-ux-pro-max` skill if installed (§18); the values below are final either way.

- `src/app/globals.css` — replace the scaffold's file entirely with:

```css
@import "tailwindcss";
@source not "../../blueprints";

@custom-variant dark (&:where(.dark, .dark *));

:root {
  --background: #fffbeb;
  --surface: #ffffff;
  --foreground: #1c1917;
  --muted: #f5f0e8;
  --muted-foreground: #57534e;
  --border: #ede4d8;
  --primary: #c2410c;
  --on-primary: #ffffff;
  --primary-soft: #ffedd5;
  --success: #047857;
  --on-success: #ffffff;
  --accent: #d97706;
  --destructive: #dc2626;
  --ring: #c2410c;
  color-scheme: light;
}

@media (prefers-color-scheme: dark) {
  :root:not(.light) {
    --background: #1c1917;
    --surface: #292524;
    --foreground: #fafaf9;
    --muted: #3a3431;
    --muted-foreground: #d6d3d1;
    --border: #44403c;
    --primary: #fb923c;
    --on-primary: #1c1917;
    --primary-soft: #3a3431;
    --success: #34d399;
    --on-success: #052e16;
    --destructive: #f87171;
    --ring: #fb923c;
    color-scheme: dark;
  }
}

.dark {
  --background: #1c1917;
  --surface: #292524;
  --foreground: #fafaf9;
  --muted: #3a3431;
  --muted-foreground: #d6d3d1;
  --border: #44403c;
  --primary: #fb923c;
  --on-primary: #1c1917;
  --primary-soft: #3a3431;
  --success: #34d399;
  --on-success: #052e16;
  --destructive: #f87171;
  --ring: #fb923c;
  color-scheme: dark;
}

@theme inline {
  --color-background: var(--background);
  --color-surface: var(--surface);
  --color-foreground: var(--foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-border: var(--border);
  --color-primary: var(--primary);
  --color-on-primary: var(--on-primary);
  --color-primary-soft: var(--primary-soft);
  --color-success: var(--success);
  --color-on-success: var(--on-success);
  --color-accent: var(--accent);
  --color-destructive: var(--destructive);
  --color-ring: var(--ring);
  --font-heading: var(--font-nunito), ui-rounded, system-ui, sans-serif;
  --font-sans: var(--font-dm-sans), system-ui, -apple-system, sans-serif;
  --radius-card: 20px;
  --radius-input: 14px;
  --shadow-sheet: 0 -8px 32px rgb(28 25 23 / 0.12);
}

html {
  background-color: var(--background);
}

body {
  background-color: var(--background);
  color: var(--foreground);
  font-family: var(--font-sans);
  font-size: 16px;
  line-height: 1.5;
  padding-top: env(safe-area-inset-top);
  -webkit-tap-highlight-color: transparent;
}

h1,
h2,
h3 {
  font-family: var(--font-heading);
  font-weight: 800;
}

:focus-visible {
  outline: 3px solid var(--ring);
  outline-offset: 2px;
}
```

- `src/app/layout.tsx` — replace the scaffold's file entirely with:

```tsx
import type { Metadata, Viewport } from "next";
import { DM_Sans, Nunito } from "next/font/google";
import Script from "next/script";
import type { ReactNode } from "react";
import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/site";
import "./globals.css";

const nunito = Nunito({ subsets: ["latin"], weight: ["800"], variable: "--font-nunito", display: "swap" });
const dmSans = DM_Sans({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-dm-sans", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  title: { default: SITE_NAME, template: `%s · ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  appleWebApp: { capable: true, title: SITE_NAME, statusBarStyle: "black-translucent" },
  icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FFFBEB" },
    { media: "(prefers-color-scheme: dark)", color: "#1C1917" },
  ],
};

// The worker file ships in step 3; until then registration fails quietly by design.
const SW_REGISTER = `if ("serviceWorker" in navigator) { window.addEventListener("load", function () { navigator.serviceWorker.register("/sw.js").catch(function () {}); }); }`;

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="es" className={`${nunito.variable} ${dmSans.variable}`}>
      <body>
        {children}
        <Script id="sw-register" strategy="afterInteractive">
          {SW_REGISTER}
        </Script>
      </body>
    </html>
  );
}
```

- `src/app/(app)/layout.tsx`:

```tsx
import type { ReactNode } from "react";
import { TabBar } from "@/components/tab-bar";

export default function AppLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <>
      <main className="mx-auto w-full max-w-[640px] px-4 pt-4 pb-[calc(72px+env(safe-area-inset-bottom))]">
        {children}
      </main>
      <TabBar />
    </>
  );
}
```

- `src/components/tab-bar.tsx`:

```tsx
"use client";

import { GearSix, House, ShoppingCart } from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "Inicio", Icon: House },
  { href: "/compras", label: "Compras", Icon: ShoppingCart },
  { href: "/ajustes", label: "Ajustes", Icon: GearSix },
] as const;

export function TabBar() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Navegación principal"
      className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] shadow-sheet"
    >
      <ul className="mx-auto flex max-w-[640px]">
        {TABS.map(({ href, label, Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs font-medium ${active ? "text-primary" : "text-muted-foreground"}`}
              >
                <Icon size={24} weight={active ? "fill" : "regular"} aria-hidden="true" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
```

- `tests/e2e/shell.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 375, height: 812 } });

test("no horizontal scroll at 375px", async ({ page }) => {
  await page.goto("/");
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBe(0);
});

const SCHEMES = [
  ["dark", "rgb(28, 25, 23)"],
  ["light", "rgb(255, 251, 235)"],
] as const;

for (const [scheme, color] of SCHEMES) {
  test(`body background in ${scheme} mode`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto("/");
    const background = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(background).toBe(color);
  });
}

test("Spanish document with a 16px body", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "es");
  const size = await page.evaluate(() => getComputedStyle(document.body).fontSize);
  expect(size).toBe("16px");
});

test("bottom tab bar", async ({ page }) => {
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Navegación principal" });
  for (const name of ["Inicio", "Compras", "Ajustes"]) {
    const link = nav.getByRole("link", { name, exact: true });
    await expect(link).toBeVisible();
    const box = await link.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  }
  await expect(nav.getByRole("link", { name: "Inicio", exact: true })).toHaveAttribute("aria-current", "page");
});
```

`process.env.NEXT_PUBLIC_SITE_URL` in the layout and the two hex literals in `viewport.themeColor` are the
documented exceptions to the env and token rules (metadata must be literal at build time; the site URL is
optional and must not make `build` depend on env). `/compras` and `/ajustes` return 404 until steps 10 and 8.

**Done when**
- [ ] **WHEN** `tests/e2e/shell.spec.ts` loads `/` at a 375x812 viewport **THE SYSTEM SHALL** report `document.documentElement.scrollWidth` equal to `clientWidth` (no horizontal scroll).
- [ ] **WHEN** the page is emulated with `prefers-color-scheme: dark` **THE SYSTEM SHALL** compute the `body` background as `rgb(28, 25, 23)`, and with `light` as `rgb(255, 251, 235)`.
- [ ] **WHEN** `/` renders **THE SYSTEM SHALL** set `<html lang="es">` and a computed `body` font-size of `16px`.
- [ ] **WHEN** `/` renders **THE SYSTEM SHALL** show a `nav` named `Navegación principal` with links `Inicio`, `Compras` and `Ajustes`, each at least 44px tall, and `Inicio` carrying `aria-current="page"`.

**Verify**
```bash
pnpm lint                               # expect: exit 0
pnpm typecheck                          # expect: exit 0
pnpm test:e2e tests/e2e/shell.spec.ts   # expect: exit 0
```

**Checkpoint**
```bash
git add -A && git commit -m "step 2: shell"
git tag step-02-shell
# rollback target if this step goes wrong: git reset --hard step-01-scaffold
```

---

#### Step 3 — Installable PWA: manifest, icons, worker

**Do**
- Run `pnpm icons` (`scripts/generate-icons.mjs`, emitted in §19.6). It writes `public/icons/icon-192.png`, `public/icons/icon-512.png`, `public/icons/icon-maskable-512.png` (house shrunk into the 80% safe zone) and `public/icons/apple-touch-icon.png` (180×180): a cream house on `#C2410C`. These four PNGs together count as **one generated unit**: they are always produced together by one command and treated as a single step output — `public/icons/**` in the step map and in every verify command. They are committed; their origin is the script, never a hand edit.
- `src/app/manifest.ts`:

```ts
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "HomeBoard",
    short_name: "HomeBoard",
    description: "Las micro apps de tu hogar, compartidas al instante.",
    lang: "es",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#FFFBEB",
    theme_color: "#C2410C",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
```

- `public/sw.js` (hand-written; push handlers ship now so step 12 needs no worker edit):

```js
const CACHE = "homeboard-v1";
const OFFLINE_URL = "/offline";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.add(new Request(OFFLINE_URL, { cache: "reload" })))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") {
    return;
  }
  event.respondWith(fetch(event.request).catch(() => caches.match(OFFLINE_URL)));
});

self.addEventListener("push", (event) => {
  let data = { title: "HomeBoard", body: "", url: "/", tag: "homeboard" };
  try {
    data = { ...data, ...event.data.json() };
  } catch {
    // payload missing or not JSON: show the generic notification
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      tag: data.tag,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url: data.url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url ?? "/", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      for (const client of windows) {
        if (client.url === url && "focus" in client) {
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
```

- `src/app/offline/page.tsx` — a static Server Component: Phosphor `WifiSlash` (from `@phosphor-icons/react/ssr`, size 48, `aria-hidden`), `<h1>Sin conexión</h1>`, `<p>HomeBoard necesita internet para sincronizar la lista. Vuelve a intentarlo cuando tengas señal.</p>`, and a pill link `Reintentar` to `/`. `export const metadata = { title: "Sin conexión" }`.
- `tests/e2e/pwa.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

test("manifest", async ({ request }) => {
  const response = await request.get("/manifest.webmanifest");
  expect(response.status()).toBe(200);
  const manifest = await response.json();
  expect(manifest.name).toBe("HomeBoard");
  expect(manifest.short_name).toBe("HomeBoard");
  expect(manifest.display).toBe("standalone");
  expect(manifest.start_url).toBe("/");
  const sizes = manifest.icons.map((icon: { sizes: string }) => icon.sizes);
  expect(sizes).toContain("192x192");
  expect(sizes).toContain("512x512");
  expect(manifest.icons.some((icon: { purpose?: string }) => icon.purpose === "maskable")).toBe(true);
});

test("service worker script", async ({ request }) => {
  const response = await request.get("/sw.js");
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toMatch(/javascript/);
});

test("offline page", async ({ request }) => {
  const response = await request.get("/offline");
  expect(response.status()).toBe(200);
  expect(await response.text()).toContain("Sin conexión");
});

for (const path of [
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-512.png",
  "/icons/apple-touch-icon.png",
]) {
  test(`icon ${path}`, async ({ request }) => {
    const response = await request.get(path);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toBe("image/png");
  });
}

test("iOS install metadata", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator('link[rel="apple-touch-icon"]').first()).toBeAttached();
  await expect(page.locator('meta[name="viewport"]')).toHaveAttribute("content", /viewport-fit=cover/);
});
```

**Done when**
- [ ] **WHEN** `GET /manifest.webmanifest` is requested **THE SYSTEM SHALL** return 200 JSON with `name` and `short_name` equal to `HomeBoard`, `display` equal to `standalone`, `start_url` equal to `/`, icons of sizes `192x192` and `512x512`, and one icon with `purpose` `maskable`.
- [ ] **WHEN** `GET /sw.js` is requested **THE SYSTEM SHALL** return 200 with a JavaScript content type.
- [ ] **WHEN** `GET /offline` is requested **THE SYSTEM SHALL** return 200 with a body containing `Sin conexión`.
- [ ] **WHEN** `/icons/icon-192.png`, `/icons/icon-512.png`, `/icons/icon-maskable-512.png` and `/icons/apple-touch-icon.png` are requested **THE SYSTEM SHALL** return 200 with content type `image/png` for each.
- [ ] **WHEN** `/` is loaded in the browser **THE SYSTEM SHALL** include a `link[rel="apple-touch-icon"]` and a viewport meta whose content contains `viewport-fit=cover`.

**Verify**
```bash
pnpm icons                            # expect: exit 0
pnpm lint                             # expect: exit 0
pnpm typecheck                        # expect: exit 0
pnpm test:e2e tests/e2e/pwa.spec.ts   # expect: exit 0
```

**Checkpoint**
```bash
git add -A && git commit -m "step 3: pwa"
git tag step-03-pwa
# rollback target if this step goes wrong: git reset --hard step-02-shell
```

---

#### Step 4 — Local Supabase, schema, RLS, seed and types

**Do**
Docker Desktop must be running (§10 Prerequisites). In order:

1. `pnpm exec supabase init` — only when `supabase/config.toml` does not exist yet (it creates `supabase/config.toml` and `supabase/.gitignore`; in a non-interactive shell it asks no IDE questions).
2. `pnpm db:config` — `scripts/patch-supabase-config.mjs` (§19.6) sets `[db] major_version = 17`, `site_url`, the redirect allow-list for ports 3000/3100/3101, `enable_confirmations = false`, and the `[auth.external.google]` block (disabled locally, `env()` references for its credentials).
3. `pnpm exec supabase migration new init_schema` — the CLI creates the migration file; paste the complete SQL from §4 *Schema* into it verbatim.
4. Write `supabase/seed.sql` with the complete content from §4 *Seed data*.
5. `pnpm db:start`, then `pnpm db:reset`, then `pnpm env:local` (writes `.env.local`: Supabase URL and keys from `supabase status`, plus generated VAPID keys and `CRON_SECRET`), then `pnpm db:types` (writes `src/lib/database.types.ts`).
6. `src/lib/env.ts`:

```ts
import { z } from "zod";

// Public values are inlined by Next at build time, so each is read with its literal name.
// Parsed lazily: nothing validates env at import time, so earlier steps' gates never need these values.
const blankToUndefined = (value: string | undefined) => (value === "" ? undefined : value);

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_SITE_URL: z.url().default("http://localhost:3000"),
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: z.string().min(1).optional(),
  NEXT_PUBLIC_SENTRY_DSN: z.string().min(1).optional(),
});

export type PublicEnv = z.infer<typeof publicSchema>;

export function getPublicEnv(): PublicEnv {
  return publicSchema.parse({
    NEXT_PUBLIC_SUPABASE_URL: blankToUndefined(process.env.NEXT_PUBLIC_SUPABASE_URL),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: blankToUndefined(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    NEXT_PUBLIC_SITE_URL: blankToUndefined(process.env.NEXT_PUBLIC_SITE_URL),
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: blankToUndefined(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY),
    NEXT_PUBLIC_SENTRY_DSN: blankToUndefined(process.env.NEXT_PUBLIC_SENTRY_DSN),
  });
}

export type ServerEnvKey = "SUPABASE_SERVICE_ROLE_KEY" | "VAPID_PRIVATE_KEY" | "VAPID_SUBJECT" | "CRON_SECRET";

/** Required only where consumed — §10 "Required by step" is the contract. */
export function requireServerEnv(key: ServerEnvKey): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Falta la variable de entorno ${key}`);
  }
  return value;
}
```

`supabase/config.toml` is generated by `supabase init` and edited only through `pnpm db:config`;
`src/lib/database.types.ts` is generated and never hand-edited (excluded from Biome).

**Done when**
- [ ] **WHEN** `pnpm db:reset` runs against the local Supabase stack **THE SYSTEM SHALL** apply the `init_schema` migration and `supabase/seed.sql` and exit 0.
- [ ] **WHEN** `pnpm db:types` runs **THE SYSTEM SHALL** write `src/lib/database.types.ts` containing the tables `profiles`, `households`, `household_members`, `shopping_items` and `push_subscriptions`.
- [ ] **WHEN** `pnpm env:local` runs twice in a row **THE SYSTEM SHALL** exit 0 both times, failing instead with exit 1 if `supabase status` reports no API URL, anon/publishable key or service-role/secret key.
- [ ] **WHEN** `pnpm typecheck` and `pnpm lint` run with the generated types and `src/lib/env.ts` **THE SYSTEM SHALL** exit 0.

**Verify**
```bash
pnpm db:start                                          # expect: exit 0
pnpm db:reset                                          # expect: exit 0
pnpm env:local                                         # expect: exit 0
pnpm env:local                                         # expect: exit 0
pnpm db:types                                          # expect: exit 0
grep -q profiles src/lib/database.types.ts             # expect: exit 0
grep -q households src/lib/database.types.ts           # expect: exit 0
grep -q household_members src/lib/database.types.ts    # expect: exit 0
grep -q shopping_items src/lib/database.types.ts       # expect: exit 0
grep -q push_subscriptions src/lib/database.types.ts   # expect: exit 0
pnpm typecheck                                         # expect: exit 0
pnpm lint                                              # expect: exit 0
```

**Checkpoint**
```bash
git add -A && git commit -m "step 4: schema"
git tag step-04-schema
# rollback target if this step goes wrong: git reset --hard step-03-pwa
```

---

#### Step 5 — RLS isolation tests with pgTAP

**Do**
Create `supabase/tests/rls_isolation.test.sql` with exactly this content. `plan(11)` is counted from the 11
assertions below; change both together. If an assertion fails, fix the `init_schema` migration (it has not
been pushed anywhere yet) and re-run `pnpm db:reset`.

```sql
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
```

**Done when**
- [ ] **WHEN** `pnpm db:test` runs `supabase/tests/rls_isolation.test.sql` as seed user Ana (household A) **THE SYSTEM SHALL** count 0 `shopping_items`, 0 `households` and 0 `household_members` rows of household B, and more than 0 items of her own household.
- [ ] **WHEN** Ana inserts a `shopping_items` row with household B's `household_id` **THE SYSTEM SHALL** raise SQLSTATE `42501`.
- [ ] **WHEN** Ana runs an UPDATE targeting household B's items **THE SYSTEM SHALL** change 0 rows.
- [ ] **WHEN** `join_household('ZZZZZZZZ')` is called **THE SYSTEM SHALL** raise `codigo_invalido`, and **WHEN** Ana, already a member, calls `join_household` with household B's code **THE SYSTEM SHALL** raise `ya_tiene_hogar`.
- [ ] **WHEN** the `anon` role selects from `shopping_items` **THE SYSTEM SHALL** return 0 rows, and **WHEN** Ana selects Bea's `profiles` row **THE SYSTEM SHALL** return 0 rows.

**Verify**
```bash
pnpm db:start   # expect: exit 0
pnpm db:reset   # expect: exit 0
pnpm db:test    # expect: exit 0
```

**Checkpoint**
```bash
git add -A && git commit -m "step 5: rls-tests"
git tag step-05-rls-tests
# rollback target if this step goes wrong: git reset --hard step-04-schema
```

---

#### Step 6 — Email and password sign-up and sign-in

**Do**
- `src/lib/supabase/server.ts`:

```ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/database.types";
import { getPublicEnv } from "@/lib/env";

export async function createClient() {
  const cookieStore = await cookies();
  const env = getPublicEnv();
  return createServerClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component render: src/proxy.ts (step 8) refreshes the session instead.
        }
      },
    },
  });
}
```

- `src/app/(auth)/actions.ts` — `"use server"` file exporting `signIn(formData)`, `signUp(formData)`, `signOut()`. Validate with zod (`Correo` → `z.email()`; `Contraseña` → string; on sign-up `Nombre` 1–60 trimmed and `Contraseña` length ≥ 8). Outcomes are redirects so the pages work without client JS: failure → `redirect("/entrar?error=credenciales_invalidas")`, `redirect("/registro?error=contrasena_corta")`, `redirect("/registro?error=correo_en_uso")` (Supabase `error.code === "user_already_exists"`), `redirect("/registro?error=datos_invalidos")`; success → `redirect("/")`. `signUp` passes `options: { data: { full_name: nombre } }` so the `on_auth_user_created` trigger sets `display_name`. `signOut` → `supabase.auth.signOut()` then `redirect("/entrar")`.
- `src/app/(auth)/entrar/page.tsx` — Server Component; `searchParams` is a Promise in Next 16 (`const { error } = await searchParams`). Card layout per §7: `<h1>Entra a HomeBoard</h1>`, a `<form action={signIn}>` with `<label>Correo</label>` (`type="email"`, `name="correo"`, `autoComplete="email"`) and `<label>Contraseña</label>` (`type="password"`, `name="contrasena"`, `autoComplete="current-password"`), submit `Entrar`, link `Crear cuenta nueva` → `/registro`. When `error` is present render `<p role="alert">` with the §5 copy for that code (`credenciales_invalidas` → `Correo o contraseña incorrectos`; `oauth` → `No pudimos entrar con Google. Prueba con tu correo.`). Never block paste; no CAPTCHA.
- `src/app/(auth)/registro/page.tsx` — same pattern: `<h1>Crea tu cuenta</h1>`, labels `Nombre` (`name="nombre"`), `Correo`, `Contraseña` (`autoComplete="new-password"`, **no `minLength` attribute** — the server validates so the error is announced), submit `Crear cuenta`, link `Ya tengo cuenta` → `/entrar`, `role="alert"` copy for `contrasena_corta`, `correo_en_uso`, `datos_invalidos`.
- `tests/e2e/auth.spec.ts`:

```ts
import { expect, type Page, test } from "@playwright/test";
import { registerUser, SEED_PASSWORD, SEED_USERS, signIn, uniqueEmail } from "./helpers";

async function hasSessionCookie(page: Page): Promise<boolean> {
  return (await page.context().cookies()).some((cookie) => cookie.name.startsWith("sb-"));
}

test("registro con correo nuevo crea la sesión", async ({ page }) => {
  await registerUser(page, "Prueba", uniqueEmail("registro"));
  expect(await hasSessionCookie(page)).toBe(true);
});

test("entrar con un usuario del seed", async ({ page }) => {
  await signIn(page, SEED_USERS.ana, SEED_PASSWORD);
  expect(await hasSessionCookie(page)).toBe(true);
});

test("contraseña incorrecta", async ({ page }) => {
  await page.goto("/entrar");
  await page.getByLabel("Correo", { exact: true }).fill(SEED_USERS.ana);
  await page.getByLabel("Contraseña", { exact: true }).fill("incorrecta-123");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText("Correo o contraseña incorrectos");
  await expect(page).toHaveURL(/\/entrar/);
  expect(await hasSessionCookie(page)).toBe(false);
});

test("contraseña corta en el registro", async ({ page }) => {
  await page.goto("/registro");
  await page.getByLabel("Nombre", { exact: true }).fill("Corta");
  await page.getByLabel("Correo", { exact: true }).fill(uniqueEmail("corta"));
  await page.getByLabel("Contraseña", { exact: true }).fill("1234");
  await page.getByRole("button", { name: "Crear cuenta", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText("La contraseña necesita al menos 8 caracteres");
  await expect(page).toHaveURL(/\/registro/);
});
```

After a successful sign-up the action redirects to `/`, which in this step still renders the step-1 page; from
step 8 the proxy forwards a user without household to `/bienvenida`. The tests assert "left `/registro`", so
they hold in both states. The `/entrar` heading contains `HomeBoard`, which keeps `pnpm smoke` green once step 8
redirects anonymous `/` there.

**Done when**
- [ ] **WHEN** a visitor submits `/registro` with Nombre, a new Correo and a Contraseña of at least 8 characters **THE SYSTEM SHALL** create the account, set a cookie whose name starts with `sb-`, and leave `/registro`.
- [ ] **WHEN** seed user `ana@homeboard.test` submits `/entrar` with password `homeboard-dev-1234` **THE SYSTEM SHALL** set a `sb-` session cookie and leave `/entrar`.
- [ ] **WHEN** `/entrar` is submitted with a wrong password **THE SYSTEM SHALL** stay on `/entrar`, set no `sb-` cookie and show `Correo o contraseña incorrectos` in an element with `role="alert"`.
- [ ] **WHEN** `/registro` is submitted with a Contraseña shorter than 8 characters **THE SYSTEM SHALL** stay on `/registro` and show `La contraseña necesita al menos 8 caracteres` in an element with `role="alert"`.

**Verify**
```bash
pnpm db:start                          # expect: exit 0
pnpm db:reset                          # expect: exit 0
pnpm lint                              # expect: exit 0
pnpm typecheck                         # expect: exit 0
pnpm test:e2e tests/e2e/auth.spec.ts   # expect: exit 0
```

**Checkpoint**
```bash
git add -A && git commit -m "step 6: auth-email"
git tag step-06-auth-email
# rollback target if this step goes wrong: git reset --hard step-05-rls-tests
```

---

#### Step 7 — Google sign-in and OAuth callback route

**Do**
- `src/lib/auth/safe-next.ts`:

```ts
/** Only same-origin relative paths survive; everything else becomes "/". Blocks open redirects. */
export function safeNextPath(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) {
    return "/";
  }
  return raw;
}
```

- `src/app/auth/callback/route.ts`:

```ts
import { type NextRequest, NextResponse } from "next/server";
import { safeNextPath } from "@/lib/auth/safe-next";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"));
  if (!code) {
    return NextResponse.redirect(`${origin}/entrar?error=oauth`);
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(`${origin}/entrar?error=oauth`);
  }
  const forwardedHost = request.headers.get("x-forwarded-host");
  const base = process.env.NODE_ENV === "development" || !forwardedHost ? origin : `https://${forwardedHost}`;
  return NextResponse.redirect(`${base}${next}`);
}
```

- `src/app/(auth)/actions.ts` — add `signInWithGoogle()`: read `origin` from `(await headers()).get("origin")`, falling back to `getPublicEnv().NEXT_PUBLIC_SITE_URL`; call `supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${origin}/auth/callback` } })`; on error `redirect("/entrar?error=oauth")`; on success `redirect(data.url)`. `@supabase/ssr` stores the PKCE verifier cookie through the server client's `setAll`.
- `src/app/(auth)/entrar/page.tsx` — add a second `<form action={signInWithGoogle}>` with a pill button `Continuar con Google` (Phosphor `GoogleLogo` from `@phosphor-icons/react/ssr`, `aria-hidden`), above the email form, separated by a `o con tu correo` divider.
- `tests/unit/auth-callback.test.ts` — mocks `@/lib/supabase/server` and asserts every acceptance criterion:

```ts
import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

const { exchangeCodeForSession } = vi.hoisted(() => ({ exchangeCodeForSession: vi.fn() }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { exchangeCodeForSession } }),
}));

import { GET } from "@/app/auth/callback/route";

const BASE = "http://localhost:3000/auth/callback";

function call(query: string, headers: Record<string, string> = {}) {
  return GET(new NextRequest(`${BASE}${query}`, { headers }));
}

describe("GET /auth/callback", () => {
  it("exchanges the code and redirects to next", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: null });
    const response = await call("?code=abc&next=/compras");
    expect(exchangeCodeForSession).toHaveBeenCalledTimes(1);
    expect(exchangeCodeForSession).toHaveBeenCalledWith("abc");
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost:3000/compras");
  });

  it("redirects to /entrar?error=oauth without a code", async () => {
    const response = await call("");
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost:3000/entrar?error=oauth");
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it("redirects to /entrar?error=oauth when the exchange fails", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: { message: "invalid" } });
    const response = await call("?code=bad");
    expect(response.headers.get("location")).toBe("http://localhost:3000/entrar?error=oauth");
  });

  it.each(["//evil.example", "https://evil.example", "/\\evil.example"])("rejects next=%s", async (next) => {
    exchangeCodeForSession.mockResolvedValue({ error: null });
    const response = await call(`?code=abc&next=${encodeURIComponent(next)}`);
    expect(response.headers.get("location")).toBe("http://localhost:3000/");
  });

  it("honours x-forwarded-host outside development", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: null });
    const response = await call("?code=abc&next=/compras", { "x-forwarded-host": "homeboard.vercel.app" });
    expect(response.headers.get("location")).toBe("https://homeboard.vercel.app/compras");
  });
});
```

Vitest runs with `NODE_ENV=test`, which is "not development", so the forwarded-host branch is exercised.
The local Google provider stays `enabled = false` (§10); the real round trip needs Google Cloud credentials
and is a §20.1 launch item, including the iPhone standalone test.

**Done when**
- [ ] **WHEN** `GET /auth/callback?code=abc&next=/compras` reaches the handler and `exchangeCodeForSession` succeeds **THE SYSTEM SHALL** call it once with `abc` and respond 307 to `http://localhost:3000/compras`.
- [ ] **WHEN** the callback is requested without `code`, or `exchangeCodeForSession` returns an error, **THE SYSTEM SHALL** respond 307 to `http://localhost:3000/entrar?error=oauth`.
- [ ] **WHEN** `next` is `//evil.example`, `https://evil.example` or `/\evil.example` **THE SYSTEM SHALL** redirect to `/` instead.
- [ ] **WHEN** the request carries `x-forwarded-host: homeboard.vercel.app` and `NODE_ENV` is not `development` **THE SYSTEM SHALL** redirect to `https://homeboard.vercel.app` plus the safe `next` path.

**Verify**
```bash
pnpm test tests/unit/auth-callback.test.ts   # expect: exit 0
pnpm lint                                    # expect: exit 0
pnpm typecheck                               # expect: exit 0
pnpm build                                   # expect: exit 0
```

**Checkpoint**
```bash
git add -A && git commit -m "step 7: auth-google"
git tag step-07-auth-google
# rollback target if this step goes wrong: git reset --hard step-06-auth-email
```

---

#### Step 8 — Households: create, join by code, settings

**Do**
- `src/proxy.ts` (Next 16: the file is `proxy.ts`, the export is `proxy`, it runs on Node):

```ts
import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import type { Database } from "@/lib/database.types";
import { getPublicEnv } from "@/lib/env";

const PUBLIC_PATHS = ["/entrar", "/registro", "/auth/callback", "/offline"];
const AUTH_PAGES = ["/entrar", "/registro"];
const ONBOARDING = "/bienvenida";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const env = getPublicEnv();
  const supabase = createServerClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const redirectTo = (pathname: string, search = "") => {
    const url = request.nextUrl.clone();
    url.pathname = pathname;
    url.search = search;
    const redirect = NextResponse.redirect(url);
    for (const cookie of response.cookies.getAll()) {
      redirect.cookies.set(cookie);
    }
    return redirect;
  };

  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => path === p || path.startsWith(`${p}/`));

  let userId: string | null = null;
  try {
    const { data } = await supabase.auth.getUser();
    userId = data.user?.id ?? null;
  } catch {
    userId = null; // Supabase unreachable: treat as signed out rather than 500
  }

  if (!userId) {
    if (isPublic) {
      return response;
    }
    return redirectTo("/entrar", path === "/" ? "" : `?next=${encodeURIComponent(path)}`);
  }

  if (AUTH_PAGES.includes(path)) {
    return redirectTo("/");
  }
  if (isPublic) {
    return response;
  }

  const { data: membership } = await supabase
    .from("household_members")
    .select("household_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (!membership && path !== ONBOARDING) {
    return redirectTo(ONBOARDING);
  }
  if (membership && path === ONBOARDING) {
    return redirectTo("/");
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|icons/|api/health).*)"],
};
```

  Server Actions under `/` still authorize themselves (rule: `.claude/rules/server-actions.md`); the proxy only routes.
- `src/app/bienvenida/page.tsx` — Server Component outside `(app)` (no tab bar). Two cards: **Crea tu hogar** (`<label>Nombre del hogar</label>` `name="nombre"`, button `Crear hogar`) and **Únete con un código** (`<label>Código de invitación</label>` `name="codigo"`, `autoCapitalize="characters"`, button `Unirme`). Both forms use inline `"use server"` actions defined in the same file: `crearHogar` calls `supabase.rpc("create_household", { p_name })`, `unirseAHogar` calls `supabase.rpc("join_household", { p_code })`; success → `redirect("/")`; a Postgres error whose `message` is one of `codigo_invalido`, `ya_tiene_hogar`, `hogar_lleno`, `nombre_invalido` → `redirect("/bienvenida?error=<code>")`, anything else → `?error=error_inesperado`. The page reads `error` from `searchParams` and renders the §5 copy in `<p role="alert">` (`codigo_invalido` → `Ese código no existe`).
- `src/app/(app)/ajustes/page.tsx` — Server Component: `<h1>Ajustes</h1>`; card **Tu hogar** with the household name, the code in `<p data-testid="codigo-invitacion">` (large, letter-spaced, `font-heading`); card **Miembros** with `<ul aria-label="Miembros">` listing each member's `display_name` (and `(tú)` for the viewer); `<form action={signOut}>` with button `Cerrar sesión` (`signOut` from `src/app/(auth)/actions.ts`). Data: `household_members` + `households` + `profiles` for the caller's household (RLS returns only theirs).
- `tests/e2e/household.spec.ts`:

```ts
import { expect, test } from "@playwright/test";
import {
  createHousehold,
  joinHousehold,
  newIsolatedPage,
  readInviteCode,
  registerUser,
  uniqueEmail,
} from "./helpers";

test("anonymous requests go to /entrar but PWA assets stay public", async ({ page, request }) => {
  for (const path of ["/", "/compras", "/ajustes"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/entrar/);
  }
  for (const path of ["/manifest.webmanifest", "/sw.js", "/offline", "/icons/icon-192.png"]) {
    expect((await request.get(path)).status()).toBe(200);
  }
});

test("create a household, share the code, a second user joins", async ({ page, browser }) => {
  await registerUser(page, "Marta", uniqueEmail("marta"));
  await page.goto("/");
  await expect(page).toHaveURL(/\/bienvenida/);
  await createHousehold(page, "Casa de Marta");
  const code = await readInviteCode(page);

  const guest = await newIsolatedPage(browser);
  await registerUser(guest, "Pablo", uniqueEmail("pablo"));
  await joinHousehold(guest, code);
  await guest.goto("/ajustes");
  const members = guest.getByRole("list", { name: "Miembros" });
  await expect(members).toContainText("Marta");
  await expect(members).toContainText("Pablo");
});

test("an unknown code is rejected", async ({ page }) => {
  await registerUser(page, "Sin Hogar", uniqueEmail("sinhogar"));
  await page.goto("/bienvenida");
  await page.getByLabel("Código de invitación", { exact: true }).fill("ZZZZZZZZ");
  await page.getByRole("button", { name: "Unirme", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText("Ese código no existe");
  await expect(page).toHaveURL(/\/bienvenida/);
});

test("sign out clears the session", async ({ page }) => {
  await registerUser(page, "Salida", uniqueEmail("salida"));
  await createHousehold(page, "Casa de Salida");
  await page.goto("/ajustes");
  await page.getByRole("button", { name: "Cerrar sesión", exact: true }).click();
  await expect(page).toHaveURL(/\/entrar/);
  const cookies = await page.context().cookies();
  expect(cookies.some((cookie) => cookie.name.startsWith("sb-") && cookie.value !== "")).toBe(false);
});
```

- `tests/e2e/shell.spec.ts` — **edit** (the requirement step 8 introduces — `/` needs a session — ships with the test update): add `import { SEED_USERS, signIn } from "./helpers";` and, after `test.use(...)`, `test.beforeEach(async ({ page }) => { await signIn(page, SEED_USERS.ana); });`. Nothing else changes; seed user Ana belongs to Casa de Ana, so `/` renders the shell.

**Done when**
- [ ] **WHEN** an anonymous request hits `/`, `/compras` or `/ajustes` **THE SYSTEM SHALL** redirect to `/entrar`, while `/manifest.webmanifest`, `/sw.js`, `/offline` and `/icons/icon-192.png` still return 200 without a session.
- [ ] **WHEN** a signed-in user without a household requests `/` **THE SYSTEM SHALL** redirect to `/bienvenida`.
- [ ] **WHEN** that user submits `Crear hogar` with `Nombre del hogar` filled **THE SYSTEM SHALL** create the household with them as `owner`, land on `/`, and show an 8-character invite code in `[data-testid="codigo-invitacion"]` on `/ajustes`.
- [ ] **WHEN** a second new user submits that code in `Código de invitación` on `/bienvenida` **THE SYSTEM SHALL** land on `/`, and `/ajustes` SHALL list both members' names.
- [ ] **WHEN** `Unirme` is submitted with `ZZZZZZZZ` **THE SYSTEM SHALL** stay on `/bienvenida` and show `Ese código no existe` in an element with `role="alert"`.
- [ ] **WHEN** `Cerrar sesión` is pressed on `/ajustes` **THE SYSTEM SHALL** clear the `sb-` session cookie and land on `/entrar`.

**Verify**
```bash
pnpm db:start                                                                                                    # expect: exit 0
pnpm db:reset                                                                                                    # expect: exit 0
pnpm lint                                                                                                        # expect: exit 0
pnpm typecheck                                                                                                   # expect: exit 0
pnpm test:e2e tests/e2e/household.spec.ts tests/e2e/shell.spec.ts tests/e2e/pwa.spec.ts tests/e2e/auth.spec.ts   # expect: exit 0
```

**Checkpoint**
```bash
git add -A && git commit -m "step 8: household"
git tag step-08-household
# rollback target if this step goes wrong: git reset --hard step-07-auth-google
```

---

#### Step 9 — Micro-app registry and Inicio tiles

**Do**
- `src/micro-apps/registry.ts` — the exact content in §6 *Micro-app registry*.
- `src/components/micro-app-tile.tsx` — Server Component `MicroAppTile({ app }: { app: MicroApp })`: a `next/link` `<Link href={app.ruta}>` card (`rounded-card border border-border bg-surface p-5 min-h-11`) with the icon (map `ShoppingCart` / `CheckSquare` / `Wallet` → the Phosphor components from `@phosphor-icons/react/ssr`, `weight="duotone"`, size 32, `aria-hidden`, color `text-primary`), the `nombre` as the link's text (so its accessible name is the `nombre`) and the `descripcion` in `text-muted-foreground`.
- `src/app/(app)/page.tsx` — replace the step-1 page: `createClient()`, `getUser()`, read the caller's `profiles.display_name` and household `name` (via `household_members` → `households`); render `<h1>Hola, {display_name}</h1>`, `<p>{household name}</p>`, then a grid of `MicroAppTile` for `enabledMicroApps()`. Keep `SITE_NAME` out of this page (the smoke check is served by `/entrar` for anonymous visitors).
- `tests/unit/registry.test.ts` — imports `ICONOS`, `MICRO_APPS`, `enabledMicroApps` and asserts: ids unique (`new Set(ids).size === ids.length`); every `ruta` starts with `/`; `nombre` and `descripcion` non-empty after trim; every `icono` is in `ICONOS`; `enabledMicroApps().map((a) => a.id)` equals `["lista-compras"]` and its `ruta` is `/compras`.
- `tests/e2e/home.spec.ts`:

```ts
import { expect, test } from "@playwright/test";
import { SEED_USERS, signIn } from "./helpers";

test.use({ viewport: { width: 375, height: 812 } });

test.beforeEach(async ({ page }) => {
  await signIn(page, SEED_USERS.ana);
  await page.goto("/");
});

test("greets the member and shows the household", async ({ page }) => {
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Hola, Ana");
  await expect(page.getByText("Casa de Ana", { exact: true })).toBeVisible();
});

test("shows the shopping list tile", async ({ page }) => {
  const tile = page.getByRole("link", { name: /Lista de compras/ });
  await expect(tile).toHaveAttribute("href", "/compras");
  const box = await tile.boundingBox();
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
});
```

**Done when**
- [ ] **WHEN** `tests/unit/registry.test.ts` runs **THE SYSTEM SHALL** assert every registry entry has a unique `id`, a `ruta` starting with `/`, a non-empty `nombre` and `descripcion`, and an `icono` from the allowed icon names.
- [ ] **WHEN** `tests/unit/registry.test.ts` runs **THE SYSTEM SHALL** assert that the only enabled entry is `lista-compras` and that it points to `/compras`.
- [ ] **WHEN** seed user `ana@homeboard.test` opens `/` **THE SYSTEM SHALL** show the heading `Hola, Ana`, the household name `Casa de Ana`, and a `Lista de compras` tile linking to `/compras`.
- [ ] **WHEN** `/` renders at 375px wide **THE SYSTEM SHALL** keep every tile link at least 44px tall.

**Verify**
```bash
pnpm test tests/unit/registry.test.ts   # expect: exit 0
pnpm lint                               # expect: exit 0
pnpm typecheck                          # expect: exit 0
pnpm db:start                           # expect: exit 0
pnpm db:reset                           # expect: exit 0
pnpm test:e2e tests/e2e/home.spec.ts    # expect: exit 0
```

**Checkpoint**
```bash
git add -A && git commit -m "step 9: home"
git tag step-09-home
# rollback target if this step goes wrong: git reset --hard step-08-household
```

---

#### Step 10 — Shopping list CRUD with optimistic UI and undo

**Do**
- `src/lib/shopping/schema.ts` — zod schemas shared by client and server (no server imports here):

```ts
import { z } from "zod";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value === "" ? null : value))
    .nullish();

export const itemFieldsSchema = z.object({
  name: z.string().trim().min(1, "Escribe qué hay que comprar").max(120, "Máximo 120 caracteres"),
  quantity: optionalText(40),
  note: optionalText(200),
});

export const addItemSchema = itemFieldsSchema.extend({ id: z.uuid() });
export const updateItemSchema = itemFieldsSchema.extend({ id: z.uuid() });
export const toggleItemSchema = z.object({ id: z.uuid(), isDone: z.boolean() });
export const itemIdSchema = z.object({ id: z.uuid() });

export type ShoppingItem = {
  id: string;
  name: string;
  quantity: string | null;
  note: string | null;
  is_done: boolean;
  created_at: string;
  deleted_at: string | null;
};
```

- `src/app/(app)/compras/actions.ts` — `"use server"`; exports `addItem`, `updateItem`, `toggleItem`, `deleteItem`, `restoreItem`, each following §5 *Critical endpoints* and `.claude/rules/server-actions.md` (createClient → getUser → membership → `safeParse` → write → `revalidatePath("/compras")` → `{ ok, data | error }`). `addItem` inserts with the client `id` using `upsert(..., { onConflict: "id", ignoreDuplicates: true })`. Delete and restore only touch `deleted_at`. No push yet (step 12).
- `src/app/(app)/compras/page.tsx` — Server Component: reads the caller's household id and `shopping_items` where `deleted_at is null`, ordered `is_done asc, created_at asc`; renders `<h1>Compras</h1>` and `<ShoppingList initialItems={items} householdId={id} />`.
- `src/app/(app)/compras/shopping-list.tsx` — `"use client"`; `useOptimistic` + `useTransition` over the actions. Contract (labels are fixed by §6 *UI contract*): an add form (`Qué hay que comprar`, `Cantidad`, `Añadir`; the add generates `crypto.randomUUID()`); sections `Por comprar` and `Comprado`; each item an `<li data-testid="item">` with a native checkbox labelled by the item name (min 44px row), `Editar {name}` (inline `Nombre` input + `Guardar`) and `Borrar {name}` (Phosphor `Trash`, `aria-label`). Delete → optimistic removal + `toast("Borraste {name}", { action: { label: "Deshacer", onClick: restore } , duration: 5000 })`. Validation errors from the schema render in `<p role="alert">`. Empty state `Nada por comprar. ¡Qué paz!`. Motion per §7 (`AnimatePresence`, `layout`, strike-through on check, reduced-motion respected). Mount `<Toaster position="top-center" richColors />` from `sonner` inside this component (it is the only toast surface in v1).
- `tests/e2e/compras.spec.ts` — each test calls `newMemberWithHousehold(page, "<Nombre>")` (fresh, empty household) then `page.goto("/compras")`, and covers: empty state text visible; add `Leche` / `2 L` → visible in the `Por comprar` section and after `page.reload()`; `Editar Leche` → `Leche de avena` → `Guardar` → visible after reload; checking `Leche de avena` → the checkbox is checked under `Comprado` after reload, unchecking moves it back; `Borrar` → item gone and `Deshacer` visible; click `Deshacer` → item back; `Borrar` again, wait 5.5 s for the toast to expire, `page.reload()` → item gone; submitting the add form with an empty name → `role="alert"` reads `Escribe qué hay que comprar` and the list is still empty.

**Done when**
- [ ] **WHEN** a household member adds `Leche` with quantity `2 L` on `/compras` **THE SYSTEM SHALL** show it in the pending list, and it SHALL still be there after a page reload.
- [ ] **WHEN** the member edits that item's name to `Leche de avena` **THE SYSTEM SHALL** show the new name after a reload.
- [ ] **WHEN** the member marks it as bought **THE SYSTEM SHALL** show it under `Comprado` with its checkbox checked, still checked after a reload, and unchecking SHALL return it to the pending list.
- [ ] **WHEN** the member deletes it **THE SYSTEM SHALL** remove it and show a toast with a `Deshacer` button; pressing `Deshacer` SHALL restore it, and after a second delete and a reload it SHALL stay gone.
- [ ] **WHEN** an empty name is submitted **THE SYSTEM SHALL** create no item and show `Escribe qué hay que comprar` in an element with `role="alert"`.
- [ ] **WHEN** the household has no items **THE SYSTEM SHALL** show the empty state `Nada por comprar. ¡Qué paz!`.

**Verify**
```bash
pnpm db:start                             # expect: exit 0
pnpm db:reset                             # expect: exit 0
pnpm lint                                 # expect: exit 0
pnpm typecheck                            # expect: exit 0
pnpm test:e2e tests/e2e/compras.spec.ts   # expect: exit 0
```

**Checkpoint**
```bash
git add -A && git commit -m "step 10: shopping"
git tag step-10-shopping
# rollback target if this step goes wrong: git reset --hard step-09-home
```

---

#### Step 11 — Realtime sync of the shopping list

**Do**
- `src/lib/supabase/client.ts`:

```ts
import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/database.types";

let browserClient: ReturnType<typeof createBrowserClient<Database>> | undefined;

export function createClient() {
  browserClient ??= createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  );
  return browserClient;
}
```

  (Client bundles cannot call `getPublicEnv()`'s server-only guarantees; the two `NEXT_PUBLIC_` values are inlined at build — this file is the third documented `process.env` exception.)
- `src/app/(app)/compras/use-realtime-items.ts` — `"use client"` hook `useRealtimeItems(householdId, onChange)`: `supabase.channel(`compras:${householdId}`).on("postgres_changes", { event: "*", schema: "public", table: "shopping_items", filter: `household_id=eq.${householdId}` }, (payload) => onChange(payload.new as ShoppingItem)).subscribe((status) => …)`; exposes `live: boolean` (false on `CHANNEL_ERROR`/`TIMED_OUT`/`CLOSED`); removes the channel on unmount. Before subscribing, call `await supabase.realtime.setAuth()` so the socket carries the user's JWT (RLS on Realtime).
- `src/app/(app)/compras/shopping-list.tsx` — **edit**: keep server-confirmed items in state (`useState(initialItems)`) and reconcile every Realtime row by `id`: replace if present, append if new, drop if `deleted_at` is set; new remote rows animate in with a 40 ms stagger. When `live` is false show `<p role="status">Sin sincronización en vivo — recarga para ver lo último</p>`.
- `src/app/global-error.tsx` — `"use client"` root error boundary: renders its own `<html lang="es"><body>` with `<h1>Algo salió mal</h1>` and a `Reintentar` button calling `reset()`; in `useEffect` it calls `Sentry.captureException(error)` from `@sentry/nextjs` (a no-op until step 14 initialises Sentry with a DSN).
- `tests/e2e/realtime.spec.ts` — A = `page` with `newMemberWithHousehold(page, "Ana")`, code via `readInviteCode`; B = `newIsolatedPage(browser)` + `registerUser` + `joinHousehold`; both `goto("/compras")`. A adds `Tomates` → `expect(B.getByText("Tomates")).toBeVisible({ timeout: 5000 })`; A checks it → B's checkbox labelled `Tomates` `toBeChecked({ timeout: 5000 })`; A deletes it → B `toHaveCount(0, { timeout: 5000 })` on `getByText("Tomates")`. Isolation: C = a third isolated page with its own `newMemberWithHousehold`, on `/compras` while A adds `Secreto`; after `C.waitForTimeout(5000)` C has 0 elements with text `Secreto` (this is the one place a fixed wait is correct: it proves an absence).

**Done when**
- [ ] **WHEN** member A adds `Tomates` while member B of the same household has `/compras` open in a separate browser context **THE SYSTEM SHALL** show `Tomates` in B's list within 5000 ms without a reload.
- [ ] **WHEN** A marks `Tomates` as bought **THE SYSTEM SHALL** show it checked in B's list within 5000 ms without a reload.
- [ ] **WHEN** A deletes `Tomates` **THE SYSTEM SHALL** remove it from B's list within 5000 ms without a reload.
- [ ] **WHEN** a user of a different household has `/compras` open while A adds an item **THE SYSTEM SHALL** not show that item in that user's list after 5000 ms.

**Verify**
```bash
pnpm db:start                                                        # expect: exit 0
pnpm db:reset                                                        # expect: exit 0
pnpm lint                                                            # expect: exit 0
pnpm typecheck                                                       # expect: exit 0
pnpm build                                                           # expect: exit 0
pnpm test:e2e tests/e2e/realtime.spec.ts tests/e2e/compras.spec.ts   # expect: exit 0
```

**Checkpoint**
```bash
git add -A && git commit -m "step 11: realtime"
git tag step-11-realtime
# rollback target if this step goes wrong: git reset --hard step-10-shopping
```

---

#### Step 12 — Push sender, logger and item triggers

**Do**
- `src/lib/supabase/admin.ts`:

```ts
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { getPublicEnv, requireServerEnv } from "@/lib/env";

/** Service-role client. Bypasses RLS — import only from src/lib/push/send.ts and src/app/api/health/route.ts. */
export function createAdminClient() {
  return createClient<Database>(getPublicEnv().NEXT_PUBLIC_SUPABASE_URL, requireServerEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
```

- `src/lib/log.ts`:

```ts
type Level = "info" | "warn" | "error";
type Context = Record<string, unknown>;

const SENSITIVE = /(token|secret|password|contrasena|key|auth|p256dh|endpoint|email|correo)/i;

function redact(context: Context): Context {
  return Object.fromEntries(
    Object.entries(context).map(([key, value]) => [key, SENSITIVE.test(key) ? "[redacted]" : value]),
  );
}

function write(level: Level, event: string, context: Context = {}): void {
  const line = JSON.stringify({ level, event, time: new Date().toISOString(), ...redact(context) });
  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export const log = {
  info: (event: string, context?: Context) => write("info", event, context),
  warn: (event: string, context?: Context) => write("warn", event, context),
  error: (event: string, context?: Context) => write("error", event, context),
};
```

- `src/lib/push/send.ts`:

```ts
import { sendNotification, setVapidDetails, WebPushError } from "web-push";
import { log } from "@/lib/log";
import { createAdminClient } from "@/lib/supabase/admin";

export type PushPayload = { title: string; body: string; url: string; tag: string };

// setVapidDetails runs once per process, lazily: at module scope it would throw during builds and tests
// that have no VAPID keys (§10: VAPID is required from step 12 only where push is sent).
let vapidReady = false;

function ensureVapid(): boolean {
  if (vapidReady) {
    return true;
  }
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) {
    log.warn("push.disabled", { reason: "vapid_missing" });
    return false;
  }
  setVapidDetails(subject, publicKey, privateKey);
  vapidReady = true;
  return true;
}

export function buildItemPush(kind: "added" | "done", actorName: string, itemName: string): PushPayload {
  return kind === "added"
    ? { title: "Lista de compras", body: `${actorName} añadió ${itemName}`, url: "/compras", tag: "compras" }
    : { title: "Lista de compras", body: `${actorName} compró ${itemName}`, url: "/compras", tag: "compras" };
}

export async function sendPushToHousehold(
  householdId: string,
  exceptUserId: string,
  payload: PushPayload,
): Promise<{ sent: number; removed: number }> {
  if (!ensureVapid()) {
    return { sent: 0, removed: 0 };
  }
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("household_id", householdId)
    .neq("user_id", exceptUserId);
  if (error) {
    log.error("push.query_failed", { householdId, code: error.code });
    return { sent: 0, removed: 0 };
  }
  let sent = 0;
  const stale: string[] = [];
  await Promise.all(
    (data ?? []).map(async (subscription) => {
      try {
        await sendNotification(
          { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
          JSON.stringify(payload),
          { TTL: 3600, urgency: "normal" },
        );
        sent += 1;
      } catch (err) {
        if (err instanceof WebPushError && (err.statusCode === 404 || err.statusCode === 410)) {
          stale.push(subscription.id);
        } else {
          log.warn("push.send_failed", { status: err instanceof WebPushError ? err.statusCode : null });
        }
      }
    }),
  );
  if (stale.length > 0) {
    await admin.from("push_subscriptions").delete().in("id", stale);
  }
  return { sent, removed: stale.length };
}
```

- `src/app/(app)/compras/actions.ts` — **edit**: after a successful `addItem`, and after `toggleItem` with `isDone: true`, read the actor's `display_name` and call a local `notify(householdId, user.id, buildItemPush(...))` that does `void sendPushToHousehold(...).catch((error) => log.error("push.failed", { message: String(error) }))` — never awaited into the response, never surfaced to the user.
- `tests/unit/push-send.test.ts` — `vi.mock("web-push", ...)` returning `setVapidDetails`, `sendNotification` (vi.fn) and a real `class WebPushError extends Error { constructor(public statusCode: number) { super("push") } }`; `vi.mock("@/lib/supabase/admin", ...)` returning a chainable fake whose `select().eq().neq()` resolves to the given subscription rows and whose `delete().in(...)` records the ids. For each test: `vi.resetModules()`, set or unset the three VAPID vars with `vi.stubEnv`, then `await import("@/lib/push/send")` (the module caches `vapidReady`). Cases: two non-actor rows → `sendNotification` called 2 times with a string whose `JSON.parse` has `title`, `body`, `url`, `tag` (the fake filters the actor's row out exactly as `.neq` would, and the test asserts `.neq` was called with the actor id); a rejection with `new WebPushError(410)` → its id passed to `.in("id", [...])` and `removed === 1`; VAPID unset → `{ sent: 0, removed: 0 }` and `sendNotification` not called; `buildItemPush("added", "Ana", "Leche").body === "Ana añadió Leche"`, `buildItemPush("done", "Ana", "Leche").body === "Ana compró Leche"`, both `url === "/compras"`.

**Done when**
- [ ] **WHEN** `sendPushToHousehold` runs for a household with one subscription of the actor and two of other members, with `web-push` mocked, **THE SYSTEM SHALL** call `sendNotification` exactly twice, never for the actor, with a JSON payload carrying `title`, `body`, `url` and `tag`.
- [ ] **WHEN** the mocked `sendNotification` rejects with a `WebPushError` of status 410 or 404 **THE SYSTEM SHALL** delete that subscription row and report it in `removed`.
- [ ] **WHEN** any of `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` or `VAPID_SUBJECT` is unset **THE SYSTEM SHALL** return `{ sent: 0, removed: 0 }` without calling `sendNotification` and without throwing.
- [ ] **WHEN** `buildItemPush` runs for actor `Ana` and item `Leche` **THE SYSTEM SHALL** return the body `Ana añadió Leche` for `added` and `Ana compró Leche` for `done`, both with `url` `/compras`.
- [ ] **WHEN** `tests/e2e/compras.spec.ts` runs with VAPID keys present and no subscriptions stored **THE SYSTEM SHALL** pass every assertion.

**Verify**
```bash
pnpm test tests/unit/push-send.test.ts    # expect: exit 0
pnpm lint                                 # expect: exit 0
pnpm typecheck                            # expect: exit 0
pnpm db:start                             # expect: exit 0
pnpm db:reset                             # expect: exit 0
pnpm test:e2e tests/e2e/compras.spec.ts   # expect: exit 0
```

**Checkpoint**
```bash
git add -A && git commit -m "step 12: push-server"
git tag step-12-push-server
# rollback target if this step goes wrong: git reset --hard step-11-realtime
```

---

#### Step 13 — Enable-notifications button and subscription save

**Do**
- `src/lib/push/support.ts` (pure, importable by client and server):

```ts
import { z } from "zod";

export type PushSupport = "disponible" | "instalar" | "no-soportado";

export function isIOS(userAgent: string): boolean {
  return /iPad|iPhone|iPod/.test(userAgent);
}

/** iOS only delivers Web Push to an installed PWA (16.4+); elsewhere PushManager is enough. */
export function pushSupportState(input: {
  userAgent: string;
  isStandalone: boolean;
  hasPushManager: boolean;
}): PushSupport {
  if (isIOS(input.userAgent)) {
    if (!input.isStandalone) {
      return "instalar";
    }
    return input.hasPushManager ? "disponible" : "no-soportado";
  }
  return input.hasPushManager ? "disponible" : "no-soportado";
}

export const subscriptionSchema = z.object({
  endpoint: z.url().startsWith("https://"),
  keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }),
});

export type SubscriptionInput = z.infer<typeof subscriptionSchema>;
```

- `src/lib/push/actions.ts` — `"use server"`; `saveSubscription(input: unknown)`: getUser → membership → `subscriptionSchema.safeParse` (failure → `{ ok: false, error: "suscripcion_invalida" }`) → `upsert({ user_id, household_id, endpoint, p256dh, auth, user_agent }, { onConflict: "endpoint" })` with the **user's** server client (RLS insert/update policies allow only own rows) → `{ ok: true, data: null }`.
- `src/components/push-toggle.tsx` — `"use client"`. On mount compute `pushSupportState({ userAgent: navigator.userAgent, isStandalone: window.matchMedia("(display-mode: standalone)").matches, hasPushManager: "PushManager" in window })`. `disponible` → button `Activar notificaciones` (Phosphor `BellRinging`); on click (and only there) `Notification.requestPermission()` → `navigator.serviceWorker.ready` → `registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: <NEXT_PUBLIC_VAPID_PUBLIC_KEY decoded from base64url to Uint8Array> })` → `saveSubscription(subscription.toJSON())` → `toast.success("Notificaciones activadas")`; permission denied → `toast("Puedes activarlas luego en Ajustes del iPhone")`. If `pushManager.getSubscription()` already returns one, show `Notificaciones activadas` as text instead of the button. `instalar` → `<p>` hint: `Para recibir avisos, instala HomeBoard: en Safari toca Compartir y luego "Añadir a pantalla de inicio".` `no-soportado` → `Este navegador no admite notificaciones.` If the VAPID public key is empty, render nothing.
- `src/app/(app)/ajustes/page.tsx` — **edit**: add a **Notificaciones** card containing `<PushToggle />`.
- `tests/unit/push-support.test.ts` — iPhone UA `Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1`: not standalone → `instalar`; standalone + PushManager → `disponible`. Android Chrome UA (`Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36`): PushManager → `disponible`, none → `no-soportado`. `subscriptionSchema`: missing `keys.p256dh` rejected, `http://` endpoint rejected, `https://fcm.googleapis.com/fcm/send/abc` with both keys accepted. `saveSubscription` (mock `@/lib/supabase/server` with `vi.mock`): malformed payload (missing `endpoint`) → `{ ok: false, error: "suscripcion_invalida" }`; valid payload → upsert called with `onConflict: "endpoint"`, returns `{ ok: true, data: null }`.

**Done when**
- [ ] **WHEN** `pushSupportState` receives an iPhone user agent with `isStandalone` false **THE SYSTEM SHALL** return `instalar`.
- [ ] **WHEN** `pushSupportState` receives an iPhone user agent with `isStandalone` true and `hasPushManager` true **THE SYSTEM SHALL** return `disponible`.
- [ ] **WHEN** `pushSupportState` receives a non-iOS user agent **THE SYSTEM SHALL** return `disponible` if `hasPushManager` is true and `no-soportado` if it is false.
- [ ] **WHEN** `subscriptionSchema` parses a payload missing `keys.p256dh` or with a non-https `endpoint` **THE SYSTEM SHALL** reject it, and SHALL accept a payload with an https `endpoint` and both keys.
- [ ] **WHEN** a unit test calls `saveSubscription` with a malformed payload (mocking `@/lib/supabase/server`) **THE SYSTEM SHALL** return `{ ok: false, error: "suscripcion_invalida" }`, and **WHEN** called with a valid payload **THE SYSTEM SHALL** upsert with `onConflict: "endpoint"` and return `{ ok: true, data: null }`.

**Verify**
```bash
pnpm test tests/unit/push-support.test.ts   # expect: exit 0
pnpm lint                                   # expect: exit 0
pnpm typecheck                              # expect: exit 0
pnpm db:start                               # expect: exit 0
pnpm db:reset                               # expect: exit 0
pnpm test:e2e tests/e2e/household.spec.ts   # expect: exit 0
```

**Checkpoint**
```bash
git add -A && git commit -m "step 13: push-client"
git tag step-13-push-client
# rollback target if this step goes wrong: git reset --hard step-12-push-server
```

---

#### Step 14 — Sentry, health keep-alive and deploy config

**Do**
- `src/instrumentation.ts`:

```ts
import * as Sentry from "@sentry/nextjs";

export async function register(): Promise<void> {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) {
    return; // no DSN → Sentry stays uninitialised: a no-op
  }
  Sentry.init({ dsn, tracesSampleRate: 0, sendDefaultPii: false });
}

export const onRequestError = Sentry.captureRequestError;
```

- `src/instrumentation-client.ts`:

```ts
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
if (dsn) {
  Sentry.init({ dsn, tracesSampleRate: 0, sendDefaultPii: false });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
```

  `next.config.ts` is **not** wrapped with `withSentryConfig`: no source-map upload, no auth token, no build-time network call (decision log #15).
- `src/app/api/health/route.ts`:

```ts
import { log } from "@/lib/log";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// Vercel Cron calls this with GET once a day (vercel.json). A trivial query keeps Supabase Free from pausing.
export async function GET(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const { error } = await createAdminClient().from("households").select("id", { count: "exact", head: true });
  if (error) {
    log.error("health.db_failed", { code: error.code });
    return Response.json({ ok: false, error: "db" }, { status: 503 });
  }
  return Response.json({ ok: true });
}
```

- `tests/unit/deploy.test.ts` (also covers Sentry and logger, folded in from `observability.test.ts` to stay at the 5-file limit) — Sentry: `vi.mock("@sentry/nextjs", () => ({ init: vi.fn(), captureRequestError: vi.fn(), captureRouterTransitionStart: vi.fn() }))`; with `vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "")` `await register()` → `init` not called; with `"https://public@o0.ingest.sentry.io/0"` → `init` called once with that `dsn`. Logger: spy on `console.error`, call `log.error("prueba", { email: "a@b.c", token: "t", code: "X1" })`, `JSON.parse` the single line → `level === "error"`, `event === "prueba"`, `code === "X1"`, `email` and `token` equal `[redacted]`. (1) health route: `vi.mock("@/lib/supabase/admin")` with a fake whose `.from().select()` resolves `{ error: null }` or `{ error: { code: "XX" } }`; `vi.stubEnv("CRON_SECRET", "s3cr3t")`; no header → 401 body `{ ok: false, error: "unauthorized" }`; `Bearer wrong` → 401; `Bearer s3cr3t` → 200 `{ ok: true }`; DB error → 503 `{ ok: false, error: "db" }`. (2) `JSON.parse(readFileSync("vercel.json"))` → `crons.length === 1`, `crons[0].path === "/api/health"`, `crons[0].schedule` matches `/^\d{1,2} \d{1,2} \* \* \*$/`; `src/app/api/health/route.ts` exports `GET` (`typeof route.GET === "function"`). (3) `JSON.parse(readFileSync(".github/workflows/ci.yml"))` (the workflow is written as JSON, which is valid YAML) → the ordered list of `run` strings contains, in this order, `pnpm install --frozen-lockfile`, `pnpm exec biome ci .`, `pnpm typecheck`, `pnpm test`, `pnpm db:test`, `pnpm test:e2e`, `pnpm build`; and for every `run` of the form `pnpm <name>` where `<name>` is neither `install` nor `exec`, `package.json` `scripts` has `<name>`.
- `tests/e2e/health.spec.ts` — Playwright `request` fixture (no browser). `process.env.CRON_SECRET` is available because `playwright.config.ts` loads `.env.local`. Two test cases: (1) no `Authorization` header → expect `response.status()` to be 401 and `response.json()` to have `{ ok: false, error: "unauthorized" }`; (2) `Authorization: Bearer ${process.env.CRON_SECRET}` → expect 200 and `{ ok: true }`.

**Done when**
- [ ] **WHEN** `GET /api/health` is called without an `Authorization` header or with a wrong bearer **THE SYSTEM SHALL** return 401 `{ "ok": false, "error": "unauthorized" }`, and with `Authorization: Bearer <CRON_SECRET>` and a working database **THE SYSTEM SHALL** return 200 `{ "ok": true }`.
- [ ] **WHEN** the health check's database query errors **THE SYSTEM SHALL** return 503 `{ "ok": false, "error": "db" }`.
- [ ] **WHEN** `tests/unit/deploy.test.ts` reads `vercel.json` **THE SYSTEM SHALL** find exactly one cron with `path` `/api/health` and a daily `schedule`, and `src/app/api/health/route.ts` SHALL export `GET`.
- [ ] **WHEN** `tests/unit/deploy.test.ts` parses `.github/workflows/ci.yml` **THE SYSTEM SHALL** find, in this order, steps running `pnpm install --frozen-lockfile`, `pnpm exec biome ci .`, `pnpm typecheck`, `pnpm test`, `pnpm db:test`, `pnpm test:e2e` and `pnpm build`, and every `pnpm <script>` it runs SHALL exist in `package.json`.
- [ ] **WHEN** `register()` from `src/instrumentation.ts` runs with `NEXT_PUBLIC_SENTRY_DSN` unset **THE SYSTEM SHALL** not call `Sentry.init`, and with it set **THE SYSTEM SHALL** call it exactly once.
- [ ] **WHEN** `log.error` is called with `{ email, token, code }` **THE SYSTEM SHALL** write one JSON line with `level` `error`, the event name, `code` unchanged and `email` and `token` as `[redacted]`.
- [ ] **WHEN** `GET /api/health` is called without `Authorization` through the running server **THE SYSTEM SHALL** return 401 `{ ok: false, error: "unauthorized" }`; **WHEN** called with `Authorization: Bearer ${CRON_SECRET}` **THE SYSTEM SHALL** return 200 `{ ok: true }`.

**Verify**
```bash
pnpm test tests/unit/deploy.test.ts      # expect: exit 0
pnpm test                                # expect: exit 0
pnpm lint                                # expect: exit 0
pnpm typecheck                           # expect: exit 0
pnpm build                               # expect: exit 0
pnpm smoke                               # expect: exit 0
pnpm test:e2e tests/e2e/health.spec.ts   # expect: exit 0
```

**Checkpoint**
```bash
git add -A && git commit -m "step 14: deploy"
git tag step-14-deploy
# rollback target if this step goes wrong: git reset --hard step-13-push-client
```

---

### 9.1 Parity and cutover

NOT APPLICABLE — greenfield build, no system is being replaced.

---

## 10. Environment Setup

### Prerequisites

| Tool | Version | Check |
|---|---|---|
| Node.js | 26 (Active LTS "Lithium", `.nvmrc`); 24.x is accepted (`engines >=24`) — the dev machine has 24.19.0 | `node -v` |
| pnpm | 12.x; the project pins `pnpm@12.21.0` in `packageManager` and pnpm 12 switches to it automatically. Without pnpm: `corepack enable --install-directory "$HOME/.local/bin"` (bare `corepack enable` fails with EACCES where the global bin dir is not writable), then `corepack prepare pnpm@12.21.0 --activate` | `pnpm -v` |
| Docker Desktop | any current release, **running** — required by `supabase start` from step 4 on (the dev machine does not have it yet) | `docker info` |
| Git (Git Bash on Windows) | any 2.x, with `user.name` and `user.email` configured (Bootstrap commits) | `git --version` and `git config user.email` |

All commands in this blueprint are POSIX shell, run from the project root: Git Bash on Windows, bash on
macOS/Linux and in CI. PowerShell is not supported for the Bootstrap block.

### Accounts to create first

| Service | Sign-up | First needed |
|---|---|---|
| None for the build | — | Steps 1–14 run entirely on this machine (local Supabase in Docker) |
| Supabase (Free) | https://supabase.com/dashboard | §20.1 launch checklist (cloud project) |
| Vercel (Hobby) | https://vercel.com/signup | §20.1 launch checklist |
| Google Cloud (OAuth client) | https://console.cloud.google.com/ | §20.1 launch checklist |
| GitHub (repo for CI) | https://github.com/ | §20.1 launch checklist |
| Sentry (Developer, optional) | https://sentry.io/signup/ | optional, §20.1 |

### Environment variables

| Variable | Purpose | Where to get it | Required by step | Secret? |
|---|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase API URL | local: `pnpm env:local` (from `supabase status`, literal local value `http://127.0.0.1:54321`); cloud: Dashboard → Project Settings → API | 6 | no |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon / publishable key for browser and server clients | same (`ANON_KEY` or `PUBLISHABLE_KEY` in `supabase status`; the dashboard may call it "publishable key") | 6 | no (public by design, RLS protects data) |
| `SUPABASE_SERVICE_ROLE_KEY` | service-role / secret key for push sending and the health check | same (`SERVICE_ROLE_KEY` or `SECRET_KEY`) | 12 | **yes** |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | VAPID public key for `pushManager.subscribe` | generated by `pnpm env:local`; for production generate once with `node -e "import('web-push').then(m=>console.log(JSON.stringify(m.generateVAPIDKeys())))"` | 12 (absent = push disabled, never an error) | no |
| `VAPID_PRIVATE_KEY` | VAPID private key | same pair | 12 | **yes** |
| `VAPID_SUBJECT` | `mailto:` contact sent to push services | your email, e.g. `mailto:tu-correo@ejemplo.com` (local: `mailto:hola@homeboard.test`) | 12 | no |
| `CRON_SECRET` | bearer that `/api/health` requires; Vercel Cron sends it | generated by `pnpm env:local`; production: any 32+ random chars set in Vercel | 14 | **yes** |
| `NEXT_PUBLIC_SITE_URL` | `metadataBase`, OAuth fallback origin | local `http://localhost:3000`; production the Vercel URL | optional (default `http://localhost:3000`) | no |
| `NEXT_PUBLIC_SENTRY_DSN` | Sentry DSN; empty = Sentry is a no-op | sentry.io → Project → Client Keys | optional | no |
| `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID` | Google OAuth client id, read by `supabase/config.toml` via `env()` | Google Cloud → APIs & Services → Credentials | optional locally (provider disabled); production goes in the Supabase dashboard | no |
| `SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET` | Google OAuth client secret, same | same | optional locally | **yes** |
| `CI` | set by GitHub Actions; makes Playwright build fresh, retry once and forbid `.only` | set automatically in CI | — | no |
| `NODE_ENV` | Node environment indicator (`test`, `production`, `development`) | set automatically by Next.js and Vitest | — | no |

`.env.example` is committed with every key present and no real value. `.env.local` (written by
`pnpm env:local`) and `supabase/.env` are gitignored. Validation degrades by step: `src/lib/env.ts` parses the
public Supabase pair only when a Supabase client is created (first at step 6), and every server secret is read
with `requireServerEnv()` inside the feature that needs it (step 12 push, step 14 health) — no variable is
demanded before the step in the "Required by step" column. Locally `pnpm env:local` writes all of them at
step 4, so later gates never wait on a manual edit.

**How each tool loads env:**

| Tool | Mechanism |
|---|---|
| Next (`dev`, `build`, `start`, `pnpm smoke`, Playwright's web server) | Next loads `.env.local` itself |
| Playwright test process | `process.loadEnvFile(".env.local")` at the top of `playwright.config.ts` (when the file exists) |
| Vitest | never loads `.env.local`; `tests/setup/unit.ts` sets harmless public values, tests use `vi.stubEnv` |
| Supabase CLI (`db:start`, `db:reset`, `db:test`, `db:types`) | reads `supabase/config.toml`; `env()` references resolve from the shell or `supabase/.env` — only the optional Google pair uses it, and the local provider is disabled |
| `scripts/*.mjs` | `write-env-local.mjs` and `gen-types.mjs` get their values from `supabase status` / the CLI; the others read no env |
| GitHub Actions | `pnpm env:local` step after `pnpm db:start` writes `.env.local` in the runner |

### Files that must be committed

| File | Why it is committed | Ignore-file exception line |
|---|---|---|
| `.env.example` | documents every variable | `!.env.example` after the `.env*` pattern (in the emitted `.gitignore`) |
| `.gitignore`, `biome.json`, `pnpm-workspace.yaml`, `vitest.config.ts`, `playwright.config.ts`, `vercel.json` | gate and deploy configuration | — not matched by any ignore pattern |
| `.github/workflows/ci.yml` | CI gate | — not matched |
| `.claude/**`, `CLAUDE.md`, `AGENTS.md` | agent workspace | — not matched (`.claude/` is not in the emitted ignore file) |
| `scripts/*.mjs`, `tests/**`, `src/types/web-push.d.ts` | tooling, tests, types | — not matched |
| `.workspace-applied` | marker that makes the workspace copy run once | — not matched |
| `pnpm-lock.yaml` | reproducible installs (`--frozen-lockfile` in CI) | — not matched |
| `supabase/config.toml`, `supabase/migrations/**`, `supabase/seed.sql`, `supabase/tests/**` | the database is code | — not matched (`supabase/.gitignore` from `supabase init` only lists `.branches`, `.temp`, `.env`-style local files) |
| `src/lib/database.types.ts` | typecheck works without a running database | — not matched |
| `public/icons/*.png` | the manifest serves them | — not matched |
| `blueprints/homeboard/**` | the build plan; `tasks.json` status is written back | — not matched |

### Bootstrap

```bash
# HomeBoard · Bootstrap. Run from the project root — the folder that contains blueprints/homeboard/ — in Git Bash
# (Windows) or bash (macOS/Linux/CI). Non-interactive, and safe to run twice in a row (the second run exits 0
# and changes nothing that matters).
# order matters: toolchain check → scaffold (only without package.json) → workspace copy, which brings
#   .gitignore + biome.json + pnpm-workspace.yaml (once) → repo init → scaffold edits → pinned installs
#   (need pnpm-workspace.yaml's allowBuilds) → format once (needs biome.json) → browser → first commit
#   (.gitignore with its exceptions is already on disk). Supabase is started by step 4, not here.
set -e

node -v      # expect v24.x or v26.x
pnpm -v      # expect 12.x
docker info >/dev/null 2>&1 || echo "AVISO: Docker no está corriendo; hace falta desde el paso 4"   # informative, always exits 0

# 1. Scaffold. create-next-app refuses a folder that already contains blueprints/, so it scaffolds into a
#    sibling folder and the files move up. Guarded: skipped when package.json exists.
if [ ! -e package.json ]; then
  rm -rf homeboard-scaffold
  pnpm create next-app@16.4.6 homeboard-scaffold --ts --app --tailwind --biome --src-dir --use-pnpm \
    --import-alias "@/*" --skip-install --disable-git --no-agents-md --no-agent-feedback --yes
  cp -R homeboard-scaffold/. .
  rm -rf homeboard-scaffold
fi

# 2. Workspace copy — exactly once, gated on a committed marker. The first run deliberately replaces the
#    scaffold's .gitignore, biome.json and pnpm-workspace.yaml with the blueprint's. It never runs again, so
#    files later steps edit are never reverted; package.json and pnpm-lock.yaml are not in workspace/ at all.
#    Marker form because Git for Windows ships no rsync and `cp -Rn` exits 1 on macOS when it skips a file.
#    `[ -e … ] || { … }` exits 0 when the marker exists.
[ -e .workspace-applied ] || { cp -R blueprints/homeboard/workspace/. . && touch .workspace-applied; }

# 3. Repository (idempotent). The ignore file from line 2 is already on disk.
git rev-parse --git-dir >/dev/null 2>&1 || git init -b main

# 4. Scaffold edits: package.json name/packageManager/engines/scripts, tsconfig exclude, cacheComponents off.
node scripts/apply-scaffold-edits.mjs

# 5. Pinned dependencies (§11). A re-run resolves the same exact versions and exits 0.
pnpm add -E next@16.4.6 react@19.3.1 react-dom@19.3.1 @supabase/supabase-js@2.119.0 @supabase/ssr@0.12.7 web-push@4.0.0 @phosphor-icons/react@2.1.10 motion@14.14.0 zod@4.6.7 sonner@2.0.8 @sentry/nextjs@11.14.0
pnpm add -D -E @types/react@19.3.0 @types/react-dom@19.3.0 tailwindcss@4.3.5 @tailwindcss/turbopack@4.3.5 @biomejs/biome@2.6.8 vitest@5.1.0 vite@8.3.4 @playwright/test@1.65.1 supabase@3.2.0
pnpm add -D typescript@~6.0.3 @types/node@24

# 6. Reconcile formatting of the scaffold and the copied files with biome.json, once (exit 0; no-op on re-run).
pnpm exec biome check --write .

# 7. E2E browser (Chromium only; CI uses --with-deps).
pnpm exec playwright install chromium

# 8. First commit. Skipped when nothing is staged, so the second run exits 0.
git add -A
git diff --cached --quiet || git commit -m "chore: bootstrap HomeBoard"
```

If `pnpm add` stops with `ERR_PNPM_IGNORED_BUILDS` naming a package not listed in `pnpm-workspace.yaml`, add
that package under `allowBuilds:` with `false` (or `true` only if its build script is required, as for
`supabase`) and re-run the block — never use `dangerouslyAllowAllBuilds`.

**Local service commands** (also in `CLAUDE.md`): up `pnpm db:start`, down `pnpm db:stop`, reset
`pnpm db:reset`. Ports: API `54321`, Postgres `54322`, Studio `54323` (Supabase CLI defaults).

---

## 11. Dependencies

Every pin below comes from the `stack-researcher` report of this session (registry and published-artifact
checks dated **2026-11-17**) except `vite` and `@types/node`, which fall back to
`knowledge/runtime-tracks/ts-node.md` (Last verified 2026-10-17). Release dates were **not** assessed
(STALE not checked) for any package.

### Runtime

| Package | Version | Source (registry URL or track file) | Checked | Installed by | Purpose |
|---|---|---|---|---|---|
| Node.js | 26.13.1 (`.nvmrc` `26`, `engines >=24`) | https://nodejs.org/dist/index.json | 2026-11-17 | developer (§10 Prerequisites) | runtime; Vercel Node 26 support UNVERIFIED — set the Node version in Vercel settings |
| pnpm | 12.21.0 (`packageManager`) | https://registry.npmjs.org/-/package/pnpm/dist-tags | 2026-11-17 | developer / pnpm self-switch; `packageManager` written by §10 Bootstrap (`apply-scaffold-edits.mjs`) | package manager |
| `next` | 16.4.6 | https://registry.npmjs.org/next | 2026-11-17 | §10 Bootstrap (`pnpm create next-app@16.4.6`, then `pnpm add -E next@16.4.6`) | framework; `proxy.ts` replaces middleware |
| `react` / `react-dom` | 19.3.1 / 19.3.1 | https://registry.npmjs.org/react · https://registry.npmjs.org/react-dom | 2026-11-17 | §10 Bootstrap | UI |
| `@supabase/supabase-js` | 2.119.0 | https://registry.npmjs.org/@supabase/supabase-js | 2026-11-17 | §10 Bootstrap | DB, auth, realtime client; service-role client |
| `@supabase/ssr` | 0.12.7 (exact) | https://registry.npmjs.org/@supabase/ssr | 2026-11-17 | §10 Bootstrap | cookie-based server/browser clients (`getAll`/`setAll` only) |
| `web-push` | 4.0.0 | https://registry.npmjs.org/web-push (named exports verified from `src/index.js`) | 2026-11-17 | §10 Bootstrap | VAPID push sending; ESM, no default export |
| `@phosphor-icons/react` | 2.1.10 | https://registry.npmjs.org/@phosphor-icons/react | 2026-11-17 | §10 Bootstrap | icons |
| `motion` | 14.14.0 | https://registry.npmjs.org/motion (`exports["./react"]` verified) | 2026-11-17 | §10 Bootstrap | animations via `motion/react`; 12→14 breaking changes UNVERIFIED |
| `zod` | 4.6.7 | https://registry.npmjs.org/zod | 2026-11-17 | §10 Bootstrap | validation |
| `sonner` | 2.0.8 | https://registry.npmjs.org/sonner | 2026-11-17 | §10 Bootstrap | toasts with "Deshacer" |
| `@sentry/nextjs` | 11.14.0 | https://registry.npmjs.org/@sentry/nextjs (peer `next ^16.0.0-0` OK) | 2026-11-17 | §10 Bootstrap | optional error tracking; 10→11 breaking changes UNVERIFIED |

### Development

| Package | Version | Source (registry URL or track file) | Checked | Installed by | Purpose |
|---|---|---|---|---|---|
| `typescript` | ~6.0.3 | https://registry.npmjs.org/typescript (NOT 7.0.2 `latest`) | 2026-11-17 | §10 Bootstrap | type checking |
| `@types/react` / `@types/react-dom` | 19.3.0 / 19.3.0 | https://registry.npmjs.org/@types/react · https://registry.npmjs.org/@types/react-dom | 2026-11-17 | §10 Bootstrap | React types |
| `@types/node` | 24 (range) | `knowledge/runtime-tracks/ts-node.md` | 2026-10-17 | §10 Bootstrap | Node types; satisfies vitest peer `>=24` |
| `tailwindcss` / `@tailwindcss/turbopack` | 4.3.5 / 4.3.5 (identical) | https://registry.npmjs.org/tailwindcss · https://registry.npmjs.org/@tailwindcss/turbopack | 2026-11-17 | §10 Bootstrap | styling; `create-next-app@16.4.6 --tailwind` emits `@tailwindcss/turbopack` (Turbopack dev-server loader); for PostCSS-based production builds Next 16 uses the same `tailwindcss` package directly |
| `@biomejs/biome` | 2.6.8 | https://registry.npmjs.org/@biomejs/biome | 2026-11-17 | §10 Bootstrap | lint + format; the track's workarounds were measured on 2.5.15 and are UNVERIFIED on 2.6.8 — step 1's lint gate catches a regression |
| `vitest` | 5.1.0 | https://registry.npmjs.org/vitest (peers vite `^6.4 \|\| ^7 \|\| ^8`, @types/node `^22 \|\| >=24`) | 2026-11-17 | §10 Bootstrap | unit tests |
| `vite` | 8.3.4 | `knowledge/runtime-tracks/ts-node.md` | 2026-10-17 | §10 Bootstrap | explicit peer of vitest |
| `@playwright/test` | 1.65.1 | https://registry.npmjs.org/@playwright/test | 2026-11-17 | §10 Bootstrap (+ `pnpm exec playwright install chromium`) | E2E |
| `supabase` (CLI) | 3.2.0 | https://registry.npmjs.org/supabase | 2026-11-17 | §10 Bootstrap (`allowBuilds: supabase: true` for its binary download) | local stack, migrations, pgTAP, type generation |
| GitHub Actions `actions/checkout`, `pnpm/action-setup`, `actions/setup-node` | `v4` / `v4` / `v4` | UNVERIFIED — verify before relying on CI | — | `.github/workflows/ci.yml` (§19.6) | CI runner steps |
| Supabase local Postgres | major 17 (`[db] major_version`) | Supabase CLI default images, pinned by the CLI version above | 2026-11-17 | `pnpm db:config` sets it (step 4) | local database |

### Deliberately not used

| Rejected | Instead | Why |
|---|---|---|
| `@types/web-push` | `src/types/web-push.d.ts` (§19.6) | targets web-push 3.x (default export); 4.0.0 is ESM with named exports only |
| `drizzle-orm` / `prisma` | SQL migrations + generated types | one schema owner (Supabase CLI); an ORM would be a second migration system |
| `@serwist/next` / Workbox | hand-written `public/sw.js` | the worker does two things (offline fallback, push); a generator adds config and a build plugin for nothing |
| `@vitejs/plugin-react`, jsdom | Playwright for UI, Vitest for pure logic | no component unit tests in an MVP; keeps Vitest config trivial |
| `server-only` | boundary rules + `.claude/rules` | avoids an export-condition package every test/script would have to resolve |
| ESLint / Prettier | Biome | one tool; the scaffold's `--biome` flag |
| `shadcn` / Radix | hand-made components | ~10 components; no primitives needed |
| `@tanstack/react-query` | Server Components + Realtime | server state comes from RSC; live state from Realtime |
| `dotenv` | Next's loader, `process.loadEnvFile` | Node ≥ 20.12 has a built-in loader |
| `@sentry/cli` build script / `withSentryConfig` | runtime-only Sentry init | no source-map upload, no auth token, no network at build |

---

## 12. Deployment Strategy

### Hosting
Vercel **Hobby**, region `iad1` default (closest to the Supabase project region you pick; choose the same
area, e.g. `eu-west` + `cdg1`/`fra1` if you are in Europe). Framework preset Next.js, build `pnpm build`,
output `.next`, install `pnpm install --frozen-lockfile`, Node.js Version **24.x** in Project Settings (26 if
Vercel offers it — unverified). Supabase **Free** project for Postgres/Auth/Realtime.

### Environments

| Environment | Branch | URL | Database | Third-party mode |
|---|---|---|---|---|
| Local | — | http://localhost:3000 (E2E 3100, smoke 3101) | local Supabase in Docker (`pnpm db:start`) | Google provider disabled; VAPID keys generated locally |
| Preview | any PR | Vercel preview URL | the production Supabase project (Free has no branching) — previews are for UI review only; do not run destructive tests there | same keys as production |
| Production | `main` | `https://<proyecto>.vercel.app` | Supabase cloud project | real Google OAuth client, production VAPID pair |

### CI/CD
`.github/workflows/ci.yml` (§19.6) on every push to `main` and every PR, in order: install
(`--frozen-lockfile`) → `pnpm exec biome ci .` → `pnpm typecheck` → `pnpm test` → `pnpm db:start` →
`pnpm env:local` → `pnpm db:test` → Playwright Chromium install → `pnpm test:e2e` → `pnpm build` → `pnpm smoke`.
These are the §20.1 gate commands. Vercel deploys from Git independently; protect `main` so only green PRs merge.

### Release and rollback
Merge to `main` → Vercel production deploy (~2 min). Rollback: Vercel dashboard → Deployments → previous
deployment → *Promote to Production* (instant, < 1 min). Migrations: `pnpm exec supabase db push` is run by
a human **before** merging code that needs the new schema, and every migration is backward compatible with the
currently deployed code (expand → deploy → contract).

### Domain, DNS, TLS
v1 uses the free `*.vercel.app` domain (TLS automatic). A custom domain is optional: add it in Vercel →
Domains, create the CNAME/A records Vercel shows, then add `https://<dominio>/auth/callback` to the Supabase
redirect allow list and the Google OAuth client.

---

## 13. Testing Strategy

Smoke-level MVP plus the isolation that matters most. Tests exist to make §9's criteria checkable.

| Layer | Framework | What it covers | Where | Runs |
|---|---|---|---|---|
| Unit | Vitest 5 (Node env) | site constants, OAuth callback + open-redirect guard, micro-app registry, push sender, push support detection, logger redaction, Sentry no-op, health route, deploy config | `tests/unit/*.test.ts` | every commit (`pnpm test`) |
| Database | pgTAP via `supabase test db` | RLS isolation between households, `join_household` errors, anon access | `supabase/tests/rls_isolation.test.sql` | every commit (`pnpm db:test`) |
| E2E | Playwright 1.65 (Pixel 7 Chromium, production build on :3100) | shell, PWA assets, auth, households, Inicio, shopping CRUD, realtime between two sessions | `tests/e2e/*.spec.ts` | every commit in CI (`pnpm test:e2e`) |
| Smoke | `scripts/smoke.mjs` | the production server starts and `/` answers 200 with `HomeBoard` | `scripts/smoke.mjs` | every commit |

### Critical flows to cover E2E
1. Two people in two sessions: one adds an item, the other sees it within 5 s; check-off and delete propagate too (`realtime.spec.ts`).
2. Create household → read code → second user joins → both listed (`household.spec.ts`).
3. Shopping CRUD with persistence after reload and undo after delete (`compras.spec.ts`).
4. Sign-up, sign-in, wrong password (`auth.spec.ts`).

### Test data
Local Supabase in Docker (`supabase/config.toml` from step 4). `pnpm db:reset` recreates the schema and loads
`supabase/seed.sql` (Ana + Luis in *Casa de Ana*, Bea in *Casa de Bea*, password `homeboard-dev-1234`). Read-only
E2E tests sign in as seed users; every test that writes creates its own user and household
(`newMemberWithHousehold`, unique emails), so no test depends on another's data or order. pgTAP runs inside a
transaction and rolls back. Unit tests touch no database (mocks). Dev and tests share the local stack; the
reset before each data gate is what isolates runs.

### What is deliberately not tested
- The real Google OAuth round trip and push delivery to a real iPhone — need external accounts and a device; §20.1 launch checklist.
- Visual regression / screenshots — the design is enforced by tokens and computed-style assertions in `shell.spec.ts`.
- Component unit tests — Playwright covers the UI end to end.
- Load and performance — a two-person household.

---

## 14. Security & Secrets

| Concern | Control | Implemented in |
|---|---|---|
| Secret storage | Vercel env vars (production), `.env.local` (local, gitignored); never in the repo | Vercel dashboard, `.gitignore` |
| Secret rotation | Rotate service-role key in Supabase → update Vercel env → redeploy; rotating the VAPID pair invalidates every subscription (users re-tap `Activar notificaciones`); `CRON_SECRET` rotate any time in Vercel | §20.1 runbook line |
| Input validation | zod at every Server Action and route handler, before any write | `src/lib/shopping/schema.ts`, `src/lib/push/support.ts`, `src/app/(auth)/actions.ts`, `src/app/bienvenida/page.tsx` |
| Output encoding / XSS | React escaping only; no `dangerouslySetInnerHTML` (the one inline `<Script>` is a static constant) | all components |
| SQL injection | supabase-js query builder and RPC parameters only; SQL functions use typed parameters and `search_path = ''` | `src/lib/**`, migration |
| AuthN / AuthZ | Supabase Auth; `getUser()` in every action; RLS on every table | §8, `src/proxy.ts`, migration |
| CSRF | Server Actions are POST with Next's Origin/Host check; no state-changing GET; `SameSite=Lax` cookies | Next.js, `@supabase/ssr` |
| Rate limiting / abuse | Supabase Auth built-in limits on sign-in/sign-up; no custom limits in v1 (two known users) | Supabase |
| Webhook verification | NOT APPLICABLE — no inbound webhooks; the cron endpoint checks `Authorization: Bearer CRON_SECRET` | `src/app/api/health/route.ts` |
| Dependency audit | `pnpm audit --prod` monthly by the owner; fix highs within a week | manual |
| Security headers | Vercel defaults (HSTS on `*.vercel.app`); no custom CSP in v1 because the inline SW registration script would need a nonce — revisit in §20.4 | — |
| PII handling | stored: email (auth), display name, Google avatar URL, push endpoint per device; deletion via Supabase dashboard (cascades) | migration |
| Logging hygiene | `src/lib/log.ts` redacts keys matching token/secret/password/key/auth/p256dh/endpoint/email; Sentry `sendDefaultPii: false` | `src/lib/log.ts`, `src/instrumentation*.ts` |

**Hard rules**
- No secret is ever committed, printed in a log, sent to an error tracker, or embedded in a client bundle. Anything reaching the browser is public — treat it that way.
- All server-side authorization checks run before the work, not after.
- `SUPABASE_SERVICE_ROLE_KEY` is read only in `src/lib/supabase/admin.ts`, which only `src/lib/push/send.ts` and `src/app/api/health/route.ts` import.

Regulated data: none (no health, financial or children's data). Users are in the EU/LatAm-agnostic sense
private individuals using their own data; GDPR obligations reduce to deleting an account on request
(dashboard, cascades). The `.claude/settings.json` deny rules on `.env*` discourage reads; they are not a
sandbox.

---

## 15. Accessibility

**Target: WCAG 2.2 Level AA.**

### Baseline requirements

| Requirement | Rule |
|---|---|
| Semantic HTML | `main` in `(app)` layout, `nav aria-label="Navegación principal"`, one `h1` per page, lists for lists |
| Keyboard | every control reachable; native checkbox/button/link elements only; no traps |
| Focus visible | `:focus-visible { outline: 3px solid var(--ring) }` — `#C2410C` on cream ≥ 3:1 |
| Contrast | §7 pairs measured (5.2:1, 6.7:1, 7.7:1; success darkened to `#047857`) |
| Forms | every input has a `<label>`; errors are text in `role="alert"` |
| Images | Phosphor icons `aria-hidden`; icon-only buttons have `aria-label` (`Borrar Leche`) |
| Motion | `useReducedMotion()` disables transforms and staggers |
| Zoom / reflow | 375px no horizontal scroll (step 2 test); max width 640px |
| Live regions | realtime-offline banner `role="status"`; sonner toasts are announced |

### WCAG 2.2 additions — the ones most often missed

| SC | Requirement |
|---|---|
| 2.4.11 Focus Not Obscured (Min) | `(app)` main has bottom padding of tab-bar height + safe area; toasts render `top-center` |
| 2.5.7 Dragging Movements | no drag interactions (no swipe-to-delete; delete is a button) |
| 2.5.8 Target Size (Min) | all targets ≥ 44px (asserted in steps 2 and 9) |
| 3.3.7 Redundant Entry | the invite code is pasted, never retyped from another screen of the same flow |
| 3.3.8 Accessible Authentication (Min) | password managers allowed (`autoComplete`), paste never blocked, Google sign-in available |

### Verification
```bash
pnpm test:e2e tests/e2e/shell.spec.ts tests/e2e/home.spec.ts tests/e2e/auth.spec.ts
# expect: exit 0 — asserts lang="es", 16px body, no horizontal scroll at 375px, 44px targets,
#         named navigation, labelled inputs (helpers use getByLabel) and role="alert" errors
```
No axe engine is pinned in v1 (`@axe-core/playwright` was not researched), so automated checks are the
structural assertions above. Before launch: keyboard-only pass of sign-in → add item → check → delete,
one VoiceOver pass on iPhone over `/compras`, and a 200% zoom pass at 375px (§20.1).

---

## 16. Observability & Cost

### Instrumentation

| Signal | Tool | What it captures | Who looks at it |
|---|---|---|---|
| Errors | Sentry (optional; no-op without `NEXT_PUBLIC_SENTRY_DSN`) | `onRequestError` server errors, `global-error.tsx` client crashes; `sendDefaultPii: false` | the owner, email alerts from Sentry |
| Logs | `src/lib/log.ts` → Vercel runtime logs | JSON lines `{ level, event, time, ...ctx }`: `push.disabled`, `push.send_failed`, `push.query_failed`, `push.failed`, `health.db_failed` | the owner, Vercel → Logs |
| Metrics | NOT APPLICABLE — no metrics backend in v1; the success metrics in §1 are SQL queries | — |
| Uptime | Vercel Cron → `/api/health` daily at 09:00 UTC | DB reachability; keeps Supabase Free active | Vercel → Cron Jobs history |

### The metrics that matter for this project

| Metric | Target | Alert at |
|---|---|---|
| Realtime propagation (manual check) | < 5 s | > 10 s observed twice in a week → investigate Realtime status |
| `/api/health` result | 200 daily | any non-200 in Vercel cron history |
| Supabase DB size | < 50 MB | 400 MB (Free limit 500 MB) |
| Push failures | 0 `push.send_failed` per day | > 5 per day |
| Items added per week (business) | ≥ 10 | < 3 for two weeks → product question, not a bug |

### Health check
`GET /api/health` with `Authorization: Bearer $CRON_SECRET`: runs a `count` query on `households` with the
service-role client (proves the DB is reachable and keeps the project active); 200 `{ ok: true }`, 503 on DB
error, 401 without the bearer. Polled daily by Vercel Cron (`vercel.json`, schedule `0 9 * * *`).

### Cost model

| Service | Free tier | Cost at 1 household | Cost at 10× (10 households) | Cliff to watch |
|---|---|---|---|---|
| Vercel Hobby | non-commercial use, 2 cron jobs (daily) | 0 USD | 0 USD | commercial use requires Pro (20 USD/mo) |
| Supabase Free | 500 MB DB, 50k MAU, 200 concurrent realtime connections, pauses after ~1 week inactive | 0 USD | 0 USD | pause on inactivity (mitigated by cron); 2 free projects per org |
| Sentry Developer | 5k errors/mo | 0 USD | 0 USD | error storms |
| Web Push (Apple/Google push services) | free | 0 USD | 0 USD | none |
| Google OAuth | free | 0 USD | 0 USD | OAuth consent "testing" mode limits to 100 test users — fine for one household |

**Estimated monthly cost at launch: 0 USD.** The largest risk line is Supabase pausing the project; the daily
cron is the lever. Nothing scales superlinearly at this size.

---

## 17. Model Routing

NOT APPLICABLE — this project does not call an LLM at runtime.

---

## 18. Skills to Use During Build

Install commands copied from `knowledge/skills-registry.md`. None of these is required: if a skill is
unavailable, follow the blueprint's own content, note the fallback in one line, and continue.

| Skill | Build steps | Why | Install |
|---|---|---|---|
| ui-ux-pro-max | 2, 9, 10 | keeps the palette, type and component style coherent with §7 | `/plugin marketplace add nextlevelbuilder/ui-ux-pro-max-skill` then `/plugin install ui-ux-pro-max@ui-ux-pro-max-skill` |
| frontend-design | 8, 9, 10, 13 | production-grade screens for bienvenida, Inicio, Compras, Ajustes | `/plugin marketplace add anthropics/skills` then `/plugin install example-skills@anthropic-agent-skills` |
| emil-design-eng | 10, 11 | check-off, enter/exit and stagger motion — ask it a concrete question ("spring for a list check-off under 250 ms") | `npx skills@latest add emilkowalski/skills` |
| playwright-cli | 2, 3, 6, 8–11 | debugging E2E specs | `npm install -g @playwright/cli@latest` then `playwright-cli install --skills` |

All four auto-activate (no slash command).

---

## 19. Agent Workspace

Bundle mode: every artifact below is a real file under `blueprints/homeboard/workspace/`, at the path it occupies
in the project. §10 Bootstrap copies the directory into the project root **once**, with the marker-gated form

```bash
[ -e .workspace-applied ] || { cp -R blueprints/homeboard/workspace/. . && touch .workspace-applied; }   # once only: exits 0 when the marker exists; never reverts files steps edited
```

`rsync -a --ignore-existing` is not used because Git for Windows does not ship rsync, and `cp -Rn` is not used
because it exits 1 on BSD/macOS when it skips a file. Files that are **never** overwritten by a re-run:
everything (the marker skips the whole copy) — and in particular `package.json` and `pnpm-lock.yaml`, which
are not in `workspace/` at all (the scaffold owns the manifest; Bootstrap edits it). The copy's first run
deliberately replaces three scaffold files: `.gitignore`, `biome.json`, `pnpm-workspace.yaml`. Every emitted
file is reformatted by Bootstrap's `pnpm exec biome check --write .`, so the copies on disk always match the
formatter config the blueprint leaves behind (`biome.json`: spaces, width 2, line width 120). The contents
below are the files byte for byte. `.claude/commands/` is not emitted.

### 19.1 `CLAUDE.md`

````markdown
# HomeBoard

PWA en español para la convivencia de un hogar: micro apps compartidas en tiempo real (v1: Lista de compras).

## Commands

| Task | Command |
|---|---|
| Install | `pnpm install` |
| Dev server | `pnpm dev` — http://localhost:3000 |
| Build / run built app | `pnpm build` · `pnpm start` · smoke: `pnpm smoke` (port 3101, needs a build) |
| Typecheck | `pnpm typecheck` (`next typegen && tsc --noEmit`) |
| Lint / format | `pnpm lint` (Biome) · `pnpm format` · CI form: `pnpm exec biome ci .` |
| Unit tests | `pnpm test` · one file: `pnpm test tests/unit/<file>.test.ts` |
| E2E | `pnpm test:e2e` · one file: `pnpm test:e2e tests/e2e/<file>.spec.ts` (builds and serves on port 3100) |
| Local Supabase | `pnpm db:start` · `pnpm db:stop` (needs Docker Desktop running) |
| Reset DB (migrations + seed) | `pnpm db:reset` |
| RLS tests (pgTAP) | `pnpm db:test` |
| Regenerate DB types | `pnpm db:types` → `src/lib/database.types.ts` |
| New migration | `pnpm exec supabase migration new <name>` (the CLI names the file) |
| Write .env.local | `pnpm env:local` (after `pnpm db:start`; keeps existing VAPID/CRON values) |
| PWA icons | `pnpm icons` |

**Gate:** `pnpm lint && pnpm typecheck && pnpm test` must pass before any task is marked done; data and
E2E tasks also need `pnpm db:start && pnpm db:reset` first.

Runtime: Node pinned in `.nvmrc` (`26`; `engines` allows `>=24`). pnpm pinned by `packageManager`.
Dependency versions live in `pnpm-lock.yaml` — read it, never guess one.

Build order and status: `blueprints/homeboard/tasks.json` + `blueprints/homeboard/epics/`. Rationale: `blueprints/homeboard/blueprint.md`.

## Stack

Next.js 16 App Router (Turbopack) · TypeScript 6 · Tailwind CSS 4 (CSS-first `@theme`) · Supabase (Postgres + RLS,
Auth, Realtime) via `@supabase/ssr` · no ORM (SQL migrations) · zod · motion · sonner · Phosphor icons ·
web-push (VAPID) · Sentry (optional) · Vercel Hobby.

## Architecture

**Request path.** Browser → `src/proxy.ts` (refreshes the Supabase session cookie; anonymous → `/entrar`;
no household → `/bienvenida`) → `src/app/(app)/<route>/page.tsx` (Server Component, reads with
`createClient()` from `src/lib/supabase/server.ts`) → Postgres, where RLS decides what rows exist.
Mutations: `src/app/(app)/<route>/actions.ts` Server Actions — authorize (`getUser()`), validate with
zod, write, then `sendPushToHousehold` (`src/lib/push/send.ts`). Live updates: the client subscribes
with `src/lib/supabase/client.ts` to `postgres_changes` on `shopping_items` filtered by `household_id`.

**Boundaries.**

| Layer | May import from | Must never |
|---|---|---|
| `src/app/**` routes, actions | `components`, `lib`, `micro-apps` | Call Supabase without going through `src/lib/supabase/*` |
| `src/components/**` | `lib` (client-safe parts), `micro-apps` | Import `src/lib/supabase/server.ts`, `admin.ts`, `push/send.ts` |
| `src/lib/supabase/admin.ts` (service role) | `lib/env` | Be imported by any `"use client"` file or any Server Component page |
| `src/micro-apps/registry.ts` | nothing | Import React or Supabase — it is plain data |
| `scripts/*.mjs` | Node built-ins and installed packages | Import anything from `src/` |

**Where things live.**

| Concern | Single source of truth |
|---|---|
| DB schema | `supabase/migrations/` — new file via `pnpm exec supabase migration new`, then `pnpm db:reset && pnpm db:types` |
| DB types | `src/lib/database.types.ts` — generated, never hand-edited |
| Env access | `src/lib/env.ts` — `getPublicEnv()` / `requireServerEnv()`; never read `process.env` elsewhere except `src/lib/push/send.ts`, `src/lib/supabase/client.ts` (inlined `NEXT_PUBLIC_` values), `src/app/layout.tsx` (`NEXT_PUBLIC_SITE_URL` in metadata), `src/instrumentation*.ts` and `src/app/api/health/route.ts` |
| Design tokens | `src/app/globals.css` (`:root`, `.dark`, `@theme inline`) — no raw hex in components |
| Micro apps | `src/micro-apps/registry.ts` |
| Session | `src/lib/supabase/server.ts` `createClient()`; `supabase.auth.getUser()` in every Server Action |
| Logs | `src/lib/log.ts` — structured JSON, redacts secrets/PII keys |

## Code rules

1. **One component per file, max 250 lines.** Split by responsibility past that.
2. **Imports:** `@/` alias → `src/`, extensionless (`@/lib/env`). No `../../`. `scripts/*.mjs` never import `src/`.
3. **Server Components by default.** `"use client"` only on the leaf that needs state, effects or events.
4. **No barrel files** (`index.ts` re-exports). Import from the source module.
5. **Validate at the edge.** Every Server Action and route handler parses input with zod before any write.
6. **Authorize inside every Server Action** (`getUser()`), never only in `proxy.ts` — Server Actions are POSTs the matcher may skip.
7. **Actions return** `{ ok: true, data } | { ok: false, error: <code> }`; UI maps codes to Spanish copy.
8. **Soft delete only** on `shopping_items` (`deleted_at`). Never `DELETE` a row a client can see — Realtime does not apply RLS to DELETE events.
9. **All UI copy in Spanish** (tú, warm, short). Identifiers in English.
10. **No new dependency without a reason in the commit message.**

## Design system

| Role | Light | Dark | Used for |
|---|---|---|---|
| Primary | `#C2410C` | `#FB923C` | Primary buttons, active tab, focus ring |
| On primary | `#FFFFFF` | `#1C1917` | Text on primary |
| Primary soft | `#FFEDD5` | `#3A3431` | Selected tile, chips |
| Background | `#FFFBEB` | `#1C1917` | Page |
| Surface | `#FFFFFF` | `#292524` | Cards, sheets, tab bar |
| Foreground | `#1C1917` | `#FAFAF9` | Body text |
| Muted | `#F5F0E8` | `#3A3431` | Inputs, done items |
| Muted text | `#57534E` | `#D6D3D1` | Captions, quantities |
| Border | `#EDE4D8` | `#44403C` | Dividers, input outlines |
| Success | `#047857` | `#34D399` (on `#052E16`) | Checkmarks, "Comprado" |
| Accent | `#D97706` | `#D97706` | Decorative only — never text |
| Destructive | `#DC2626` | `#F87171` | Delete, errors |

- **Type:** headings Nunito 800 (`font-heading`); body DM Sans 400/500, 16px / 1.5. Scale 14 / 16 / 18 / 22 / 28 / 34 px.
- **Spacing:** 4px base — 4, 8, 12, 16, 20, 24, 32, 40. No arbitrary values.
- **Radius:** cards 20px (`rounded-card`), inputs 14px (`rounded-input`), buttons full pill.
- **Elevation:** flat; borders only. One token `shadow-sheet` for bottom sheets and toasts.
- **Touch targets:** ≥ 44px. Bottom tab bar respects `env(safe-area-inset-bottom)`.
- **Icons:** Phosphor only (`regular`; `duotone` on micro-app tiles). No emoji as icons.
- **Motion:** `motion/react` springs, 150–250 ms; exits ≈ 65% of enter; realtime enters staggered 40 ms; everything off under `prefers-reduced-motion`.

## Environment

| Variable | Required from step | Used by | Source |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 6 | `src/lib/env.ts` | `pnpm env:local` · Supabase dashboard |
| `SUPABASE_SERVICE_ROLE_KEY` | 12 | `src/lib/supabase/admin.ts` | same |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | 12 (absent = push disabled) | `src/lib/push/*` | `pnpm env:local` generates them |
| `CRON_SECRET` | 14 | `src/app/api/health/route.ts` | `pnpm env:local` · Vercel env |
| `NEXT_PUBLIC_SITE_URL` | optional | `src/app/layout.tsx` | default `http://localhost:3000` |
| `NEXT_PUBLIC_SENTRY_DSN` | optional (empty = no-op) | `src/instrumentation*.ts` | sentry.io |
| `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID` / `_SECRET` | optional locally | `supabase/config.toml` | Google Cloud console |
| `NODE_ENV` | — | Next.js, Vitest | set automatically by the runtime; never set by hand |

`.env.example` is committed and stays in sync. `.env.local` is written by `pnpm env:local` and never committed.
Next loads `.env.local` itself; Playwright loads it in `playwright.config.ts`; unit tests never read it.

## Rules

| File | Applies to |
|---|---|
| `.claude/rules/database.md` | `supabase/**`, `src/lib/supabase/**`, `src/lib/database.types.ts` |
| `.claude/rules/server-actions.md` | `src/app/**/actions.ts`, `src/lib/push/**`, `src/proxy.ts`, `src/app/**/route.ts` |
| `.claude/rules/ui.md` | `src/app/**/*.tsx`, `src/components/**`, `src/app/globals.css` |
| `.claude/rules/pwa.md` | `public/sw.js`, `src/app/manifest.ts`, `src/app/offline/**`, `scripts/generate-icons.mjs`, `src/components/push-toggle.tsx`, `src/lib/push/support.ts` |
| `.claude/rules/tests.md` | `tests/**`, `supabase/tests/**`, `vitest.config.ts`, `playwright.config.ts` |

## Non-negotiable

1. Every table has RLS enabled; a non-member sees zero rows. `pnpm db:test` stays green.
2. The service-role key never reaches the browser: only `src/lib/supabase/admin.ts` reads it.
3. No hard `DELETE` on `shopping_items`; delete = set `deleted_at`.
4. Never commit secrets, `.env.local`, or `supabase/.env`.
5. Never edit generated files by hand: `src/lib/database.types.ts`, an applied migration, `public/icons/*.png` (re-run `pnpm icons`).
6. Never mark a task done with a failing gate, and never edit a `verify` command to make it pass.
7. Nothing from the Non-Goals list (payments, landing page, multiple households per user, native app, offline writes, other micro apps, i18n).
````

### 19.2 `AGENTS.md`

````markdown
# HomeBoard — agent instructions

PWA en español para la convivencia de un hogar: micro apps compartidas en tiempo real (v1: Lista de compras).

## Commands

| Task | Command |
|---|---|
| Install | `pnpm install` |
| Dev | `pnpm dev` |
| Build / smoke | `pnpm build` · `pnpm smoke` |
| Typecheck | `pnpm typecheck` |
| Lint | `pnpm lint` |
| Unit tests | `pnpm test` |
| E2E | `pnpm test:e2e` |
| Local DB | `pnpm db:start` · `pnpm db:reset` · `pnpm db:test` · `pnpm db:types` |
| Env | `pnpm env:local` |

Gate: `pnpm lint && pnpm typecheck && pnpm test` before marking anything done.

## Non-negotiable

1. Every table has RLS enabled; a non-member sees zero rows. `pnpm db:test` stays green.
2. The service-role key never reaches the browser: only `src/lib/supabase/admin.ts` reads it.
3. No hard `DELETE` on `shopping_items`; delete = set `deleted_at`.
4. Never commit secrets, `.env.local`, or `supabase/.env`.
5. Never edit generated files by hand: `src/lib/database.types.ts`, an applied migration, `public/icons/*.png`.
6. Never mark a task done with a failing gate, and never edit a `verify` command to make it pass.
7. Nothing from the Non-Goals list (payments, landing page, multiple households per user, native app, offline writes, other micro apps, i18n).

Full architecture, boundaries, and design tokens: see `CLAUDE.md` in this directory.
````

### 19.3 `.claude/settings.json`

Every `Verify` subcommand in §9 and every §20.1 command is covered: `pnpm lint|typecheck|test|build|smoke|icons`,
`pnpm test:*` (covers `pnpm test <file>` and `pnpm test:e2e <files>`), `pnpm db:start|db:reset|db:test|db:types|db:config`,
`pnpm env:local`, `pnpm install --frozen-lockfile`, `pnpm exec biome ci .`, `test` (the strict
expected-failure form), `grep -q`, and the read-only/checkpoint `git` commands. No bare interpreter, no
`curl`, no `pnpm dlx`.

```json
{
  "permissions": {
    "allow": [
      "Bash(pnpm install)",
      "Bash(pnpm install --frozen-lockfile)",
      "Bash(pnpm lint)",
      "Bash(pnpm format)",
      "Bash(pnpm typecheck)",
      "Bash(pnpm test)",
      "Bash(pnpm test:*)",
      "Bash(pnpm build)",
      "Bash(pnpm smoke)",
      "Bash(pnpm icons)",
      "Bash(pnpm dev)",
      "Bash(pnpm db:start)",
      "Bash(pnpm db:stop)",
      "Bash(pnpm db:reset)",
      "Bash(pnpm db:test)",
      "Bash(pnpm db:types)",
      "Bash(pnpm db:config)",
      "Bash(pnpm env:local)",
      "Bash(pnpm exec biome ci .)",
      "Bash(pnpm exec biome check --write .)",
      "Bash(pnpm exec supabase init)",
      "Bash(pnpm exec supabase status:*)",
      "Bash(pnpm exec supabase migration new:*)",
      "Bash(pnpm exec playwright install chromium)",
      "Bash(node scripts/apply-scaffold-edits.mjs)",
      "Bash(test:*)",
      "Bash(grep -q:*)",
      "Bash(git add -A)",
      "Bash(git commit:*)",
      "Bash(git tag:*)",
      "Bash(git status:*)",
      "Bash(git diff:*)",
      "Bash(git log:*)",
      "Bash(git ls-files:*)",
      "Bash(git check-ignore:*)",
      "Bash(git rev-list:*)",
      "Bash(git rev-parse:*)"
    ],
    "deny": [
      "Read(./.env)",
      "Read(./.env.local)",
      "Read(./.env.*.local)",
      "Read(./supabase/.env)",
      "Bash(git push:*)",
      "Bash(pnpm exec supabase link:*)",
      "Bash(pnpm exec supabase db push:*)",
      "Bash(pnpm exec supabase db reset --linked:*)"
    ]
  }
}
```

### 19.4 Project skills — `.claude/skills/<name>/SKILL.md`

| Skill | Triggers on | What it automates |
|---|---|---|
| `add-migration` | "add a migration", "new column", "change RLS" | CLI migration → reset → types → pgTAP |
| `add-micro-app` | "add a micro app", "new tile on Inicio" | registry entry → table with RLS → route → tests |

````markdown
---
name: add-migration
description: Use when changing the database schema in HomeBoard — adding a table, column, index, policy or SQL function, or when someone says "add a migration", "new column", "change RLS". Creates the migration with the Supabase CLI, applies it locally, regenerates types and proves isolation with pgTAP.
---

# Add a migration

## When to use
Any change to tables, columns, indexes, RLS policies, triggers or SQL functions.

## Steps
1. `pnpm db:start`
2. `pnpm exec supabase migration new <snake_case_name>` — the CLI creates the file; open the newest file in `supabase/migrations/`.
3. Write the SQL. New table: `enable row level security` and its policies in the same file. Functions: `set search_path = ''`.
4. If clients must see the table live, add `alter publication supabase_realtime add table public.<table>;` and soft-delete its rows.
5. `pnpm db:reset` then `pnpm db:types`.
6. Add or extend assertions in `supabase/tests/` proving a non-member sees 0 rows; update `select plan(N)` to the new count of assertions in that file.

## Verify
```bash
pnpm db:reset    # expect: exit 0
pnpm db:test     # expect: exit 0, every pgTAP assertion ok
pnpm typecheck   # expect: exit 0 with the regenerated types
```

## Do not
- Edit a migration that already ran in the cloud — add a new one.
- Use the dashboard schema editor.
- Add a DELETE policy to `shopping_items`.
````

````markdown
---
name: add-micro-app
description: Use when adding a new micro app to HomeBoard after v1 (tareas, gastos...) — "add a micro app", "new tile on Inicio", "register an app". Registers it in src/micro-apps/registry.ts, creates its route under (app), its table with RLS and its tests.
---

# Add a micro app

## When to use
Only when a new micro app has been approved as scope. v1 ships only `lista-compras` (other micro apps are a v1 Non-Goal).

## Steps
1. Add an entry to `src/micro-apps/registry.ts`: `id` (kebab-case), `nombre`, `descripcion`, `icono` (one of the allowed icon names), `ruta` (`/<slug>`), `enabled: false` until it works.
2. Create its table with the `add-migration` skill (a `household_id` column, RLS via `is_household_member`, soft delete if clients render it live).
3. Create `src/app/(app)/<slug>/page.tsx` and `actions.ts` following `.claude/rules/server-actions.md`.
4. Add `tests/e2e/<slug>.spec.ts` using `newMemberWithHousehold` from `tests/e2e/helpers.ts`.
5. Flip `enabled: true` and update the expectations in `tests/unit/registry.test.ts`.

## Verify
```bash
pnpm test tests/unit/registry.test.ts   # expect: exit 0
pnpm db:reset                           # expect: exit 0
pnpm db:test                            # expect: exit 0
pnpm test:e2e tests/e2e/home.spec.ts    # expect: exit 0
```

## Do not
- Store the registry in the database.
- Ship a tile with `enabled: true` whose route does not exist.
````

### 19.5 `.claude/rules/*.md`

| File | `paths` globs | Covers |
|---|---|---|
| `.claude/rules/database.md` | `supabase/**`, `src/lib/supabase/**`, `src/lib/database.types.ts` | migrations, RLS helpers, soft delete, seed users |
| `.claude/rules/server-actions.md` | `src/app/**/actions.ts`, `src/app/**/route.ts`, `src/lib/push/**`, `src/proxy.ts` | action order, envelope, push fire-and-forget, cron GET |
| `.claude/rules/ui.md` | `src/app/**/*.tsx`, `src/components/**`, `src/app/globals.css` | tokens, 44px, icons, copy, motion |
| `.claude/rules/pwa.md` | `public/sw.js`, `src/app/manifest.ts`, `src/app/offline/**`, `scripts/generate-icons.mjs`, `src/components/push-toggle.tsx`, `src/lib/push/support.ts` | worker scope, icons, iOS push rules |
| `.claude/rules/tests.md` | `tests/**`, `supabase/tests/**`, `vitest.config.ts`, `playwright.config.ts` | mocks, isolation, pgTAP impersonation |

```markdown
---
description: Supabase schema, RLS, migrations and seed conventions
paths:
  - "supabase/**"
  - "src/lib/supabase/**"
  - "src/lib/database.types.ts"
---

# Base de datos

- The schema lives only in `supabase/migrations/`. Never change it from the Supabase dashboard (read-only for us).
- New change = new migration: `pnpm exec supabase migration new <name>`; the CLI names the file. Never edit a migration that already ran in the cloud (`supabase db push`); add a new one.
- After any migration: `pnpm db:reset && pnpm db:types && pnpm db:test`, all exit 0.
- Every table: `alter table ... enable row level security;` in the same migration that creates it, plus explicit policies. No table ships without a pgTAP assertion in `supabase/tests/`.
- Membership checks go through `public.is_household_member(hid)` / `public.is_household_owner(hid)` / `public.shares_household(uid)` (security definer, `set search_path = ''`). Never query `household_members` inside another table's policy directly — that recurses into its own RLS.
- Every function: `security definer` only when it must bypass RLS, always with `set search_path = ''` and schema-qualified names (`public.x`, `auth.uid()`).
- `shopping_items` is soft-deleted (`deleted_at`). There is no DELETE policy and there must never be one.
- Business errors raised from SQL use `raise exception '<codigo>' using errcode = 'P0001'` with a snake_case Spanish code (`codigo_invalido`, `ya_tiene_hogar`, `hogar_lleno`, `nombre_invalido`); the app maps codes to copy.
- `src/lib/database.types.ts` is generated by `pnpm db:types`. Never hand-edit it.
- Seed users (local only) share the password `homeboard-dev-1234`: `ana@homeboard.test`, `luis@homeboard.test` (Casa de Ana, code `CASA2345`), `bea@homeboard.test` (Casa de Bea, code `BEAHGR78`).
```

```markdown
---
description: Server Actions, route handlers, proxy and push sending
paths:
  - "src/app/**/actions.ts"
  - "src/app/**/route.ts"
  - "src/lib/push/**"
  - "src/proxy.ts"
---

# Servidor

- Order inside every Server Action: `const supabase = await createClient()` → `getUser()` (no user → `{ ok: false, error: "no_autenticado" }`) → zod `safeParse` → write → side effects (push) → `revalidatePath` if needed → return.
- Return `{ ok: true, data } | { ok: false, error: <snake_case code> }`. Never throw to the client; never return raw Postgres messages.
- The household id always comes from the database (`household_members` row of `user.id`), never from the client payload.
- Push is fire-and-forget after the write succeeds: `void notify(...)` whose rejection is caught and logged — it never fails the action and never reaches the user.
- `src/lib/supabase/admin.ts` (service role) is imported only by `src/lib/push/send.ts` and `src/app/api/health/route.ts`.
- `src/proxy.ts` exports `proxy` (not `middleware`). It refreshes the session and redirects; it is NOT the authorization layer.
- Route handlers that Vercel Cron calls export `GET` (cron never sends POST) and compare `Authorization: Bearer ${CRON_SECRET}`.
- Log with `log.info/warn/error(event, ctx)` from `src/lib/log.ts`. Never log emails, tokens, keys or push endpoints by value.
```

```markdown
---
description: UI, tokens, Spanish copy, motion and accessibility conventions
paths:
  - "src/app/**/*.tsx"
  - "src/components/**"
  - "src/app/globals.css"
---

# Interfaz

- Colors only through tokens: `bg-background`, `bg-surface`, `text-foreground`, `text-muted-foreground`, `bg-muted`, `border-border`, `bg-primary text-on-primary`, `bg-primary-soft`, `text-success`, `text-destructive`. A raw hex outside `globals.css` is a defect — the only exceptions are `viewport.themeColor` in `src/app/layout.tsx` and the colors in `src/app/manifest.ts`, which must be literals.
- Radius: `rounded-card` (20px) for cards, `rounded-input` (14px) for inputs, `rounded-full` for buttons.
- Every interactive element is at least 44px tall (`min-h-11`). Icon-only buttons carry an `aria-label` in Spanish.
- Icons: `@phosphor-icons/react` (`weight="regular"`; `weight="duotone"` on micro-app tiles). In Server Components import from `@phosphor-icons/react/ssr`. No emoji as icons.
- Every list has loading, empty and error states. Empty copy is friendly: `Nada por comprar. ¡Qué paz!`.
- Errors render as text in an element with `role="alert"` — never color alone.
- Motion: `import { AnimatePresence, motion, useReducedMotion } from "motion/react"`. Springs (`type: "spring", stiffness: 500, damping: 40`) or 150–250 ms; exits about 65% of enter; stagger new realtime items 40 ms. When `useReducedMotion()` is true, render without animation.
- Toasts: `toast()` from `sonner`; destructive actions offer `Deshacer` for 5 s.
- Copy: Spanish, tú, short, warm. Labels are a contract with `tests/e2e/helpers.ts` — never reword `Correo`, `Contraseña`, `Nombre`, `Entrar`, `Crear cuenta`, `Nombre del hogar`, `Crear hogar`, `Código de invitación`, `Unirme`.
```

```markdown
---
description: Service worker, manifest, icons and Web Push client rules
paths:
  - "public/sw.js"
  - "src/app/manifest.ts"
  - "src/app/offline/**"
  - "scripts/generate-icons.mjs"
  - "src/components/push-toggle.tsx"
  - "src/lib/push/support.ts"
---

# PWA

- `public/sw.js` is hand-written (no Serwist/Workbox). It precaches only `/offline`, answers failed navigations with it, and handles `push` and `notificationclick`. Bump `CACHE` (`homeboard-vN`) whenever the offline page changes.
- Never cache API responses or authenticated pages in the worker — offline writes are a Non-Goal.
- Icons are generated by `pnpm icons` and committed. Change the drawing in the script, never the PNGs.
- iOS delivers Web Push only to an installed PWA (16.4+) and only after a user tap. The `Activar notificaciones` button exists only when `pushSupportState(...)` returns `disponible`; on iPhone in Safari it returns `instalar` and the UI shows the "Añadir a pantalla de inicio" hint instead.
- `Notification.requestPermission()` is called only inside that button's click handler.
- Manifest paths and the proxy matcher must agree: `/manifest.webmanifest`, `/sw.js`, `/offline`, `/icons/*` are public.
```

```markdown
---
description: Unit, E2E and pgTAP test conventions
paths:
  - "tests/**"
  - "supabase/tests/**"
  - "vitest.config.ts"
  - "playwright.config.ts"
---

# Tests

- Unit (`tests/unit/*.test.ts`, Vitest, Node env): pure logic and route handlers. Mock `@/lib/supabase/server`, `@/lib/supabase/admin`, `web-push` and `@sentry/nextjs` with `vi.mock`; use `vi.hoisted` for mock fns referenced inside factories. Never read `.env.local`; use `vi.stubEnv`.
- No `.skip` or `.only` committed. CI fails on `.only` (`forbidOnly`).
- E2E (`tests/e2e/*.spec.ts`, Playwright, Pixel 7 Chromium, port 3100): use `tests/e2e/helpers.ts`. Tests that write data create their own user and household with `newMemberWithHousehold`; read-only tests may sign in as seed `ana@homeboard.test`. Never depend on another test's data or order.
- Run `pnpm db:start && pnpm db:reset` before E2E or pgTAP.
- pgTAP (`supabase/tests/*.test.sql`): `begin; ... select plan(N); ... select * from finish(); rollback;`. Impersonate with `set local role authenticated` plus `select set_config('request.jwt.claims', '{"sub":"<uuid>","role":"authenticated"}', true)`; `reset role` between users.
- Timing assertions use Playwright's auto-waiting `expect(...).toBeVisible({ timeout: 5000 })`, never fixed sleeps.
```

### 19.6 Verify-critical config and local infrastructure

| File | Path in the project | Which `Verify` commands need it | Resolution/env handling it carries | Bundle-path exclusion |
|---|---|---|---|---|
| `biome.json` | `biome.json` (replaces the scaffold's) | every `pnpm lint` (steps 1–14), `pnpm exec biome ci .` (§20.1) | `css.parser.tailwindDirectives: true`; `!**/*.svg`; excludes generated types | `"!blueprints"` in `files.includes` |
| `.gitignore` | `.gitignore` | step 1 `git check-ignore` lines; Biome `vcs.useIgnoreFile` | `!.env.example` after `.env*` | n/a — the bundle is committed on purpose |
| `pnpm-workspace.yaml` | `pnpm-workspace.yaml` | Bootstrap installs → every gate | `allowBuilds` (supabase `true`, others `false`/`true`) | n/a — no `packages:` globs |
| `vitest.config.ts` | `vitest.config.ts` | `pnpm test` (steps 1, 7, 9, 12, 13, 14) | alias `@` → `./src`; Node env; `clearMocks: true` resets `vi.fn()` call history between tests; reads no env file | `exclude: ["blueprints/**", …]` and `include` limited to `tests/unit/**` |
| `tests/setup/unit.ts` | `tests/setup/unit.ts` | every `pnpm test` | sets harmless `NEXT_PUBLIC_SUPABASE_*` so modules never need `.env.local` | n/a |
| `src/app/globals.css` | `src/app/globals.css` | `pnpm dev` / `pnpm build` (Tailwind CSS scans this file for directives at steps 2–14) | `@import "tailwindcss"`; `@source not "../../blueprints"` prevents Tailwind from scanning the bundle path | `@source not "../../blueprints"` |
| `playwright.config.ts` | `playwright.config.ts` | `pnpm test:e2e` (steps 2, 3, 6, 8–14) | `process.loadEnvFile(".env.local")`; webServer `pnpm build && pnpm start --port 3100` | `testIgnore: ["**/blueprints/**"]`, `testDir: "./tests/e2e"` |
| `tests/e2e/helpers.ts` | `tests/e2e/helpers.ts` | every E2E spec | relative import `./helpers`; seed credentials | n/a (inside testDir) |
| `.env.example` | `.env.example` | documentation; CI reads none of it | — | n/a |
| `src/types/web-push.d.ts` | `src/types/web-push.d.ts` | `pnpm typecheck` from Bootstrap on (step 12 imports it) | ambient `declare module "web-push"` with named exports | n/a (tsconfig excludes `blueprints`) |
| `vercel.json` | `vercel.json` | step 14 `tests/unit/deploy.test.ts` | — | n/a |
| `.github/workflows/ci.yml` | `.github/workflows/ci.yml` | step 14 `tests/unit/deploy.test.ts` | JSON syntax (valid YAML) so a test can parse it without a YAML library | n/a |
| `scripts/apply-scaffold-edits.mjs` | `scripts/` | Bootstrap; owns `package.json` scripts every Verify calls | adds `"blueprints"` to `tsconfig.json` `exclude` | writes the tsconfig exclusion |
| `scripts/patch-supabase-config.mjs` | `scripts/` | step 4 (`pnpm db:config`) | — | n/a |
| `scripts/write-env-local.mjs` | `scripts/` | step 4 Verify (`pnpm env:local`), CI | reads `supabase status -o json`; named import from `web-push` | n/a |
| `scripts/gen-types.mjs` | `scripts/` | step 4 Verify (`pnpm db:types`) | — | n/a |
| `scripts/generate-icons.mjs` | `scripts/` | step 3 Verify (`pnpm icons`) | — | n/a |
| `scripts/smoke.mjs` | `scripts/` | steps 1, 14 and §20.1 (`pnpm smoke`) | Next loads `.env.local` for the server it spawns | n/a |
| `tsconfig.json` (scaffold + edit) | `tsconfig.json` | `pnpm typecheck` | scaffold's `paths: {"@/*": ["./src/*"]}`, `moduleResolution: "bundler"` | `"blueprints"` in `exclude` (Bootstrap line 4) |

**Services.** The only service is the local Supabase stack, provisioned by the Supabase CLI (§11, pinned
3.2.0) from `supabase/config.toml` (created in step 4 by `supabase init` + `pnpm db:config`) instead of a
compose file: (1) starts with `pnpm db:start`, which returns once the stack is healthy and exits 0 when it is
already running; (2) the variables pointing at it are in §10 with their local values and written by
`pnpm env:local`; (3) up/down/reset are `pnpm db:start` / `pnpm db:stop` / `pnpm db:reset` in §10 and
`CLAUDE.md`; (4) all three are in `.claude/settings.json`. Image tags are pinned by the CLI version.

#### Resolution convention matrix

**The convention, stated once:** inside `src/**` and `tests/unit/**`, project modules are imported through
the alias `@/` → `src/`, **without a file extension** (`@/lib/env`); `tests/e2e/*.spec.ts` import their
sibling helper as `./helpers` (no alias, no extension); `scripts/*.mjs` import only `node:` built-ins and
installed packages, never `src/`. This deliberately differs from the ts-node track's `.ts`-specifier
convention: no plain-Node script in this project loads TypeScript source, so the one context that convention
protects does not exist here (decision log #13).

| Context | Command that exercises it | Convention as it appears there | Config + literal setting that makes it work |
|---|---|---|---|
| Application source | `pnpm build` / `pnpm dev` | `import { getPublicEnv } from "@/lib/env"` | `tsconfig.json` — `"paths": { "@/*": ["./src/*"] }` (scaffold `--import-alias "@/*"`) and `"moduleResolution": "bundler"`; Turbopack reads tsconfig paths |
| Type checking | `pnpm typecheck` | same | same `tsconfig.json`; bundler resolution accepts extensionless specifiers |
| Unit tests | `pnpm test` | `import { GET } from "@/app/auth/callback/route"` | `vitest.config.ts` — `resolve.alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) }`; Vite resolves extensionless |
| E2E tests | `pnpm test:e2e` | `import { signIn } from "./helpers"` | Playwright's built-in TS transform resolves relative extensionless imports; specs never use `@/` |
| Standalone scripts | `node scripts/smoke.mjs`, `node scripts/write-env-local.mjs`, … | `import { spawn } from "node:child_process"`, `import { generateVAPIDKeys } from "web-push"` | none needed: plain Node ESM resolution of built-ins and packages; `web-push` 4 is ESM with named exports |
| Build output | `pnpm smoke` (runs `.next` via `node_modules/next/dist/bin/next start`) | — (bundled) | Next emits `.next/BUILD_ID`; `smoke.mjs` refuses to run without it |
| pgTAP | `pnpm db:test` | SQL, schema-qualified names (`public.x`) | functions use `set search_path = ''` |

#### Cross-artifact value reconciliation

| Shared value | Single source — the file that decides it | Literal value | Every other place it appears | Compared |
|---|---|---|---|---|
| E2E server port | `playwright.config.ts` — `PORT` | `3100` | `scripts/patch-supabase-config.mjs` redirect `http://localhost:3100/auth/callback` · §3 · §12 · §13 | yes |
| Smoke server port | `scripts/smoke.mjs` — `PORT` | `3101` | `scripts/patch-supabase-config.mjs` redirect `http://localhost:3101/auth/callback` · §10 · §13 | yes |
| Dev origin | Next default | `http://localhost:3000` | `patch-supabase-config.mjs` `site_url` and redirect · `write-env-local.mjs` `NEXT_PUBLIC_SITE_URL` · `src/lib/env.ts` default · `layout.tsx` fallback · `.env.example` · step 7 test `BASE` | yes |
| Built artifact marker | `next build` | `.next/BUILD_ID` | `scripts/smoke.mjs` · `.gitignore` `/.next/` | yes (gated at step 1 by `pnpm build` then `pnpm smoke`) |
| Health endpoint path | `src/app/api/health/route.ts` (file location) | `/api/health` | `vercel.json` `crons[0].path` · `src/proxy.ts` matcher `api/health` · `tests/unit/deploy.test.ts` · §5 · §16 | yes (gated at step 14, the first step where both sides exist) |
| Worker path | `public/sw.js` (file location) | `/sw.js` | `layout.tsx` `SW_REGISTER` · proxy matcher `sw.js` · `pwa.spec.ts` · `household.spec.ts` | yes (step 3; matcher at step 8 re-runs `pwa.spec.ts`) |
| Offline route | `src/app/offline/page.tsx` | `/offline` | `public/sw.js` `OFFLINE_URL` · `src/proxy.ts` `PUBLIC_PATHS` · `pwa.spec.ts` · `household.spec.ts` | yes |
| Icon paths | `scripts/generate-icons.mjs` — `ICONS[].file` | `public/icons/icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `apple-touch-icon.png` | `src/app/manifest.ts` · `layout.tsx` `metadata.icons` · `public/sw.js` notification icon · `pwa.spec.ts` · proxy matcher `icons/` | yes (step 3) |
| Manifest URL | Next convention for `src/app/manifest.ts` | `/manifest.webmanifest` | proxy matcher · `pwa.spec.ts` · `household.spec.ts` | yes |
| Script names | `scripts/apply-scaffold-edits.mjs` — `pkg.scripts` | `lint`, `typecheck`, `test`, `test:e2e`, `build`, `smoke`, `icons`, `db:start`, `db:stop`, `db:reset`, `db:test`, `db:types`, `db:config`, `env:local`, `dev`, `start`, `format` | `.github/workflows/ci.yml` · `CLAUDE.md` / `AGENTS.md` · `.claude/settings.json` · `tasks.json` verify arrays · §9 · §20.1 | yes (step 1 runs five of them; step 14's `deploy.test.ts` asserts every `pnpm <script>` in CI exists) |
| Generated types path | `scripts/gen-types.mjs` — `OUT` | `src/lib/database.types.ts` | `biome.json` exclude · imports in `server.ts`, `client.ts`, `admin.ts`, `proxy.ts` · step 4 Verify greps | yes |
| Seed users and password | `supabase/seed.sql` | `ana@homeboard.test`, `luis@homeboard.test`, `bea@homeboard.test` / `homeboard-dev-1234` | `tests/e2e/helpers.ts` `SEED_USERS`, `SEED_PASSWORD` · `.claude/rules/database.md` · §13 | yes |
| Seed ids, names and codes | `supabase/seed.sql` | Ana `11111111-…`, Bea `33333333-…`, A `aaaaaaaa-…` "Casa de Ana" `CASA2345`, B `bbbbbbbb-…` "Casa de Bea" `BEAHGR78` | `supabase/tests/rls_isolation.test.sql` · `home.spec.ts` (`Hola, Ana`, `Casa de Ana`) · migration regex | yes (step 5 runs the pgTAP file against the seed) |
| Env variable names | `.env.example` | the 11 names in `.env.example` (§10 adds only `CI`, set by GitHub) | `scripts/write-env-local.mjs` · `src/lib/env.ts` · `src/lib/push/send.ts` · `src/app/api/health/route.ts` · `src/instrumentation*.ts` · `patch-supabase-config.mjs` (`env(...)`) · `CLAUDE.md` | yes |
| Local Supabase URL | Supabase CLI default | `http://127.0.0.1:54321` | `.env.example` · `tests/setup/unit.ts` · §10 | yes |
| Bundle path | Bootstrap layout | `blueprints/` (`blueprints/homeboard/workspace/.`) | `biome.json` `!blueprints` · `tsconfig.json` exclude `blueprints` · `vitest.config.ts` `blueprints/**` · `playwright.config.ts` `**/blueprints/**` · Bootstrap copy line | yes |
| Node version | `.nvmrc` | `26` | `actions/setup-node` `node-version-file: .nvmrc` · `package.json` `engines` `>=24` (deliberately wider) | yes |
| pnpm version | `package.json` `packageManager` (written by `apply-scaffold-edits.mjs`) | `pnpm@12.21.0` | `pnpm/action-setup@v4` reads it · §11 | yes |
| UI labels | §6 *UI contract* | `Correo`, `Contraseña`, `Nombre`, `Entrar`, `Crear cuenta`, `Nombre del hogar`, `Crear hogar`, `Código de invitación`, `Unirme`, `codigo-invitacion` | `tests/e2e/helpers.ts` · `.claude/rules/ui.md` · step 6 and 8 **Do** | yes |

#### Byte-exact artifact reconciliation

No golden file or snapshot is authored. These literal comparisons are runtime-produced and are listed so they
are checked on the pinned runtime before shipping:

| Byte-exact artifact | Authored by | First diffed at | Blueprint rules that constrain it | Runtime call that produces it, on the §11 pin | Both confirmed |
|---|---|---|---|---|---|
| `rgb(28, 25, 23)` / `rgb(255, 251, 235)` in `shell.spec.ts` | step 2 | step 2 | §7 `--background` `#1C1917` / `#FFFBEB` (28,25,23 / 255,251,235) | `getComputedStyle(document.body).backgroundColor` in Playwright 1.65.1 Chromium | blueprint: yes · runtime: listed for execution before shipping |
| `16px` body font-size | step 2 | step 2 | §7 body 16px | `getComputedStyle(document.body).fontSize` | blueprint: yes · runtime: listed |
| SQLSTATE `42501` on RLS-violating insert | step 5 | step 5 | §4 `shopping_items_insert` policy | Postgres 17 `insert` violating `with check` | blueprint: yes · runtime: listed |
| `P0001` + `codigo_invalido` / `ya_tiene_hogar` | step 5 | step 5 | §4 `join_household` raises exactly these | our own `raise exception … using errcode = 'P0001'` (authored, not runtime-worded) | yes |
| HTTP `307` + `location` from `NextResponse.redirect` | step 7 | step 7 | §5 callback contract | `NextResponse.redirect(url)` default status on next 16.4.6 | blueprint: yes · runtime: listed |
| cookie prefix `sb-` | step 6 | step 6 | §8 Sessions | `@supabase/ssr` 0.12.7 storage key `sb-<ref>-auth-token` | blueprint: yes · runtime: listed |

### Workspace file contents (§19.6)

`biome.json`

```json
{
  "$schema": "https://biomejs.dev/schemas/2.6.8/schema.json",
  "vcs": {
    "enabled": true,
    "clientKind": "git",
    "useIgnoreFile": true
  },
  "files": {
    "ignoreUnknown": true,
    "includes": [
      "**",
      "!node_modules",
      "!.next",
      "!blueprints",
      "!**/*.svg",
      "!src/lib/database.types.ts",
      "!supabase/.temp",
      "!playwright-report",
      "!test-results",
      "!.vercel"
    ]
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 120
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true
    },
    "domains": {
      "next": "recommended",
      "react": "recommended"
    }
  },
  "assist": {
    "actions": {
      "source": {
        "organizeImports": "on"
      }
    }
  },
  "css": {
    "parser": {
      "tailwindDirectives": true
    }
  }
}
```

`.gitignore`

```gitignore
# HomeBoard — ignore file. Lands in §10 Bootstrap BEFORE the first commit (deliberately replaces the scaffold's).

# dependencies
/node_modules
/.pnp
.pnp.*

# next.js
/.next/
/out/
/build
next-env.d.ts
*.tsbuildinfo

# testing
/coverage
/playwright-report/
/test-results/
/blob-report/

# env files — real values never committed; the template is
.env*
!.env.example

# supabase local state
supabase/.branches
supabase/.temp
supabase/.env

# vercel
.vercel

# misc
.DS_Store
*.pem
npm-debug.log*
pnpm-debug.log*
```

`pnpm-workspace.yaml`

```yaml
# pnpm 12 settings for a single-package project (no `packages:` list — this is not a monorepo).
# allowBuilds is the pnpm 11+ key; the pnpm 10 key onlyBuiltDependencies is silently ignored.
allowBuilds:
  sharp: false
  unrs-resolver: false
  supabase: true
  "@sentry/cli": false
  esbuild: true
```

`.env.example`

```bash
# HomeBoard — variables de entorno. Este archivo SÍ se commitea, siempre sin valores reales.
# En local no lo copies a mano: `pnpm db:start && pnpm env:local` escribe .env.local con los valores locales.

# Supabase — local: `pnpm exec supabase status`; nube: Dashboard > Project Settings > API
# (el dashboard puede llamar "publishable key" a la anon key y "secret key" a la service role key)
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Web Push (VAPID). Generar: node -e "import('web-push').then(m=>console.log(JSON.stringify(m.generateVAPIDKeys())))"
NEXT_PUBLIC_VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:tu-correo@ejemplo.com

# Keep-alive: Vercel Cron envía Authorization: Bearer <CRON_SECRET> a /api/health
CRON_SECRET=

# URL pública del sitio (metadataBase)
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# Opcional. Vacío = Sentry desactivado (no-op)
NEXT_PUBLIC_SENTRY_DSN=

# Opcional en local. Las lee supabase/config.toml con env(); expórtalas en la shell o en supabase/.env
SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID=
SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET=
```

`vitest.config.ts`

```ts
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Unit tests only: pure TypeScript and route handlers in a Node environment. No JSX is rendered here,
// so no React plugin is needed. `@/` mirrors the tsconfig path alias (vitest does not read tsconfig paths).
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
    exclude: ["**/node_modules/**", "blueprints/**", "tests/e2e/**"],
    setupFiles: ["./tests/setup/unit.ts"],
    unstubEnvs: true,
    clearMocks: true,
    restoreMocks: true,
  },
});
```

`tests/setup/unit.ts`

```ts
// Unit tests never read .env.local: they must pass on a machine with no Supabase running.
// Modules that read public env at call time get harmless values here; tests stub anything else with vi.stubEnv.
process.env.NEXT_PUBLIC_SUPABASE_URL ??= "http://127.0.0.1:54321";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "unit-test-anon-key";
```

`playwright.config.ts`

```ts
import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

// Playwright does not read .env files. Load the same file Next reads so the test process and the
// server it starts agree on every value (`pnpm env:local` writes it). Absent file = CI-provided env.
if (existsSync(".env.local")) {
  process.loadEnvFile(".env.local");
}

const PORT = 3100;

export default defineConfig({
  testDir: "./tests/e2e",
  testIgnore: ["**/blueprints/**"],
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  forbidOnly: Boolean(process.env.CI),
  reporter: process.env.CI ? "github" : "list",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [{ name: "mobile-chromium", use: { ...devices["Pixel 7"] } }],
  webServer: {
    command: `pnpm build && pnpm start --port ${PORT}`,
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
  },
});
```

`tests/e2e/helpers.ts`

```ts
import { type Browser, expect, type Page, test } from "@playwright/test";

// Shared E2E helpers. The labels below are the UI contract fixed in blueprint §6 — pages must use them verbatim.
export const SEED_PASSWORD = "homeboard-dev-1234";
export const SEED_USERS = {
  ana: "ana@homeboard.test",
  luis: "luis@homeboard.test",
  bea: "bea@homeboard.test",
} as const;

export function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}@homeboard.test`;
}

export async function signIn(page: Page, email: string, password: string = SEED_PASSWORD): Promise<void> {
  await page.goto("/entrar");
  await page.getByLabel("Correo", { exact: true }).fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).not.toHaveURL(/\/entrar/);
}

export async function registerUser(
  page: Page,
  name: string,
  email: string,
  password: string = SEED_PASSWORD,
): Promise<void> {
  await page.goto("/registro");
  await page.getByLabel("Nombre", { exact: true }).fill(name);
  await page.getByLabel("Correo", { exact: true }).fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Crear cuenta", exact: true }).click();
  await expect(page).not.toHaveURL(/\/registro/);
}

export async function createHousehold(page: Page, name: string): Promise<void> {
  await page.goto("/bienvenida");
  await page.getByLabel("Nombre del hogar", { exact: true }).fill(name);
  await page.getByRole("button", { name: "Crear hogar", exact: true }).click();
  await page.waitForURL((url) => url.pathname === "/");
}

export async function readInviteCode(page: Page): Promise<string> {
  await page.goto("/ajustes");
  const code = (await page.getByTestId("codigo-invitacion").innerText()).trim();
  expect(code).toMatch(/^[A-Z2-9]{8}$/);
  return code;
}

export async function joinHousehold(page: Page, code: string): Promise<void> {
  await page.goto("/bienvenida");
  await page.getByLabel("Código de invitación", { exact: true }).fill(code);
  await page.getByRole("button", { name: "Unirme", exact: true }).click();
  await page.waitForURL((url) => url.pathname === "/");
}

/**
 * A second, fully isolated browser session (its own cookies) with the project's settings — baseURL and the
 * Pixel 7 device. `browser.newContext()` alone does NOT inherit them, so multi-user tests use this.
 */
export async function newIsolatedPage(browser: Browser): Promise<Page> {
  const context = await browser.newContext({ ...test.info().project.use });
  return context.newPage();
}

/** A fresh user who owns a fresh household — the isolation unit for every mutating E2E test. */
export async function newMemberWithHousehold(page: Page, name: string): Promise<{ email: string }> {
  const email = uniqueEmail(name.toLowerCase());
  await registerUser(page, name, email);
  await createHousehold(page, `Casa de ${name}`);
  return { email };
}
```

`src/types/web-push.d.ts`

```ts
// Hand-written types for web-push 4.0.0 (ESM, named exports only — there is no default export).
// @types/web-push targets 3.x and is deliberately NOT installed (blueprint §11, decision log #12).
// Declares only what HomeBoard uses; extend it here if a new export is needed.
declare module "web-push" {
  export type PushSubscription = {
    endpoint: string;
    keys: { p256dh: string; auth: string };
  };

  export type VapidKeys = { publicKey: string; privateKey: string };

  export type SendResult = {
    statusCode: number;
    body: string;
    headers: Record<string, string>;
  };

  export type RequestOptions = {
    TTL?: number;
    urgency?: "very-low" | "low" | "normal" | "high";
    topic?: string;
  };

  export function setVapidDetails(subject: string, publicKey: string, privateKey: string): void;

  export function sendNotification(
    subscription: PushSubscription,
    payload?: string | null,
    options?: RequestOptions,
  ): Promise<SendResult>;

  export function generateVAPIDKeys(): VapidKeys;

  export class WebPushError extends Error {
    statusCode: number;
    body: string;
    headers: Record<string, string>;
    endpoint: string;
  }
}
```

`vercel.json`

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "crons": [
    {
      "path": "/api/health",
      "schedule": "0 9 * * *"
    }
  ]
}
```

`.github/workflows/ci.yml`

```yaml
{
  "name": "CI",
  "on": {
    "push": { "branches": ["main"] },
    "pull_request": {}
  },
  "jobs": {
    "gate": {
      "runs-on": "ubuntu-latest",
      "timeout-minutes": 40,
      "env": { "CI": "true" },
      "steps": [
        { "uses": "actions/checkout@v4" },
        { "uses": "pnpm/action-setup@v4" },
        { "uses": "actions/setup-node@v4", "with": { "node-version-file": ".nvmrc", "cache": "pnpm" } },
        { "name": "Install", "run": "pnpm install --frozen-lockfile" },
        { "name": "Lint", "run": "pnpm exec biome ci ." },
        { "name": "Typecheck", "run": "pnpm typecheck" },
        { "name": "Unit tests", "run": "pnpm test" },
        { "name": "Start local Supabase", "run": "pnpm db:start" },
        { "name": "Write .env.local", "run": "pnpm env:local" },
        { "name": "RLS tests", "run": "pnpm db:test" },
        { "name": "Browsers", "run": "pnpm exec playwright install --with-deps chromium" },
        { "name": "E2E", "run": "pnpm test:e2e" },
        { "name": "Build", "run": "pnpm build" },
        { "name": "Smoke", "run": "pnpm smoke" }
      ]
    }
  }
}
```

`scripts/apply-scaffold-edits.mjs`

```js
// Applies the blueprint's edits on top of the create-next-app scaffold.
// Idempotent: every edit sets a value instead of appending, so §10 Bootstrap can run it any number of times.
// Owns: package.json name/packageManager/engines/scripts, tsconfig.json exclude, next.config.ts cacheComponents.
import { existsSync, readFileSync, writeFileSync } from "node:fs";

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

const pkg = readJson("package.json");
pkg.name = "homeboard";
pkg.private = true;
pkg.packageManager = "pnpm@12.21.0";
pkg.engines = { node: ">=24" };
pkg.scripts = {
  dev: "next dev",
  build: "next build",
  start: "next start",
  lint: "biome check .",
  format: "biome format --write .",
  typecheck: "next typegen && tsc --noEmit",
  test: "vitest run",
  "test:e2e": "playwright test",
  smoke: "node scripts/smoke.mjs",
  icons: "node scripts/generate-icons.mjs",
  "db:start": "supabase start",
  "db:stop": "supabase stop",
  "db:reset": "supabase db reset",
  "db:test": "supabase test db",
  "db:types": "node scripts/gen-types.mjs",
  "db:config": "node scripts/patch-supabase-config.mjs",
  "env:local": "node scripts/write-env-local.mjs",
};
writeJson("package.json", pkg);

const tsconfig = readJson("tsconfig.json");
const exclude = new Set(tsconfig.exclude ?? []);
for (const entry of ["node_modules", "blueprints", "supabase"]) {
  exclude.add(entry);
}
tsconfig.exclude = [...exclude];
writeJson("tsconfig.json", tsconfig);

// Next 16's scaffold turns on cacheComponents + partialPrefetching. HomeBoard opts out of both:
// cacheComponents forces every cookies() read into a <Suspense> boundary (§20.3 #9), and
// partialPrefetching requires cacheComponents — keeping it true while cacheComponents is false
// causes a build error ("partialPrefetching requires cacheComponents to be enabled").
for (const file of ["next.config.ts", "next.config.mjs"]) {
  if (existsSync(file)) {
    let patched = readFileSync(file, "utf8");
    patched = patched.replace(/cacheComponents:\s*true/, "cacheComponents: false");
    patched = patched.replace(/partialPrefetching:\s*true/, "partialPrefetching: false");
    writeFileSync(file, patched);
  }
}

console.log("apply-scaffold-edits: package.json, tsconfig.json y next.config listos");
```

`scripts/patch-supabase-config.mjs`

```js
// Applies HomeBoard's settings to the supabase/config.toml that `supabase init` generated.
// Section-aware and idempotent: each call sets one key inside one [section], creating either if absent.
import { readFileSync, writeFileSync } from "node:fs";

const FILE = "supabase/config.toml";
const lines = readFileSync(FILE, "utf8").split(/\r?\n/);

function sectionRange(name) {
  const start = lines.findIndex((line) => line.trim() === `[${name}]`);
  if (start === -1) {
    return null;
  }
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^\s*\[/.test(lines[i])) {
      end = i;
      break;
    }
  }
  return { start, end };
}

function set(section, key, value) {
  let range = sectionRange(section);
  if (range === null) {
    lines.push("", `[${section}]`);
    range = sectionRange(section);
  }
  const pattern = new RegExp(`^\\s*#?\\s*${key}\\s*=`);
  for (let i = range.start + 1; i < range.end; i++) {
    if (pattern.test(lines[i])) {
      lines[i] = `${key} = ${value}`;
      return;
    }
  }
  lines.splice(range.start + 1, 0, `${key} = ${value}`);
}

set("db", "major_version", "17");
set("auth", "site_url", '"http://localhost:3000"');
set(
  "auth",
  "additional_redirect_urls",
  '["http://localhost:3000/auth/callback", "http://localhost:3100/auth/callback", "http://localhost:3101/auth/callback"]',
);
set("auth.email", "enable_signup", "true");
set("auth.email", "enable_confirmations", "false");
// Google is off locally: the real client id/secret only exist in Google Cloud (§20.1 launch checklist).
// To try it locally, export both variables (or put them in supabase/.env) and flip enabled to true.
set("auth.external.google", "enabled", "false");
set("auth.external.google", "client_id", '"env(SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID)"');
set("auth.external.google", "secret", '"env(SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET)"');
set("auth.external.google", "skip_nonce_check", "false");

writeFileSync(FILE, `${lines.join("\n").replace(/\n+$/, "")}\n`);
console.log("patch-supabase-config: supabase/config.toml listo");
```

`scripts/write-env-local.mjs`

```js
// Writes .env.local from the running local Supabase stack (`pnpm db:start` first).
// Supabase values are refreshed on every run; every other key already present is kept,
// so VAPID keys and CRON_SECRET are generated once and never rotate under you. Safe to re-run.
import { execSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { generateVAPIDKeys } from "web-push";

const FILE = ".env.local";

const current = new Map();
if (existsSync(FILE)) {
  for (const line of readFileSync(FILE, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match) {
      current.set(match[1], match[2]);
    }
  }
}

const status = JSON.parse(
  execSync("pnpm exec supabase status -o json", {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  }),
);

function pick(...keys) {
  for (const key of keys) {
    if (typeof status[key] === "string" && status[key] !== "") {
      return status[key];
    }
  }
  console.error(`env:local — supabase status no devolvió ninguna de: ${keys.join(", ")}`);
  process.exit(1);
}

const fromSupabase = {
  NEXT_PUBLIC_SUPABASE_URL: pick("API_URL"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: pick("ANON_KEY", "PUBLISHABLE_KEY"),
  SUPABASE_SERVICE_ROLE_KEY: pick("SERVICE_ROLE_KEY", "SECRET_KEY"),
};

const vapid = current.get("VAPID_PRIVATE_KEY") ? null : generateVAPIDKeys();
const defaults = {
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: vapid?.publicKey,
  VAPID_PRIVATE_KEY: vapid?.privateKey,
  VAPID_SUBJECT: "mailto:hola@homeboard.test",
  CRON_SECRET: randomBytes(32).toString("hex"),
  NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
  NEXT_PUBLIC_SENTRY_DSN: "",
};

const next = new Map(current);
for (const [key, value] of Object.entries(fromSupabase)) {
  next.set(key, value);
}
for (const [key, value] of Object.entries(defaults)) {
  if (!next.get(key) && value !== undefined) {
    next.set(key, value);
  }
}

const body = [...next.entries()]
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([key, value]) => `${key}=${value}`)
  .join("\n");
writeFileSync(FILE, `# Generado por \`pnpm env:local\`. Nunca se commitea.\n${body}\n`);
console.log(`env:local — ${next.size} variables escritas en ${FILE}`);
```

`scripts/gen-types.mjs`

```js
// Regenerates src/lib/database.types.ts from the LOCAL database (supabase CLI v3 reads it by default).
// A script instead of a shell redirect so the same command works in Git Bash, PowerShell and CI.
import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const OUT = "src/lib/database.types.ts";
const types = execSync("pnpm exec supabase gen types --lang typescript --local", {
  encoding: "utf8",
  stdio: ["ignore", "pipe", "inherit"],
  maxBuffer: 20 * 1024 * 1024,
});

if (!types.includes("export type Database")) {
  console.error("db:types — la salida no contiene `export type Database`; ¿está corriendo `pnpm db:start`?");
  process.exit(1);
}

writeFileSync(OUT, types);
console.log(`db:types — ${OUT} actualizado`);
```

`scripts/generate-icons.mjs`

```js
// Generates HomeBoard's PWA icons as PNG files with no image library: a cream house on the primary orange.
// Deterministic — the same bytes on every run — so the committed PNGs never churn.
import { mkdirSync, writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

const PRIMARY = [0xc2, 0x41, 0x0c];
const CREAM = [0xff, 0xfb, 0xeb];

const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  CRC_TABLE[n] = c >>> 0;
}

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) {
    c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const typed = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typed));
  return Buffer.concat([length, typed, crc]);
}

// The house in a unit square: a roof triangle over a body with a door cut out.
function isHouse(u, v) {
  if (v >= 0.22 && v <= 0.5) {
    const half = ((v - 0.22) / 0.28) * 0.32;
    if (Math.abs(u - 0.5) <= half) {
      return true;
    }
  }
  if (v > 0.5 && v <= 0.78 && u >= 0.28 && u <= 0.72) {
    const door = u >= 0.44 && u <= 0.56 && v >= 0.6;
    return !door;
  }
  return false;
}

// scale < 1 shrinks the house toward the centre (maskable icons keep it inside the safe zone).
function png(size, scale) {
  const stride = size * 3 + 1;
  const raw = Buffer.alloc(stride * size);
  for (let y = 0; y < size; y++) {
    raw[y * stride] = 0;
    for (let x = 0; x < size; x++) {
      const u = 0.5 + ((x + 0.5) / size - 0.5) / scale;
      const v = 0.5 + ((y + 0.5) / size - 0.5) / scale;
      const [r, g, b] = isHouse(u, v) ? CREAM : PRIMARY;
      const offset = y * stride + 1 + x * 3;
      raw[offset] = r;
      raw[offset + 1] = g;
      raw[offset + 2] = b;
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 2;
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([
    signature,
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const ICONS = [
  { file: "public/icons/icon-192.png", size: 192, scale: 1 },
  { file: "public/icons/icon-512.png", size: 512, scale: 1 },
  { file: "public/icons/icon-maskable-512.png", size: 512, scale: 0.78 },
  { file: "public/icons/apple-touch-icon.png", size: 180, scale: 1 },
];

mkdirSync("public/icons", { recursive: true });
for (const icon of ICONS) {
  writeFileSync(icon.file, png(icon.size, icon.scale));
  console.log(`icons: ${icon.file} (${icon.size}x${icon.size})`);
}
```

`scripts/smoke.mjs`

```js
// Runs the production build produced by `pnpm build` and requests it — the entry point is RUN, not just built.
// Spawns the Next binary with the current Node directly (no shell).
// server.unref() lets this script's event loop exit naturally; process.exit() terminates the child on all OSes.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";

const PORT = 3101;
const BASE = `http://localhost:${PORT}`;
const CHECKS = [{ path: "/", status: 200, contains: "HomeBoard" }];

if (!existsSync(".next/BUILD_ID")) {
  console.error("smoke: no hay build de producción — ejecuta `pnpm build` primero");
  process.exit(2);
}

const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--port", String(PORT)], {
  // pipe instead of inherit: avoids a libuv UV_HANDLE_CLOSING assertion on Windows when this
  // process calls process.exit() while the child still holds the shared stdio handles.
  stdio: ["ignore", "pipe", "pipe"],
  env: process.env,
});
server.stdout?.pipe(process.stdout);
server.stderr?.pipe(process.stderr);
// unref() so this process's event loop is not kept alive by the child handle.
server.unref();

async function waitUntilUp(deadline) {
  while (Date.now() < deadline) {
    try {
      await fetch(`${BASE}/`, { redirect: "manual" });
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  throw new Error("smoke: el servidor no arrancó en 60 s");
}

let failed = false;
try {
  await waitUntilUp(Date.now() + 60_000);
  for (const check of CHECKS) {
    const response = await fetch(`${BASE}${check.path}`);
    const body = await response.text();
    const ok = response.status === check.status && body.includes(check.contains);
    console.log(`${ok ? "ok  " : "FAIL"} GET ${check.path} -> ${response.status} (final ${response.url})`);
    if (!ok) {
      failed = true;
    }
  }
} catch (error) {
  console.error(error);
  failed = true;
}

// Wait for the child to close before exiting; a 3 s fallback covers the Windows case where
// the close event never fires. Both paths exit with the correct code.
const exitCode = failed ? 1 : 0;
server.on("close", () => process.exit(exitCode));
setTimeout(() => process.exit(exitCode), 3000).unref();
server.kill();
```

---

## 20. Acceptance Gate, Risks & Decision Log

### 20.1 Global acceptance gate

The project is **done** when every command below exits 0 on a clean checkout (Docker running), and not
before. This is the same set CI runs.

```bash
pnpm install --frozen-lockfile   # expect: exit 0, lockfile unchanged
pnpm exec biome ci .             # expect: exit 0, zero errors (run from the root with blueprints/ present)
pnpm typecheck                   # expect: exit 0, zero errors
pnpm test                        # expect: exit 0, 0 failed, 0 skipped
pnpm db:start                    # expect: exit 0 (already running is fine)
pnpm db:reset                    # expect: exit 0
pnpm env:local                   # expect: exit 0
pnpm db:test                     # expect: exit 0, every pgTAP assertion ok
pnpm test:e2e                    # expect: exit 0, 0 failed
pnpm build                       # expect: exit 0
pnpm smoke                       # expect: exit 0 — the built server answers 200 with "HomeBoard"
```

Every expectation is a property, not a tally; every line exits 0 on a correct build; no line passes on an
arbitrary non-zero exit.

Plus these manual gates — the post-build launch checklist — each checked once before launch:

- [ ] Every step in §9 has its checkpoint tag: `git tag -l 'step-*'` lists `step-01-scaffold` … `step-14-deploy`, one per step. The repository was created by §10 Bootstrap.
- [ ] Every file §10's *Files that must be committed* table names is tracked — one path per invocation, e.g. `git ls-files --error-unmatch .env.example`, `git ls-files --error-unmatch .workspace-applied`, `git ls-files --error-unmatch src/lib/database.types.ts`, `git ls-files --error-unmatch supabase/config.toml`, `git ls-files --error-unmatch public/icons/icon-192.png` — and not ignored: `status=0; git check-ignore -q --no-index .env.example || status=$?; test "$status" -eq 1` (one path per line; 1 = not ignored, 128 = usage error; `--no-index` tests the ignore rules against untracked paths without consulting the index — required because tracked files always report as not-ignored without it).
- [ ] The ignore file was in place before the first commit: `test "$(git log --diff-filter=A --format=%H -- .gitignore | tail -n 1)" = "$(git rev-list --max-parents=0 HEAD)"` exits 0.
- [ ] Every row of §19.6's *Byte-exact artifact reconciliation* table was executed on the pinned runtime (the gates of steps 2, 5, 6 and 7 passing is that execution).
- [ ] §10's Bootstrap block was re-run once on the bootstrapped tree, **exited 0**, and `pnpm lint` still finds its binary afterwards (the manifest kept every dependency). _(Human-verified — Bootstrap commands such as `pnpm create`, `pnpm add`, `cp`, `git init`, `docker info` are intentionally excluded from `.claude/settings.json` as one-time developer setup steps; this gate is not automated.)_
- [ ] Every row of §19.6's *Cross-artifact value reconciliation* reads `Compared: yes`, and `pnpm exec biome ci .` / `pnpm typecheck` were run from the project root with `blueprints/homeboard/` present.
- [ ] Every non-goal in §1 is still un-built.
- [ ] **Supabase cloud:** create the project (Free) → `pnpm exec supabase link --project-ref <ref>` → `pnpm exec supabase db push` (applies `init_schema`; seed is local only).
- [ ] **Supabase dashboard → Authentication:** disable "Confirm email"; Site URL = the Vercel production URL; Redirect URLs include `https://<app>.vercel.app/auth/callback` (and the preview pattern if wanted).
- [ ] **Google Cloud:** create an OAuth client (Web), authorized redirect URI `https://<ref>.supabase.co/auth/v1/callback`; paste client id/secret into Supabase → Authentication → Providers → Google and enable it.
- [ ] **Vercel:** import the repo, Node.js 24.x (26 if offered), env vars `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `CRON_SECRET`, `NEXT_PUBLIC_SITE_URL` (+ optional `NEXT_PUBLIC_SENTRY_DSN`); none of them in the repo.
- [ ] **Cron:** Vercel → Cron Jobs shows `/api/health` daily; trigger it once and see 200 in the logs.
- [ ] **CI:** push to GitHub; the `CI` workflow runs green (this also confirms GitHub accepts the JSON-syntax YAML and the `v4` action tags).
- [ ] **iPhone:** open the production URL in Safari → Compartir → "Añadir a pantalla de inicio" → launch from the icon (standalone, no Safari chrome, safe areas respected) → sign in with **Google** from the installed app (risk 1) → if Google fails, email + password works → `Ajustes` → `Activar notificaciones` → allow → from the second phone add "Leche" → the first phone receives "… añadió Leche" while HomeBoard is closed.
- [ ] Two phones on `/compras`: an item added on one appears on the other in under 5 s.
- [ ] Keyboard-only pass of sign-in → add → check → delete on desktop; one VoiceOver pass on iPhone over `/compras`; 200% zoom at 375px (§15).
- [ ] If a Sentry DSN is set: a deliberately thrown error appears in Sentry (§16).
- [ ] A rollback was performed once on purpose in Vercel (Promote a previous deployment) (§12).

**No warnings are ignored.**

### 20.2 Risk register

| Risk | Likelihood | Impact | Early signal | Mitigation |
|---|---|---|---|---|
| Google OAuth round trip from an **installed** iOS PWA leaves the standalone context or loses the PKCE cookie | M | M | after Google, the user lands in Safari instead of the app, or `/entrar?error=oauth` | email + password works everywhere (step 6); launch-checklist test; decision log #10 |
| Supabase Free pauses the project after ~1 week of low activity | H without mitigation | H | dashboard shows "paused"; app errors on every page | daily Vercel Cron → `/api/health` with a real query (step 14); §16 alert on non-200 |
| Push only works after install + user tap on iOS ≥ 16.4 | H | M | no subscriptions rows for iPhone users | `pushSupportState` shows the install hint, button only when `disponible` (step 13); checklist test |
| Docker required locally for `supabase start` (machine has none today) | H | H | `pnpm db:start` fails at step 4 | §10 prerequisite; steps 1–3 need no Docker so work can start while it installs |
| Realtime DELETE events bypass RLS | — (designed out) | H | — | soft delete only; no DELETE policy on `shopping_items` |
| web-push 4 ESM/types mismatch | M | L | `tsc` errors on `web-push` imports | hand-written `src/types/web-push.d.ts`; `@types/web-push` banned |
| Biome 2.6.8 behaves differently from the 2.5.15 the workarounds were measured on (`domains`, `tailwindDirectives`, folder ignore syntax) | M | M | `pnpm lint` fails at step 1 on config, not code | step 1's lint gate catches it on the first command; fix `biome.json` only |
| Vercel Node 26 unsupported | M | L | deploy build fails on runtime selection | `engines >=24`; set 24.x in Vercel |
| `create-next-app` 16.4.6 flags `--no-agents-md` / `--no-agent-feedback` not recognised | L | M | Bootstrap step 1 exits with "unknown option" | drop the two flags; the workspace copy overwrites `AGENTS.md`/`CLAUDE.md` anyway |

### 20.3 Decision log

| # | Decision | Rejected alternative | Why | Would reverse if |
|---|---|---|---|---|
| 1 | Next.js 16 App Router on Vercel | Vite SPA + separate API | Server Actions authorize mutations with the service role server-side; cron and route handlers in one deploy | a static host became mandatory or Vercel Hobby limits were hit |
| 2 | Supabase (Postgres + Auth + Realtime + RLS) | Firebase | relational data, RLS on `auth.uid()`, realtime and auth in one free service | Supabase Free removed realtime or the pause policy became unmanageable |
| 3 | Vercel Hobby | Hostinger | native Next 16 support, Cron, zero cost, instant rollback | the project became commercial (Hobby is non-commercial) |
| 4 | No ORM — SQL migrations + generated types | Drizzle / Prisma | one schema owner; RLS and SQL functions are SQL anyway | the schema grew past ~15 tables with complex query composition |
| 5 | Soft delete on `shopping_items` | hard DELETE | Realtime does not apply RLS to DELETE events; soft delete also enables "Deshacer" | Supabase Realtime filtered DELETE events by RLS |
| 6 | One household per user (`UNIQUE(user_id)`) | many-to-many with a household switcher | simpler proxy, RLS and UI for a 2-person home | a user needs two homes |
| 7 | Micro-app registry in code | `micro_apps` table | it changes with code deploys anyway; no admin UI | households should enable/disable apps themselves |
| 8 | Hand-written `public/sw.js` | Serwist / Workbox | two responsibilities (offline page, push); no build plugin | offline writes or asset precaching became a goal |
| 9 | `cacheComponents: false` | keep the scaffold's `true` | every page reads the session cookie; Cache Components would force `<Suspense>` around each read | static shells with streamed personal data became valuable |
| 10 | Email + password alongside Google | Google only | the Google round trip from an installed iOS PWA is unverified | the launch-checklist iPhone test passes repeatedly and email is never used |
| 11 | Web Push (VAPID) | email notifications | instant, free, reaches the lock screen | iOS PWA push proves unreliable in daily use |
| 12 | Local `web-push.d.ts` | `@types/web-push` | types target 3.x default export; 4.0.0 has named ESM exports only | DefinitelyTyped ships 4.x types |
| 13 | Extensionless `@/` imports (bundler resolution) | the track's `.ts` specifiers + `allowImportingTsExtensions` | no plain-Node script imports TS source; Next's scaffold convention, one less flag | a script ever needs to import `src/` |
| 14 | `setVapidDetails` once, lazily | at module scope | module scope throws in builds/tests without VAPID keys, breaking earlier gates | VAPID keys became mandatory in every environment |
| 15 | Sentry runtime init without `withSentryConfig` | wrapped config with source maps | no auth token, no build-time network, zero cost | readable stack traces in Sentry became necessary |
| 16 | CI workflow written in JSON syntax | conventional YAML | a unit test can parse and assert it with no YAML dependency | a YAML parser is added to devDependencies for another reason |
| 17 | Workspace copy gated on a committed marker | `rsync --ignore-existing` / `cp -Rn` | Git for Windows has no rsync; `cp -Rn` exits 1 on macOS when skipping | rsync became available on every target machine |
| 18 | `--success` `#047857` | brief's `#059669` | `#059669` measured 3.8:1 with white text (fails AA); `#047857` is 5.5:1 | success is only ever used for icons/large text |
| 19 | Push split into steps 12 (server) and 13 (client); Sentry in 14 | one push step | the 5-files-per-step ceiling | — (structural) |
| 20 | Server-validated forms with redirect-carried error codes | client `useActionState` forms | pages work without JS and errors are announced via `role="alert"` | field-preserving inline validation becomes a UX priority |

### 20.4 What to build next

1. **Tareas del hogar** (micro app #2) — when the shopping list is used daily for 4 weeks (§1 Non-Goals).
2. **Password reset flow** in-app — when either user forgets a password once.
3. **Leave household / regenerate invite code** — when a household changes members.
4. **Content-Security-Policy with a nonce** for the SW registration script — before opening HomeBoard to other households.
5. **Gastos compartidos** (micro app #3) — after Tareas, if requested.

---

*End of blueprint. Build order is §9. Stop when §20.1 is green.*
