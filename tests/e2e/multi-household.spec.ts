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

test("leaving a household asks first; leaving the last one returns to onboarding", async ({ page }) => {
  await registerUser(page, "Sale", uniqueEmail("sale"));
  await createHousehold(page, "Casa Fija");
  await page.goto("/hogares");
  await page.getByLabel("Nombre del hogar", { exact: true }).fill("Casa Pasajera");
  await page.getByRole("button", { name: "Crear hogar", exact: true }).click();
  await page.waitForURL((url) => url.pathname === "/");

  await page.goto("/hogares");
  await expect(page.getByTestId("hogar")).toHaveCount(2);

  // Cancel keeps the household.
  await page.getByRole("button", { name: "Salir de Casa Pasajera", exact: true }).click();
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  await expect(page.getByTestId("hogar")).toHaveCount(2);

  // Confirm removes it; the other one stays and becomes active.
  await page.getByRole("button", { name: "Salir de Casa Pasajera", exact: true }).click();
  await page.getByRole("button", { name: "Salir del hogar", exact: true }).click();
  await expect(page.getByTestId("hogar")).toHaveCount(1);
  await expect(page.getByText("Activo", { exact: true })).toBeVisible();

  // Leaving the last household sends the user back to onboarding.
  await page.getByRole("button", { name: "Salir de Casa Fija", exact: true }).click();
  await page.getByRole("button", { name: "Salir del hogar", exact: true }).click();
  await expect(page).toHaveURL(/\/bienvenida/);
});

test("deleting the account asks first, signs out and the credentials stop working", async ({ page }) => {
  const email = uniqueEmail("borra");
  await registerUser(page, "Borra", email);
  await createHousehold(page, "Casa Efimera");

  await page.goto("/ajustes");
  await page.getByRole("button", { name: "Eliminar mi cuenta", exact: true }).click();
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  await expect(page).toHaveURL(/\/ajustes/);

  await page.getByRole("button", { name: "Eliminar mi cuenta", exact: true }).click();
  await page.getByRole("button", { name: "Eliminar cuenta", exact: true }).click();
  await expect(page).toHaveURL(/\/entrar/);
  await expect(page.getByText("Tu cuenta se eliminó", { exact: false })).toBeVisible();

  await page.getByLabel("Correo", { exact: true }).fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill("homeboard-dev-1234");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page.getByText("Correo o contraseña incorrectos")).toBeVisible();
});
