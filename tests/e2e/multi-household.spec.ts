import { expect, test } from "@playwright/test";
import { createHousehold, newIsolatedPage, registerUser, uniqueEmail } from "./helpers";

test("a user can create a second household, switch between them and keep lists separate", async ({ page }) => {
  await registerUser(page, "Multi", uniqueEmail("multi"));
  await createHousehold(page, "Casa Uno");

  await page.goto("/compras");
  await page.getByLabel("Qué hay que comprar", { exact: true }).fill("Pan");
  await page.getByRole("button", { name: "Añadir", exact: true }).click();
  await expect(page.getByTestId("item").filter({ hasText: "Pan" })).toBeVisible();
  // The form resets once the Server Action has committed the item.
  await expect(page.getByLabel("Qué hay que comprar", { exact: true })).toHaveValue("", { timeout: 7000 });

  // Second household from the households page: no "ya perteneces" error, and it becomes the active one.
  await page.goto("/hogares");
  await page.getByLabel("Nombre del hogar", { exact: true }).fill("Casa Dos");
  await page.getByRole("button", { name: "Crear hogar", exact: true }).click();
  await page.waitForURL((url) => url.pathname === "/");
  await expect(page.getByTestId("hogar-activo")).toHaveText("Casa Dos");

  await page.goto("/compras");
  await expect(page.getByTestId("item").filter({ hasText: "Pan" })).toHaveCount(0);

  // Switch back to the first one: its list is intact.
  await page.goto("/hogares");
  await expect(page.getByTestId("hogar")).toHaveCount(2);
  await page.getByRole("button", { name: "Usar Casa Uno", exact: true }).click();
  await page.waitForURL((url) => url.pathname === "/");
  await expect(page.getByTestId("hogar-activo")).toHaveText("Casa Uno");
  await page.goto("/compras");
  await expect(page.getByTestId("item").filter({ hasText: "Pan" })).toBeVisible();
});

test("joining a second household by code works for a user who already has one", async ({ page, browser }) => {
  await registerUser(page, "Uno", uniqueEmail("uno"));
  await createHousehold(page, "Hogar A");
  await page.goto("/ajustes");
  const code = ((await page.getByTestId("codigo-invitacion").textContent()) ?? "").trim();

  const other = await newIsolatedPage(browser);
  await registerUser(other, "Dos", uniqueEmail("dos"));
  await createHousehold(other, "Hogar B");

  await other.goto("/hogares");
  await other.getByLabel("Código de invitación", { exact: true }).fill(code);
  await other.getByRole("button", { name: "Unirme", exact: true }).click();
  await other.waitForURL((url) => url.pathname === "/");
  await expect(other.getByTestId("hogar-activo")).toHaveText("Hogar A");
  await other.context().close();
});
