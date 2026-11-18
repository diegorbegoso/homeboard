# Epic 02: Hogar y compras

> After this epic two people share a household, see the micro-app home, manage a shopping list that syncs live between their phones, receive push notifications, and the app is ready to deploy with a keep-alive cron and CI.

| | |
|---|---|
| **Epic id** | `02-hogar-y-compras` |
| **Tasks** | `E2-T1` … `E2-T7` |
| **Depends on** | `01-cimientos` (`E1-T3`, `E1-T5`, `E1-T6`) |
| **Unlocks** | nothing — this is the last epic |
| **Parallel with** | none |

You do not need any other file to complete this epic. Everything below is repeated here on purpose. Where a
task's direction says "§N" it refers to a section of `blueprint.md` whose needed content is copied into
*Reference copies* at the end of this file.

---

## Stack

Next.js 16 App Router (Turbopack) · TypeScript 6 · Tailwind CSS 4 (`@theme`) · Supabase Postgres + RLS +
Realtime · no ORM (generated types) · Supabase Auth via `@supabase/ssr` · web-push (VAPID) · Sentry
(optional) · Vercel Hobby. Package manager: `pnpm` (`pnpm@12.21.0`). Runtime in `.nvmrc` (`26`).
Dependency versions are in `pnpm-lock.yaml` — read it, never guess one.

| Task | Command |
|---|---|
| Dev | `pnpm dev` |
| Typecheck | `pnpm typecheck` |
| Lint | `pnpm lint` |
| Test (one file) | `pnpm test tests/unit/<file>.test.ts` |
| E2E (one file) | `pnpm test:e2e tests/e2e/<file>.spec.ts` |
| Build / run it | `pnpm build` · `pnpm smoke` |
| Local Supabase | `pnpm db:start` / `pnpm db:stop` (Docker Desktop running) |
| Reset / test / types | `pnpm db:reset` · `pnpm db:test` · `pnpm db:types` |

**Gate:** `pnpm lint && pnpm typecheck && pnpm test` passes before any task here is marked done.

Every E2E task starts the local stack with `pnpm db:start` and resets it with `pnpm db:reset` (both are the
first lines of its Verify). `.env.local` was written by `pnpm env:local` in `E1-T4`; re-run it if missing.
Never substitute a fake for Supabase in an E2E test.

## Directory subtree

```
src/
  proxy.ts                               # NEW (E2-T1)
  instrumentation.ts                     # NEW (E2-T7)
  instrumentation-client.ts              # NEW (E2-T7)
  app/
    bienvenida/page.tsx                  # NEW (E2-T1)
    global-error.tsx                     # NEW (E2-T4)
    api/health/route.ts                  # NEW (E2-T7)
    (app)/page.tsx                       # edited (E2-T2)
    (app)/ajustes/page.tsx               # NEW (E2-T1), edited (E2-T6)
    (app)/compras/page.tsx               # NEW (E2-T3)
    (app)/compras/actions.ts             # NEW (E2-T3), edited (E2-T5)
    (app)/compras/shopping-list.tsx      # NEW (E2-T3), edited (E2-T4)
    (app)/compras/use-realtime-items.ts  # NEW (E2-T4)
    (auth)/actions.ts                    # exists — read-only (signOut)
  components/
    micro-app-tile.tsx                   # NEW (E2-T2)
    push-toggle.tsx                      # NEW (E2-T6)
    tab-bar.tsx                          # exists — read-only
  micro-apps/registry.ts                 # NEW (E2-T2)
  lib/
    shopping/schema.ts                   # NEW (E2-T3)
    supabase/client.ts                   # NEW (E2-T4)
    supabase/admin.ts                    # NEW (E2-T5)
    log.ts                               # NEW (E2-T5)
    push/send.ts                         # NEW (E2-T5)
    push/actions.ts                      # NEW (E2-T6)
    push/support.ts                      # NEW (E2-T6)
    env.ts, supabase/server.ts, database.types.ts   # exist — read-only
  types/web-push.d.ts                    # exists (workspace) — read-only
public/sw.js                             # exists — read-only (push handlers shipped in E1-T3)
tests/
  e2e/household.spec.ts                  # NEW (E2-T1)
  e2e/shell.spec.ts                      # edited (E2-T1) — sign in first
  e2e/home.spec.ts                       # NEW (E2-T2)
  e2e/compras.spec.ts                    # NEW (E2-T3)
  e2e/realtime.spec.ts                   # NEW (E2-T4)
  unit/registry.test.ts                  # NEW (E2-T2)
  unit/push-send.test.ts                 # NEW (E2-T5)
  unit/push-support.test.ts              # NEW (E2-T6)
  unit/observability.test.ts             # NEW (E2-T7)
  unit/deploy.test.ts                    # NEW (E2-T7)
vercel.json, .github/workflows/ci.yml    # exist (workspace) — read-only
```

