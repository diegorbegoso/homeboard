import { expect, test } from "@playwright/test";
import { createHousehold, joinHousehold, newIsolatedPage, readInviteCode, registerUser, uniqueEmail } from "./helpers";

test("anonymous requests go to /entrar but PWA assets stay public", async ({ page, request }) => {
  for (const path of ["/", "/compras", "/ajustes"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/entrar/);
  }
  for (const path of ["/manifest.webmanifest", "/sw.js", "/offline", "/icons/icon-192.png"]) {
    expect((await request.get(path)).status()).toBe(200);
  }
});

test("create a household, share the code, a second user joins", async ({ page, browser }) => {
  await registerUser(page, "Marta", uniqueEmail("marta"));
  await page.goto("/");
  await expect(page).toHaveURL(/\/bienvenida/);
  await createHousehold(page, "Casa de Marta");
  const code = await readInviteCode(page);

  const guest = await newIsolatedPage(browser);
  await registerUser(guest, "Pablo", uniqueEmail("pablo"));
  await joinHousehold(guest, code);
  await guest.goto("/ajustes");
  const members = guest.getByRole("list", { name: "Miembros" });
  await expect(members).toContainText("Marta");
  await expect(members).toContainText("Pablo");
});

test("an unknown code is rejected", async ({ page }) => {
  await registerUser(page, "Sin Hogar", uniqueEmail("sinhogar"));
  await page.goto("/bienvenida");
  await page.getByLabel("Código de invitación", { exact: true }).fill("ZZZZZZZZ");
  await page.getByRole("button", { name: "Unirme", exact: true }).click();
  await expect(page.getByRole("alert").first()).toHaveText("Ese código no existe");
  await expect(page).toHaveURL(/\/bienvenida/);
});

test("sign out clears the session", async ({ page }) => {
  await registerUser(page, "Salida", uniqueEmail("salida"));
  await createHousehold(page, "Casa de Salida");
  await page.goto("/ajustes");
  await page.getByRole("button", { name: "Cerrar sesión", exact: true }).click();
  await expect(page).toHaveURL(/\/entrar/);
  const cookies = await page.context().cookies();
  expect(cookies.some((cookie) => cookie.name.startsWith("sb-") && cookie.value !== "")).toBe(false);
});
