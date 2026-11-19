"use server";

import { listHouseholds } from "@/lib/household";
import { subscriptionSchema } from "@/lib/push/support";
import { createClient } from "@/lib/supabase/server";

type ActionResult<T = null> = { ok: true; data: T } | { ok: false; error: string };

export async function saveSubscription(input: unknown): Promise<ActionResult<null>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "no_autenticado" };

  const households = await listHouseholds(supabase, user.id);
  if (households.length === 0) return { ok: false, error: "sin_hogar" };

  const parsed = subscriptionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "suscripcion_invalida" };

  // One row per household so a device is notified for every household the user belongs to.
  const { error } = await supabase.from("push_subscriptions").upsert(
    households.map((household) => ({
      user_id: user.id,
      household_id: household.id,
      endpoint: parsed.data.endpoint,
      p256dh: parsed.data.keys.p256dh,
      auth: parsed.data.keys.auth,
    })),
    { onConflict: "endpoint,household_id" },
  );
  if (error) return { ok: false, error: "error_inesperado" };

  return { ok: true, data: null };
}
