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
