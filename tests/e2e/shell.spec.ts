import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 375, height: 812 } });

test("no horizontal scroll at 375px", async ({ page }) => {
  await page.goto("/");
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBe(0);
});

const SCHEMES = [
  ["dark", "rgb(28, 25, 23)"],
  ["light", "rgb(255, 251, 235)"],
] as const;

for (const [scheme, color] of SCHEMES) {
  test(`body background in ${scheme} mode`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto("/");
    const background = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(background).toBe(color);
  });
}

test("Spanish document with a 16px body", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "es");
  const size = await page.evaluate(() => getComputedStyle(document.body).fontSize);
  expect(size).toBe("16px");
});

test("bottom tab bar", async ({ page }) => {
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Navegación principal" });
  for (const name of ["Inicio", "Compras", "Ajustes"]) {
    const link = nav.getByRole("link", { name, exact: true });
    await expect(link).toBeVisible();
    const box = await link.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  }
  await expect(nav.getByRole("link", { name: "Inicio", exact: true })).toHaveAttribute("aria-current", "page");
});