Everything outside this subtree is out of scope. If a task seems to require editing a file not listed here,
stop and report — it means the epic boundary is wrong.

## Data model touched here

| Entity | Fields this epic adds or reads | Notes |
|---|---|---|
| `household_members` | reads `household_id`, `user_id`, `role` | one row per user (UNIQUE `user_id`) |
| `households` | reads `name`, `invite_code` | created only via RPC `create_household` |
| `profiles` | reads `display_name` | members of the same household see each other |
| `shopping_items` | all | soft delete only; Realtime publication |
| `push_subscriptions` | all | upsert on `endpoint`; deleted on push 404/410 by the service role |

No schema change in this epic. A schema change here means the epic boundary is wrong — stop and report.

## Contracts

**Consumed** — already exists, do not rebuild:

| From | Interface | Guarantee |
|---|---|---|
| `01-cimientos` | `createClient()` in `src/lib/supabase/server.ts` | cookie-bound server client typed with `Database` |
| `01-cimientos` | `getPublicEnv()`, `requireServerEnv(key)` in `src/lib/env.ts` | lazy parse; throws only when called without the value |
| `01-cimientos` | `signOut()` in `src/app/(auth)/actions.ts` | signs out and redirects to `/entrar` |
| `01-cimientos` | RPC `create_household(p_name)`, `join_household(p_code)` | raise `P0001` with the codes in *Reference copies* |
| `01-cimientos` | `public/sw.js` `push` / `notificationclick` handlers | shows `{ title, body, url, tag }`; click opens `url` |
| workspace | `tests/e2e/helpers.ts` | `signIn`, `registerUser`, `createHousehold`, `readInviteCode`, `joinHousehold`, `newIsolatedPage`, `newMemberWithHousehold`, `SEED_USERS`, `SEED_PASSWORD` |

**Produced:**

| Export | Signature | Used by |
|---|---|---|
| `src/micro-apps/registry.ts` → `MICRO_APPS`, `enabledMicroApps`, `ICONOS` | see *Reference copies* | future micro apps |
| `src/lib/push/send.ts` → `sendPushToHousehold` | `(householdId: string, exceptUserId: string, payload: PushPayload) => Promise<{ sent: number; removed: number }>` | compras actions, future micro apps |
| `src/lib/push/send.ts` → `buildItemPush` | `(kind: "added" \| "done", actorName: string, itemName: string) => PushPayload` | compras actions |
| `src/lib/log.ts` → `log` | `{ info, warn, error }(event: string, context?: Record<string, unknown>) => void` | everything server-side |
| `GET /api/health` | 401 / 503 / 200 JSON | Vercel Cron |

## Conventions that bite in this area

- Authorize inside every Server Action (`getUser()`); `src/proxy.ts` only routes.
- The household id always comes from the caller's `household_members` row, never from the client.
- Never hard-DELETE `shopping_items` — Realtime would leak the event across households; set `deleted_at`.
- `src/lib/supabase/admin.ts` is imported only by `src/lib/push/send.ts` and `src/app/api/health/route.ts`.
- Push is fire-and-forget after the write; a push failure never fails the action.
- `browser.newContext()` does not inherit `baseURL`; use `newIsolatedPage(browser)` for a second user.
- `Notification.requestPermission()` only inside the button's click handler (iOS rejects anything else).
- Vercel Cron calls `GET`; the health route exports `GET` only.

Full project rules: `CLAUDE.md`. Area rules: `.claude/rules/server-actions.md`, `.claude/rules/ui.md`,
`.claude/rules/pwa.md`, `.claude/rules/tests.md`, `.claude/rules/database.md`.

---

## Tasks

Listed in the same order as `tasks.json`. That order is the build order.

### `E2-T1` — Households: create, join by code, settings

**Depends on:** `E1-T3`, `E1-T5`, `E1-T6` · **Priority:** p0 — metadata for scope cuts, not a running order

Step 8 of the build order. Implementation direction:

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

