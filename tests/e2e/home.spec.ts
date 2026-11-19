import { expect, test } from "@playwright/test";
import { SEED_USERS, signIn } from "./helpers";

test.use({ viewport: { width: 375, height: 812 } });

test.beforeEach(async ({ page }) => {
  await signIn(page, SEED_USERS.ana);
  await page.goto("/");
});

test("greets the member and shows the household", async ({ page }) => {
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Hola, Ana");
  await expect(page.getByText("Casa de Ana", { exact: true })).toBeVisible();
});

test("shows the shopping list tile", async ({ page }) => {
  const tile = page.getByRole("link", { name: /Lista de compras/ });
  await expect(tile).toHaveAttribute("href", "/compras");
  const box = await tile.boundingBox();
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
});
