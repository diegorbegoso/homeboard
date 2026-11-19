import { expect, test } from "@playwright/test";

test("health rejects requests without the cron secret", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.status()).toBe(401);
  expect(await response.json()).toEqual({ ok: false, error: "unauthorized" });
});

test("health answers ok with the cron secret", async ({ request }) => {
  const response = await request.get("/api/health", {
    headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
  });
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ ok: true });
});
