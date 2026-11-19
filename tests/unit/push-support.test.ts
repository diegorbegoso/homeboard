import { describe, expect, it, vi } from "vitest";
import { saveSubscription } from "@/lib/push/actions";
import { pushSupportState, subscriptionSchema } from "@/lib/push/support";

const IOS_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const ANDROID_UA =
  "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36";

const mockUpsert = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "user-1" } } }) },
    from: (table: string) =>
      table === "household_members"
        ? {
            select: () => ({
              eq: () => ({
                order: async () => ({
                  data: [
                    { household_id: "hid-1", role: "owner", households: { name: "Casa 1", invite_code: "AAAAAAAA" } },
                    { household_id: "hid-2", role: "member", households: { name: "Casa 2", invite_code: "BBBBBBBB" } },
                  ],
                }),
              }),
            }),
          }
        : { upsert: mockUpsert },
  }),
}));

describe("pushSupportState", () => {
  it("iPhone outside the installed app → instalar", () => {
    expect(pushSupportState({ userAgent: IOS_UA, isStandalone: false, hasPushManager: true })).toBe("instalar");
  });

  it("iPhone installed with PushManager → disponible", () => {
    expect(pushSupportState({ userAgent: IOS_UA, isStandalone: true, hasPushManager: true })).toBe("disponible");
  });

  it("Android with PushManager → disponible", () => {
    expect(pushSupportState({ userAgent: ANDROID_UA, isStandalone: false, hasPushManager: true })).toBe("disponible");
  });

  it("Android without PushManager → no-soportado", () => {
    expect(pushSupportState({ userAgent: ANDROID_UA, isStandalone: false, hasPushManager: false })).toBe(
      "no-soportado",
    );
  });
});

describe("subscriptionSchema", () => {
  const endpoint = "https://fcm.googleapis.com/fcm/send/abc";

  it("rejects a payload without keys.p256dh", () => {
    expect(subscriptionSchema.safeParse({ endpoint, keys: { auth: "a" } }).success).toBe(false);
  });

  it("rejects an http endpoint", () => {
    const http = "http://fcm.googleapis.com/fcm/send/abc";
    expect(subscriptionSchema.safeParse({ endpoint: http, keys: { p256dh: "d", auth: "a" } }).success).toBe(false);
  });

  it("accepts an https endpoint with both keys", () => {
    expect(subscriptionSchema.safeParse({ endpoint, keys: { p256dh: "d", auth: "a" } }).success).toBe(true);
  });
});

describe("saveSubscription", () => {
  it("rejects a malformed payload without writing", async () => {
    const result = await saveSubscription({ keys: { p256dh: "d", auth: "a" } });
    expect(result).toEqual({ ok: false, error: "suscripcion_invalida" });
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("upserts one row per household the user belongs to", async () => {
    mockUpsert.mockResolvedValue({ error: null });
    const result = await saveSubscription({
      endpoint: "https://fcm.googleapis.com/fcm/send/abc",
      keys: { p256dh: "d", auth: "a" },
    });
    expect(mockUpsert).toHaveBeenCalledWith(
      [
        expect.objectContaining({ user_id: "user-1", household_id: "hid-1" }),
        expect.objectContaining({ user_id: "user-1", household_id: "hid-2" }),
      ],
      { onConflict: "endpoint,household_id" },
    );
    expect(result).toEqual({ ok: true, data: null });
  });
});
