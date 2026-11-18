import { type Browser, expect, type Page, test } from "@playwright/test";

// Shared E2E helpers. The labels below are the UI contract fixed in blueprint §6 — pages must use them verbatim.
export const SEED_PASSWORD = "homeboard-dev-1234";
export const SEED_USERS = {
  ana: "ana@homeboard.test",
  luis: "luis@homeboard.test",
  bea: "bea@homeboard.test",
} as const;

export function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}@homeboard.test`;
}

export async function signIn(page: Page, email: string, password: string = SEED_PASSWORD): Promise<void> {
  await page.goto("/entrar");
  await page.getByLabel("Correo", { exact: true }).fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).not.toHaveURL(/\/entrar/);
}

export async function registerUser(
  page: Page,
  name: string,
  email: string,
  password: string = SEED_PASSWORD,
): Promise<void> {
  await page.goto("/registro");
  await page.getByLabel("Nombre", { exact: true }).fill(name);
  await page.getByLabel("Correo", { exact: true }).fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Crear cuenta", exact: true }).click();
  await expect(page).not.toHaveURL(/\/registro/);
}

export async function createHousehold(page: Page, name: string): Promise<void> {
  await page.goto("/bienvenida");
  await page.getByLabel("Nombre del hogar", { exact: true }).fill(name);
  await page.getByRole("button", { name: "Crear hogar", exact: true }).click();
  await page.waitForURL((url) => url.pathname === "/");
}

export async function readInviteCode(page: Page): Promise<string> {
  await page.goto("/ajustes");
  const code = (await page.getByTestId("codigo-invitacion").innerText()).trim();
  expect(code).toMatch(/^[A-Z2-9]{8}$/);
  return code;
}

export async function joinHousehold(page: Page, code: string): Promise<void> {
  await page.goto("/bienvenida");
  await page.getByLabel("Código de invitación", { exact: true }).fill(code);
  await page.getByRole("button", { name: "Unirme", exact: true }).click();
  await page.waitForURL((url) => url.pathname === "/");
}

/**
 * A second, fully isolated browser session (its own cookies) with the project's settings — baseURL and the
 * Pixel 7 device. `browser.newContext()` alone does NOT inherit them, so multi-user tests use this.
 */
export async function newIsolatedPage(browser: Browser): Promise<Page> {
  const context = await browser.newContext({ ...test.info().project.use });
  return context.newPage();
}

/** A fresh user who owns a fresh household — the isolation unit for every mutating E2E test. */
export async function newMemberWithHousehold(page: Page, name: string): Promise<{ email: string }> {
  const email = uniqueEmail(name.toLowerCase());
  await registerUser(page, name, email);
  await createHousehold(page, `Casa de ${name}`);
  return { email };
}
