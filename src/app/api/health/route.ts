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
