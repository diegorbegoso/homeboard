"use server";

import { subscriptionSchema } from "@/lib/push/support";
import { createClient } from "@/lib/supabase/server";

type ActionResult<T = null> = { ok: true; data: T } | { ok: false; error: string };

export async function saveSubscription(input: unknown): Promise<ActionResult<null>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "no_autenticado" };

  const { data: membership } = await supabase
    .from("household_members")
    .select("household_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) return { ok: false, error: "sin_hogar" };

  const parsed = subscriptionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "suscripcion_invalida" };

  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: user.id,
      household_id: membership.household_id,
      endpoint: parsed.data.endpoint,
      p256dh: parsed.data.keys.p256dh,
      auth: parsed.data.keys.auth,
    },
    { onConflict: "endpoint" },
  );
  if (error) return { ok: false, error: "error_inesperado" };

  return { ok: true, data: null };
}