**Files**
- `src/proxy.ts`
- `src/app/bienvenida/page.tsx`
- `src/app/(app)/ajustes/page.tsx`
- `tests/e2e/household.spec.ts`
- `tests/e2e/shell.spec.ts`

**Acceptance**

Copied from this task's `acceptance` array in `tasks.json` — identical after the emphasis normalization defined in `agents/blueprint-writer.md` *Acceptance strings*. Each one is decidable by a command below, on this machine, during the build.

1. **WHEN** an anonymous request hits `/`, `/compras` or `/ajustes` **THE SYSTEM SHALL** redirect to `/entrar`, while `/manifest.webmanifest`, `/sw.js`, `/offline` and `/icons/icon-192.png` still return 200 without a session.
2. **WHEN** a signed-in user without a household requests `/` **THE SYSTEM SHALL** redirect to `/bienvenida`.
3. **WHEN** that user submits `Crear hogar` with `Nombre del hogar` filled **THE SYSTEM SHALL** create the household with them as `owner`, land on `/`, and show an 8-character invite code in `[data-testid="codigo-invitacion"]` on `/ajustes`.
4. **WHEN** a second new user submits that code in `Código de invitación` on `/bienvenida` **THE SYSTEM SHALL** land on `/`, and `/ajustes` SHALL list both members' names.
5. **WHEN** `Unirme` is submitted with `ZZZZZZZZ` **THE SYSTEM SHALL** stay on `/bienvenida` and show `Ese código no existe` in an element with `role="alert"`.
6. **WHEN** `Cerrar sesión` is pressed on `/ajustes` **THE SYSTEM SHALL** clear the `sb-` session cookie and land on `/entrar`.

**Verify** — every command, in order, run from the project root. Each one exits 0 when this task is correct; the last one exiting 0 is what makes the task done.

```bash
pnpm db:start                                                                                                    # expect: exit 0
pnpm db:reset                                                                                                    # expect: exit 0
pnpm lint                                                                                                        # expect: exit 0
pnpm typecheck                                                                                                   # expect: exit 0
pnpm test:e2e tests/e2e/household.spec.ts tests/e2e/shell.spec.ts tests/e2e/pwa.spec.ts tests/e2e/auth.spec.ts   # expect: exit 0
```

**Checkpoint**

```bash
git add -A && git commit -m "E2-T1: Households: create, join by code, settings"
git tag step-08-household
```

Run both after the last `Verify` command exits 0, before starting the next task. The tag is this task's rollback target and the thing the build's final gate counts.

### `E2-T2` — Micro-app registry and Inicio tiles

**Depends on:** `E2-T1` · **Priority:** p1 — metadata for scope cuts, not a running order

Step 9 of the build order. Implementation direction:

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

**Files**
- `src/micro-apps/registry.ts`
- `src/app/(app)/page.tsx`
- `src/components/micro-app-tile.tsx`
- `tests/unit/registry.test.ts`
- `tests/e2e/home.spec.ts`

**Acceptance**

Copied from this task's `acceptance` array in `tasks.json` — identical after the emphasis normalization defined in `agents/blueprint-writer.md` *Acceptance strings*. Each one is decidable by a command below, on this machine, during the build.

1. **WHEN** `tests/unit/registry.test.ts` runs **THE SYSTEM SHALL** assert every registry entry has a unique `id`, a `ruta` starting with `/`, a non-empty `nombre` and `descripcion`, and an `icono` from the allowed icon names.
2. **WHEN** `tests/unit/registry.test.ts` runs **THE SYSTEM SHALL** assert that the only enabled entry is `lista-compras` and that it points to `/compras`.
3. **WHEN** seed user `ana@homeboard.test` opens `/` **THE SYSTEM SHALL** show the heading `Hola, Ana`, the household name `Casa de Ana`, and a `Lista de compras` tile linking to `/compras`.
4. **WHEN** `/` renders at 375px wide **THE SYSTEM SHALL** keep every tile link at least 44px tall.

