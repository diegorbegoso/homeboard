import { describe, expect, it, vi } from "vitest";

type Sub = { id: string; endpoint: string; p256dh: string; auth: string };

const { WebPushError } = vi.hoisted(() => {
  class WebPushError extends Error {
    statusCode: number;
    constructor(statusCode: number) {
      super("push error");
      this.statusCode = statusCode;
    }
  }
  return { WebPushError };
});

const mockSend = vi.hoisted(() => vi.fn());
const mockVapid = vi.hoisted(() => vi.fn());
const mockState = vi.hoisted(() => ({
  rows: [] as Sub[],
  deletedIds: [] as string[],
  neqArgs: [] as Array<[string, string]>,
  queryError: null as { code: string } | null,
}));

vi.mock("web-push", () => ({
  sendNotification: mockSend,
  setVapidDetails: mockVapid,
  WebPushError,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (_table: string) => ({
      select: () => ({
        eq: () => ({
          neq: (col: string, val: string) => {
            mockState.neqArgs.push([col, val]);
            return Promise.resolve({ data: mockState.rows, error: mockState.queryError });
          },
        }),
      }),
      delete: () => ({
        in: (_col: string, ids: string[]) => {
          mockState.deletedIds.push(...ids);
          return Promise.resolve({ error: null });
        },
      }),
    }),
  }),
}));

function setup(opts: { rows?: Sub[]; vapid?: boolean; queryError?: { code: string } | null } = {}) {
  vi.resetModules();
  mockSend.mockReset();
  mockVapid.mockReset();
  mockState.rows = opts.rows ?? [];
  mockState.deletedIds = [];
  mockState.neqArgs = [];
  mockState.queryError = opts.queryError ?? null;
  if (opts.vapid !== false) {
    vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", "BPublicKey");
    vi.stubEnv("VAPID_PRIVATE_KEY", "privateKey");
    vi.stubEnv("VAPID_SUBJECT", "mailto:test@example.com");
  } else {
    vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", "");
    vi.stubEnv("VAPID_PRIVATE_KEY", "");
    vi.stubEnv("VAPID_SUBJECT", "");
  }
}

describe("sendPushToHousehold", () => {
  it("calls sendNotification for each non-actor subscription", async () => {
    setup({
      rows: [
        { id: "s1", endpoint: "https://push.example.com/1", p256dh: "dh1", auth: "auth1" },
        { id: "s2", endpoint: "https://push.example.com/2", p256dh: "dh2", auth: "auth2" },
      ],
    });
    mockSend.mockResolvedValue(undefined);
    const { sendPushToHousehold } = await import("@/lib/push/send");
    const payload = { title: "Test", body: "Body", url: "/compras", tag: "compras" };

    const result = await sendPushToHousehold("hid-1", "actor-uid", payload);

    expect(mockSend).toHaveBeenCalledTimes(2);
    for (const call of mockSend.mock.calls) {
      const body = JSON.parse(call[1] as string) as Record<string, unknown>;
      expect(body).toMatchObject({ title: "Test", body: "Body", url: "/compras", tag: "compras" });
    }
    expect(mockState.neqArgs).toContainEqual(["user_id", "actor-uid"]);
    expect(result).toEqual({ sent: 2, removed: 0 });
  });

  it("deletes stale subscriptions on 410 and reports removed count", async () => {
    setup({
      rows: [{ id: "stale-id", endpoint: "https://push.example.com/x", p256dh: "dh", auth: "a" }],
    });
    mockSend.mockRejectedValue(new WebPushError(410));
    const { sendPushToHousehold } = await import("@/lib/push/send");

    const result = await sendPushToHousehold("hid", "actor", { title: "", body: "", url: "", tag: "" });

    expect(mockState.deletedIds).toContain("stale-id");
    expect(result).toEqual({ sent: 0, removed: 1 });
  });

  it("deletes stale subscriptions on 404", async () => {
    setup({
      rows: [{ id: "stale-404", endpoint: "https://push.example.com/y", p256dh: "dh", auth: "a" }],
    });
    mockSend.mockRejectedValue(new WebPushError(404));
    const { sendPushToHousehold } = await import("@/lib/push/send");

    const result = await sendPushToHousehold("hid", "actor", { title: "", body: "", url: "", tag: "" });

    expect(mockState.deletedIds).toContain("stale-404");
    expect(result.removed).toBe(1);
  });

  it("returns { sent: 0, removed: 0 } when VAPID keys are missing", async () => {
    setup({ vapid: false });
    const { sendPushToHousehold } = await import("@/lib/push/send");

    const result = await sendPushToHousehold("hid", "actor", { title: "", body: "", url: "", tag: "" });

    expect(mockSend).not.toHaveBeenCalled();
    expect(result).toEqual({ sent: 0, removed: 0 });
  });

  it("returns { sent: 0, removed: 0 } on query error", async () => {
    setup({ queryError: { code: "PGRST301" } });
    const { sendPushToHousehold } = await import("@/lib/push/send");

    const result = await sendPushToHousehold("hid", "actor", { title: "", body: "", url: "", tag: "" });

    expect(mockSend).not.toHaveBeenCalled();
    expect(result).toEqual({ sent: 0, removed: 0 });
  });
});

describe("buildItemPush", () => {
  it("builds an 'added' push with correct body and url", async () => {
    setup();
    const { buildItemPush } = await import("@/lib/push/send");

    const payload = buildItemPush("added", "Ana", "Leche");

    expect(payload.body).toBe("Ana añadió Leche");
    expect(payload.url).toBe("/compras");
    expect(payload.tag).toBe("compras");
  });

  it("builds a 'done' push with correct body and url", async () => {
    setup();
    const { buildItemPush } = await import("@/lib/push/send");

    const payload = buildItemPush("done", "Ana", "Leche");

    expect(payload.body).toBe("Ana compró Leche");
    expect(payload.url).toBe("/compras");
    expect(payload.tag).toBe("compras");
  });
});
