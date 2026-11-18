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