**Verify** — every command, in order, run from the project root. Each one exits 0 when this task is correct; the last one exiting 0 is what makes the task done.

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
git add -A && git commit -m "E2-T2: Micro-app registry and Inicio tiles"
git tag step-09-home
```

Run both after the last `Verify` command exits 0, before starting the next task. The tag is this task's rollback target and the thing the build's final gate counts.

### `E2-T3` — Shopping list CRUD with optimistic UI and undo

**Depends on:** `E2-T2` · **Priority:** p0 — metadata for scope cuts, not a running order

Step 10 of the build order. Implementation direction:

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

**Files**
- `src/app/(app)/compras/page.tsx`
- `src/app/(app)/compras/actions.ts`
- `src/app/(app)/compras/shopping-list.tsx`
- `src/lib/shopping/schema.ts`
- `tests/e2e/compras.spec.ts`

**Acceptance**

Copied from this task's `acceptance` array in `tasks.json` — identical after the emphasis normalization defined in `agents/blueprint-writer.md` *Acceptance strings*. Each one is decidable by a command below, on this machine, during the build.

1. **WHEN** a household member adds `Leche` with quantity `2 L` on `/compras` **THE SYSTEM SHALL** show it in the pending list, and it SHALL still be there after a page reload.
2. **WHEN** the member edits that item's name to `Leche de avena` **THE SYSTEM SHALL** show the new name after a reload.
3. **WHEN** the member marks it as bought **THE SYSTEM SHALL** show it under `Comprado` with its checkbox checked, still checked after a reload, and unchecking SHALL return it to the pending list.
4. **WHEN** the member deletes it **THE SYSTEM SHALL** remove it and show a toast with a `Deshacer` button; pressing `Deshacer` SHALL restore it, and after a second delete and a reload it SHALL stay gone.
5. **WHEN** an empty name is submitted **THE SYSTEM SHALL** create no item and show `Escribe qué hay que comprar` in an element with `role="alert"`.
6. **WHEN** the household has no items **THE SYSTEM SHALL** show the empty state `Nada por comprar. ¡Qué paz!`.

**Verify** — every command, in order, run from the project root. Each one exits 0 when this task is correct; the last one exiting 0 is what makes the task done.

```bash
pnpm db:start                             # expect: exit 0
pnpm db:reset                             # expect: exit 0
pnpm lint                                 # expect: exit 0
pnpm typecheck                            # expect: exit 0
pnpm test:e2e tests/e2e/compras.spec.ts   # expect: exit 0
```

**Checkpoint**

```bash
git add -A && git commit -m "E2-T3: Shopping list CRUD with optimistic UI and undo"
git tag step-10-shopping
```

Run both after the last `Verify` command exits 0, before starting the next task. The tag is this task's rollback target and the thing the build's final gate counts.

### `E2-T4` — Realtime sync of the shopping list

**Depends on:** `E2-T3` · **Priority:** p0 — metadata for scope cuts, not a running order

Step 11 of the build order. Implementation direction:

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

**Files**
- `src/lib/supabase/client.ts`
- `src/app/(app)/compras/use-realtime-items.ts`
- `src/app/(app)/compras/shopping-list.tsx`
- `src/app/global-error.tsx`
- `tests/e2e/realtime.spec.ts`

**Acceptance**

Copied from this task's `acceptance` array in `tasks.json` — identical after the emphasis normalization defined in `agents/blueprint-writer.md` *Acceptance strings*. Each one is decidable by a command below, on this machine, during the build.

1. **WHEN** member A adds `Tomates` while member B of the same household has `/compras` open in a separate browser context **THE SYSTEM SHALL** show `Tomates` in B's list within 5000 ms without a reload.
2. **WHEN** A marks `Tomates` as bought **THE SYSTEM SHALL** show it checked in B's list within 5000 ms without a reload.
3. **WHEN** A deletes `Tomates` **THE SYSTEM SHALL** remove it from B's list within 5000 ms without a reload.
4. **WHEN** a user of a different household has `/compras` open while A adds an item **THE SYSTEM SHALL** not show that item in that user's list after 5000 ms.

**Verify** — every command, in order, run from the project root. Each one exits 0 when this task is correct; the last one exiting 0 is what makes the task done.

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
git add -A && git commit -m "E2-T4: Realtime sync of the shopping list"
git tag step-11-realtime
```

Run both after the last `Verify` command exits 0, before starting the next task. The tag is this task's rollback target and the thing the build's final gate counts.

### `E2-T5` — Push sender, logger and item triggers

**Depends on:** `E2-T3` · **Priority:** p1 — metadata for scope cuts, not a running order

Step 12 of the build order. Implementation direction:

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

**Files**
- `src/lib/supabase/admin.ts`
- `src/lib/log.ts`
- `src/lib/push/send.ts`
- `src/app/(app)/compras/actions.ts`
- `tests/unit/push-send.test.ts`

**Acceptance**

Copied from this task's `acceptance` array in `tasks.json` — identical after the emphasis normalization defined in `agents/blueprint-writer.md` *Acceptance strings*. Each one is decidable by a command below, on this machine, during the build.

