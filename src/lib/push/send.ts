import { sendNotification, setVapidDetails, WebPushError } from "web-push";
import { log } from "@/lib/log";
import { createAdminClient } from "@/lib/supabase/admin";

export type PushPayload = { title: string; body: string; url: string; tag: string };

// setVapidDetails runs once per process, lazily: at module scope it would throw during builds and tests
// that have no VAPID keys (§10: VAPID is required from step 12 only where push is sent).
let vapidReady = false;

function ensureVapid(): boolean {
  if (vapidReady) {
    return true;
  }
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) {
    log.warn("push.disabled", { reason: "vapid_missing" });
    return false;
  }
  setVapidDetails(subject, publicKey, privateKey);
  vapidReady = true;
  return true;
}

export function buildItemPush(kind: "added" | "done", actorName: string, itemName: string): PushPayload {
  return kind === "added"
    ? { title: "Lista de compras", body: `${actorName} añadió ${itemName}`, url: "/compras", tag: "compras" }
    : { title: "Lista de compras", body: `${actorName} compró ${itemName}`, url: "/compras", tag: "compras" };
}

export async function sendPushToHousehold(
  householdId: string,
  exceptUserId: string,
  payload: PushPayload,
): Promise<{ sent: number; removed: number }> {
  if (!ensureVapid()) {
    return { sent: 0, removed: 0 };
  }
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("household_id", householdId)
    .neq("user_id", exceptUserId);
  if (error) {
    log.error("push.query_failed", { householdId, code: error.code });
    return { sent: 0, removed: 0 };
  }
  let sent = 0;
  const stale: string[] = [];
  await Promise.all(
    (data ?? []).map(async (subscription) => {
      try {
        await sendNotification(
          { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
          JSON.stringify(payload),
          { TTL: 3600, urgency: "normal" },
        );
        sent += 1;
      } catch (err) {
        if (err instanceof WebPushError && (err.statusCode === 404 || err.statusCode === 410)) {
          stale.push(subscription.id);
        } else {
          log.warn("push.send_failed", { status: err instanceof WebPushError ? err.statusCode : null });
        }
      }
    }),
  );
  if (stale.length > 0) {
    await admin.from("push_subscriptions").delete().in("id", stale);
  }
  return { sent, removed: stale.length };
}
