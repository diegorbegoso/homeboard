import { expect, type Page, test } from "@playwright/test";
import { registerUser, SEED_PASSWORD, SEED_USERS, signIn, uniqueEmail } from "./helpers";

async function hasSessionCookie(page: Page): Promise<boolean> {
  return (await page.context().cookies()).some((cookie) => cookie.name.startsWith("sb-"));
}

test("registro con correo nuevo crea la sesión", async ({ page }) => {
  await registerUser(page, "Prueba", uniqueEmail("registro"));
  expect(await hasSessionCookie(page)).toBe(true);
});

test("entrar con un usuario del seed", async ({ page }) => {
  await signIn(page, SEED_USERS.ana, SEED_PASSWORD);
  expect(await hasSessionCookie(page)).toBe(true);
});

test("contraseña incorrecta", async ({ page }) => {
  await page.goto("/entrar");
  await page.getByLabel("Correo", { exact: true }).fill(SEED_USERS.ana);
  await page.getByLabel("Contraseña", { exact: true }).fill("incorrecta-123");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page.getByRole("alert").first()).toHaveText("Correo o contraseña incorrectos");
  await expect(page).toHaveURL(/\/entrar/);
  expect(await hasSessionCookie(page)).toBe(false);
});

test("contraseña corta en el registro", async ({ page }) => {
  await page.goto("/registro");
  await page.getByLabel("Nombre", { exact: true }).fill("Corta");
  await page.getByLabel("Correo", { exact: true }).fill(uniqueEmail("corta"));
  await page.getByLabel("Contraseña", { exact: true }).fill("1234");
  await page.getByRole("button", { name: "Crear cuenta", exact: true }).click();
  await expect(page.getByRole("alert").first()).toHaveText("La contraseña necesita al menos 8 caracteres");
  await expect(page).toHaveURL(/\/registro/);
});
