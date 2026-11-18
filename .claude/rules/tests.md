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
