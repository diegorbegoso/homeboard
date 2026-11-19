import { z } from "zod";

export type PushSupport = "disponible" | "instalar" | "no-soportado";

export function isIOS(userAgent: string): boolean {
  return /iPad|iPhone|iPod/.test(userAgent);
}

/** iOS only delivers Web Push to an installed PWA (16.4+); elsewhere PushManager is enough. */
export function pushSupportState(input: {
  userAgent: string;
  isStandalone: boolean;
  hasPushManager: boolean;
}): PushSupport {
  if (isIOS(input.userAgent)) {
    if (!input.isStandalone) {
      return "instalar";
    }
    return input.hasPushManager ? "disponible" : "no-soportado";
  }
  return input.hasPushManager ? "disponible" : "no-soportado";
}

export const subscriptionSchema = z.object({
  endpoint: z.url().startsWith("https://"),
  keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }),
});

export type SubscriptionInput = z.infer<typeof subscriptionSchema>;
