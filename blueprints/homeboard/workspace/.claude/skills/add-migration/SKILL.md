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
