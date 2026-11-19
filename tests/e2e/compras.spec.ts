import { expect, test } from "@playwright/test";
import { newMemberWithHousehold } from "./helpers";

test.use({ storageState: { cookies: [], origins: [] } });

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
});

/** Wait for the add form to reset — React 19 does this after the action completes. */
async function waitForAddCommit(page: import("@playwright/test").Page) {
  await expect(page.getByLabel("Qué hay que comprar", { exact: true })).toHaveValue("", { timeout: 7000 });
}

test("empty state text is visible", async ({ page }) => {
  await newMemberWithHousehold(page, "Vacia");
  await page.goto("/compras");
  await expect(page.getByText("Nada por comprar. ¡Qué paz!")).toBeVisible();
});

test("add item appears and persists on reload", async ({ page }) => {
  await newMemberWithHousehold(page, "AddTest");
  await page.goto("/compras");

  await page.getByLabel("Qué hay que comprar", { exact: true }).fill("Leche");
  await page.getByLabel("Cantidad", { exact: true }).fill("2 L");
  await page.getByRole("button", { name: "Añadir", exact: true }).click();

  await expect(page.getByText("Por comprar")).toBeVisible();
  await expect(page.getByTestId("item").filter({ hasText: "Leche" })).toBeVisible();
  await waitForAddCommit(page);

  await page.reload();
  await expect(page.getByTestId("item").filter({ hasText: "Leche" })).toBeVisible();
});

test("edit item and persist", async ({ page }) => {
  await newMemberWithHousehold(page, "EditTest");
  await page.goto("/compras");

  await page.getByLabel("Qué hay que comprar", { exact: true }).fill("Leche");
  await page.getByLabel("Cantidad", { exact: true }).fill("2 L");
  await page.getByRole("button", { name: "Añadir", exact: true }).click();
  await expect(page.getByTestId("item").filter({ hasText: "Leche" })).toBeVisible();
  await waitForAddCommit(page);

  await page.getByRole("button", { name: "Editar Leche", exact: true }).click();
  await page.getByLabel("Nombre", { exact: true }).fill("Leche de avena");
  await page.getByRole("button", { name: "Guardar", exact: true }).click();

  await expect(page.getByTestId("item").filter({ hasText: "Leche de avena" })).toBeVisible();

  await page.reload();
  await expect(page.getByTestId("item").filter({ hasText: "Leche de avena" })).toBeVisible();
});

test("toggle done and undone", async ({ page }) => {
  await newMemberWithHousehold(page, "ToggleTest");
  await page.goto("/compras");

  await page.getByLabel("Qué hay que comprar", { exact: true }).fill("Leche de avena");
  await page.getByRole("button", { name: "Añadir", exact: true }).click();
  await expect(page.getByTestId("item").filter({ hasText: "Leche de avena" })).toBeVisible();
  await waitForAddCommit(page);

  await page.getByRole("checkbox", { name: "Leche de avena" }).click();
  await expect(page.getByText("Comprado")).toBeVisible();

  await page.reload();
  await expect(page.getByRole("checkbox", { name: "Leche de avena" })).toBeChecked();

  await page.getByRole("checkbox", { name: "Leche de avena" }).click();
  await expect(page.getByText("Por comprar")).toBeVisible();
});

test("delete and undo restores item", async ({ page }) => {
  await newMemberWithHousehold(page, "UndoTest");
  await page.goto("/compras");

  await page.getByLabel("Qué hay que comprar", { exact: true }).fill("Mantequilla");
  await page.getByRole("button", { name: "Añadir", exact: true }).click();
  await expect(page.getByTestId("item").filter({ hasText: "Mantequilla" })).toBeVisible();
  await waitForAddCommit(page);

  await page.getByRole("button", { name: "Borrar Mantequilla" }).click();
  await expect(page.getByTestId("item").filter({ hasText: "Mantequilla" })).not.toBeVisible();
  await expect(page.getByText("Deshacer")).toBeVisible();

  await page.getByRole("button", { name: "Deshacer" }).click();
  await expect(page.getByTestId("item").filter({ hasText: "Mantequilla" })).toBeVisible();
});

test("delete and let toast expire leaves item gone on reload", async ({ page }) => {
  await newMemberWithHousehold(page, "DeleteTest");
  await page.goto("/compras");

  await page.getByLabel("Qué hay que comprar", { exact: true }).fill("Yogur");
  await page.getByRole("button", { name: "Añadir", exact: true }).click();
  await expect(page.getByTestId("item").filter({ hasText: "Yogur" })).toBeVisible();
  await waitForAddCommit(page);

  await page.getByRole("button", { name: "Borrar Yogur" }).click();
  await page.waitForTimeout(5500);
  await page.reload();

  await expect(page.getByTestId("item").filter({ hasText: "Yogur" })).not.toBeVisible();
});

test("empty name shows validation error and list stays empty", async ({ page }) => {
  await newMemberWithHousehold(page, "ValidTest");
  await page.goto("/compras");

  await page.getByRole("button", { name: "Añadir", exact: true }).click();

  await expect(page.getByRole("alert").first()).toContainText("Escribe qué hay que comprar");
  await expect(page.getByTestId("item")).toHaveCount(0);
});
