import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { getPublicEnv, requireServerEnv } from "@/lib/env";

/** Service-role client. Bypasses RLS — import only from src/lib/push/send.ts and src/app/api/health/route.ts. */
export function createAdminClient() {
  return createClient<Database>(
    getPublicEnv().NEXT_PUBLIC_SUPABASE_URL,
    requireServerEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}