1. **WHEN** `sendPushToHousehold` runs for a household with one subscription of the actor and two of other members, with `web-push` mocked, **THE SYSTEM SHALL** call `sendNotification` exactly twice, never for the actor, with a JSON payload carrying `title`, `body`, `url` and `tag`.
2. **WHEN** the mocked `sendNotification` rejects with a `WebPushError` of status 410 or 404 **THE SYSTEM SHALL** delete that subscription row and report it in `removed`.
3. **WHEN** any of `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` or `VAPID_SUBJECT` is unset **THE SYSTEM SHALL** return `{ sent: 0, removed: 0 }` without calling `sendNotification` and without throwing.
4. **WHEN** `buildItemPush` runs for actor `Ana` and item `Leche` **THE SYSTEM SHALL** return the body `Ana añadió Leche` for `added` and `Ana compró Leche` for `done`, both with `url` `/compras`.
5. **WHEN** `tests/e2e/compras.spec.ts` runs with VAPID keys present and no subscriptions stored **THE SYSTEM SHALL** pass every assertion.

**Verify** — every command, in order, run from the project root. Each one exits 0 when this task is correct; the last one exiting 0 is what makes the task done.

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
git add -A && git commit -m "E2-T5: Push sender, logger and item triggers"
git tag step-12-push-server
```

Run both after the last `Verify` command exits 0, before starting the next task. The tag is this task's rollback target and the thing the build's final gate counts.

### `E2-T6` — Enable-notifications button and subscription save

**Depends on:** `E2-T1`, `E2-T5` · **Priority:** p1 — metadata for scope cuts, not a running order

Step 13 of the build order. Implementation direction:

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

**Files**
- `src/lib/push/actions.ts`
- `src/lib/push/support.ts`
- `src/components/push-toggle.tsx`
- `src/app/(app)/ajustes/page.tsx`
- `tests/unit/push-support.test.ts`

**Acceptance**

Copied from this task's `acceptance` array in `tasks.json` — identical after the emphasis normalization defined in `agents/blueprint-writer.md` *Acceptance strings*. Each one is decidable by a command below, on this machine, during the build.

1. **WHEN** `pushSupportState` receives an iPhone user agent with `isStandalone` false **THE SYSTEM SHALL** return `instalar`.
2. **WHEN** `pushSupportState` receives an iPhone user agent with `isStandalone` true and `hasPushManager` true **THE SYSTEM SHALL** return `disponible`.
3. **WHEN** `pushSupportState` receives a non-iOS user agent **THE SYSTEM SHALL** return `disponible` if `hasPushManager` is true and `no-soportado` if it is false.
4. **WHEN** `subscriptionSchema` parses a payload missing `keys.p256dh` or with a non-https `endpoint` **THE SYSTEM SHALL** reject it, and SHALL accept a payload with an https `endpoint` and both keys.
5. **WHEN** a unit test calls `saveSubscription` with a malformed payload (mocking `@/lib/supabase/server`) **THE SYSTEM SHALL** return `{ ok: false, error: "suscripcion_invalida" }`, and **WHEN** called with a valid payload **THE SYSTEM SHALL** upsert with `onConflict: "endpoint"` and return `{ ok: true, data: null }`.

**Verify** — every command, in order, run from the project root. Each one exits 0 when this task is correct; the last one exiting 0 is what makes the task done.

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
git add -A && git commit -m "E2-T6: Enable-notifications button and subscription save"
git tag step-13-push-client
```

Run both after the last `Verify` command exits 0, before starting the next task. The tag is this task's rollback target and the thing the build's final gate counts.

### `E2-T7` — Sentry, health keep-alive and deploy config

**Depends on:** `E2-T5` · **Priority:** p1 — metadata for scope cuts, not a running order

Step 14 of the build order. Implementation direction:

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

**Files**
- `src/instrumentation.ts`
- `src/instrumentation-client.ts`
- `src/app/api/health/route.ts`
- `tests/unit/deploy.test.ts`
- `tests/e2e/health.spec.ts`

**Acceptance**

Copied from this task's `acceptance` array in `tasks.json` — identical after the emphasis normalization defined in `agents/blueprint-writer.md` *Acceptance strings*. Each one is decidable by a command below, on this machine, during the build.

