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
