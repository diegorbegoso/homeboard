import { expect, test } from "@playwright/test";
import {
  joinHousehold,
  newIsolatedPage,
  newMemberWithHousehold,
  readInviteCode,
  registerUser,
  SEED_PASSWORD,
  uniqueEmail,
} from "./helpers";

test.use({ storageState: { cookies: [], origins: [] } });

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
});

/** Wait for add form to reset (action committed on server). */
async function waitForAddCommit(page: import("@playwright/test").Page) {
  await expect(page.getByLabel("Qué hay que comprar", { exact: true })).toHaveValue("", { timeout: 7000 });
}

test("member B sees item added by A in real time", async ({ page, browser }) => {
  // A creates household
  await newMemberWithHousehold(page, "RtA");
  const code = await readInviteCode(page);

  // B joins the same household
  const pageB = await newIsolatedPage(browser);
  await pageB.emulateMedia({ reducedMotion: "reduce" });
  const emailB = uniqueEmail("rtb");
  await registerUser(pageB, "RtB", emailB, SEED_PASSWORD);
  await joinHousehold(pageB, code);

  // Both open /compras
  await page.goto("/compras");
  await pageB.goto("/compras");

  // A adds Tomates
  await page.getByLabel("Qué hay que comprar", { exact: true }).fill("Tomates");
  await page.getByRole("button", { name: "Añadir", exact: true }).click();
  await waitForAddCommit(page);

  // B should see it within 5 s without reload
  await expect(pageB.getByText("Tomates", { exact: true })).toBeVisible({ timeout: 5000 });

  // A marks Tomates as bought
  await page.getByRole("checkbox", { name: "Tomates" }).click();
  await expect(page.getByText("Comprado")).toBeVisible();

  // B should see it checked within 5 s
  await expect(pageB.getByRole("checkbox", { name: "Tomates" })).toBeChecked({ timeout: 5000 });

  // A deletes Tomates
  // First uncheck so it's back in Por comprar and visible
  await page.getByRole("checkbox", { name: "Tomates" }).click();
  await expect(page.getByText("Por comprar")).toBeVisible();
  await page.getByRole("button", { name: "Borrar Tomates" }).click();

  // B should see it gone within 5 s
  await expect(pageB.getByText("Tomates", { exact: true })).toHaveCount(0, { timeout: 5000 });

  await pageB.close();
});

test("item from different household does not appear in C's list", async ({ page, browser }) => {
  // A has their own household
  await newMemberWithHousehold(page, "RtIsoA");
  await page.goto("/compras");

  // C has a completely separate household
  const pageC = await newIsolatedPage(browser);
  await pageC.emulateMedia({ reducedMotion: "reduce" });
  await newMemberWithHousehold(pageC, "RtIsoC");
  await pageC.goto("/compras");

  // A adds Secreto
  await page.getByLabel("Qué hay que comprar", { exact: true }).fill("Secreto");
  await page.getByRole("button", { name: "Añadir", exact: true }).click();
  await waitForAddCommit(page);

  // C waits 5 s — isolation means Secreto must NOT appear
  await pageC.waitForTimeout(5000);
  await expect(pageC.getByText("Secreto", { exact: true })).toHaveCount(0);

  await pageC.close();
});