1. **WHEN** `GET /api/health` is called without an `Authorization` header or with a wrong bearer **THE SYSTEM SHALL** return 401 `{ "ok": false, "error": "unauthorized" }`, and with `Authorization: Bearer <CRON_SECRET>` and a working database **THE SYSTEM SHALL** return 200 `{ "ok": true }`.
2. **WHEN** the health check's database query errors **THE SYSTEM SHALL** return 503 `{ "ok": false, "error": "db" }`.
3. **WHEN** `tests/unit/deploy.test.ts` reads `vercel.json` **THE SYSTEM SHALL** find exactly one cron with `path` `/api/health` and a daily `schedule`, and `src/app/api/health/route.ts` SHALL export `GET`.
4. **WHEN** `tests/unit/deploy.test.ts` parses `.github/workflows/ci.yml` **THE SYSTEM SHALL** find, in this order, steps running `pnpm install --frozen-lockfile`, `pnpm exec biome ci .`, `pnpm typecheck`, `pnpm test`, `pnpm db:test`, `pnpm test:e2e` and `pnpm build`, and every `pnpm <script>` it runs SHALL exist in `package.json`.
5. **WHEN** `register()` from `src/instrumentation.ts` runs with `NEXT_PUBLIC_SENTRY_DSN` unset **THE SYSTEM SHALL** not call `Sentry.init`, and with it set **THE SYSTEM SHALL** call it exactly once.
6. **WHEN** `log.error` is called with `{ email, token, code }` **THE SYSTEM SHALL** write one JSON line with `level` `error`, the event name, `code` unchanged and `email` and `token` as `[redacted]`.
7. **WHEN** `GET /api/health` is called without `Authorization` through the running server **THE SYSTEM SHALL** return 401 `{ ok: false, error: "unauthorized" }`; **WHEN** called with `Authorization: Bearer ${CRON_SECRET}` **THE SYSTEM SHALL** return 200 `{ ok: true }`.

**Verify** — every command, in order, run from the project root. Each one exits 0 when this task is correct; the last one exiting 0 is what makes the task done.

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
git add -A && git commit -m "E2-T7: Sentry, health keep-alive and deploy config"
git tag step-14-deploy
```

Run both after the last `Verify` command exits 0, before starting the next task. The tag is this task's rollback target and the thing the build's final gate counts.

---

## Epic acceptance

The epic is done when every task is `done` **and**:

1. **WHEN** the full gate below runs from the project root with `blueprints/homeboard/` present **THE SYSTEM SHALL** exit 0 on every command.
2. **WHEN** `pnpm smoke` runs against the final build **THE SYSTEM SHALL** receive 200 for `/` (redirected to `/entrar`) with a body containing `HomeBoard`.

```bash
pnpm lint && pnpm typecheck && pnpm test
pnpm db:start && pnpm db:reset && pnpm db:test && pnpm test:e2e && pnpm build && pnpm smoke
```

## Pitfalls

- **Proxy matcher too broad** — if `/sw.js`, `/manifest.webmanifest`, `/icons/*` or `/offline` redirect to `/entrar`, the PWA breaks; `E2-T1` re-runs `pwa.spec.ts` to catch it.
- **Realtime without auth** — call `supabase.realtime.setAuth()` before `subscribe`, or RLS filters every event out and B never sees A's item.
- **Duplicate items after optimistic add** — the client generates the `id`; reconcile by `id`, never append blindly.
- **`setVapidDetails` at module scope** — breaks every build without VAPID keys; keep it lazy as written.
- **Test order** — mutating tests create their own household; never reuse seed households for writes.

## Before moving on

- [ ] Every task in this epic is `done` in `tasks.json` — no task left `in_progress`.
- [ ] Every `verify` command of every task in this epic passed, not just the first one.
- [ ] No `verify` command was edited, and none was skipped because a file it names did not exist.
- [ ] **Every task in this epic has its `checkpoint` tag in version control** — `git tag -l 'step-*'` lists `step-08-household` … `step-14-deploy`.
- [ ] Gate command passes clean, run from the project root.
- [ ] Every "Produced" contract above exists with the stated signature.
- [ ] No file outside the subtree was modified.
- [ ] `.env.example` already lists every variable this epic uses (no new variable here).
- [ ] One commit per task, each prefixed with its task id, each followed by its checkpoint tag.

---

## Reference copies

### §6 UI contract — labels and test ids

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

### §6 Micro-app registry

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

### §5 Error codes

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

### §5 Critical endpoints

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

### §4 Schema — the `init_schema` migration (read-only in this epic)

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
