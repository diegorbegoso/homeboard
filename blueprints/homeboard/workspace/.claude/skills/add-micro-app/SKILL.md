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
