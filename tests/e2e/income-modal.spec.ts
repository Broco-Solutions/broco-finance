import { test, expect } from "@playwright/test";

const BASE = "http://localhost:3299";

test.describe("Income modal flows", () => {
  test.beforeEach(async ({ context }) => {
    await context.addCookies([
      { name: "broco_session", value: "ok", domain: "localhost", path: "/" },
    ]);
  });

  // --- Flujo A: new project appears in income form selector ---

  test("Flujo A — new project appears in income form after creation", async ({ page }) => {
    const clientName = `FA-${Date.now()}`;
    const projectName = `FA-Proj-${Date.now()}`;

    // 1. Create client
    await page.goto(BASE + "/clients", { waitUntil: "load" });
    await page.getByRole("button", { name: "Nuevo cliente" }).click();
    await page.getByPlaceholder("Nombre").fill(clientName);
    await page.getByRole("button", { name: "Guardar" }).click();
    await page.waitForTimeout(2500);

    // 2. Create project
    await page.goto(BASE + "/projects", { waitUntil: "load" });
    await page.getByRole("button", { name: "Nuevo proyecto" }).click();
    await expect(page.getByRole("heading", { name: "Nuevo proyecto" })).toBeVisible({ timeout: 5000 });
    await page.locator("select").last().selectOption({ label: clientName });
    await page.getByPlaceholder("Nombre").fill(projectName);
    await page.getByRole("button", { name: "Guardar" }).click();
    await page.waitForTimeout(3000);

    // 3. Open income form
    await page.goto(BASE + "/incomes", { waitUntil: "load" });
    await page.getByRole("button", { name: "Nuevo ingreso" }).click();
    await expect(page.getByRole("heading", { name: "Nuevo ingreso" })).toBeVisible({ timeout: 5000 });

    // Modal selects: type=nth(2), client=nth(3), project=nth(4)
    // (0=filter status, 1=filter type, then 2-4 are modal selects)
    const modalClientSelect = page.locator("select").nth(3);
    await modalClientSelect.selectOption({ label: clientName });
    await page.waitForTimeout(500);

    // Set type to DEVELOPMENT to enable project selector
    const modalTypeSelect = page.locator("select").nth(2);
    await modalTypeSelect.selectOption("DEVELOPMENT");
    await page.waitForTimeout(300);

    // Check project appears
    const modalProjectSelect = page.locator("select").nth(4);
    const projOpts = await modalProjectSelect.locator("option").allTextContents();
    const found = projOpts.some((o) => o.includes(projectName));
    expect(found).toBe(true);

    // Select project and create income
    await modalProjectSelect.selectOption({ label: projectName });
    // Fill remaining fields and save
    await page.getByPlaceholder("Concepto *").fill("Test income A");
    // Fill effective date (last date input is modal's)
    const dateInputs = page.locator('input[type="date"]');
    if (await dateInputs.count() > 0) {
      await dateInputs.last().fill("2026-07-15");
    }
    await page.getByPlaceholder("Monto USD").fill("100");
    await page.getByRole("button", { name: "Guardar" }).click();
    await page.waitForTimeout(2500);

    // Verify income created
    await page.goto(BASE + "/incomes", { waitUntil: "load" });
    await expect(page.getByText("Test income A").first()).toBeVisible({ timeout: 5000 });
  });

  // --- Flujo B: switching clients clears project and filters correctly ---

  test("Flujo B — switching client resets project and filters correctly", async ({ page }) => {
    await page.goto(BASE + "/incomes", { waitUntil: "load" });
    await page.getByRole("button", { name: "Nuevo ingreso" }).click();
    await expect(page.getByRole("heading", { name: "Nuevo ingreso" })).toBeVisible({ timeout: 5000 });

    // Modal selects: type=nth(2), client=nth(3), project=nth(4)
    const modalTypeSel = page.locator("select").nth(2);
    const modalClientSel = page.locator("select").nth(3);
    const modalProjSel = page.locator("select").nth(4);

    // Set type to DEVELOPMENT first
    await modalTypeSel.selectOption("DEVELOPMENT");

    // Select first client
    const clientOpts = await modalClientSel.locator("option").allTextContents();
    let firstClient = "";
    for (const o of clientOpts) {
      if (o && !o.includes("Seleccionar") && !o.includes("*")) {
        firstClient = o;
        break;
      }
    }
    if (!firstClient) { await page.getByRole("button", { name: "Cancelar" }).click(); return; }

    await modalClientSel.selectOption({ label: firstClient });
    await page.waitForTimeout(500);

    // Project select should be enabled
    await expect(modalProjSel).toBeEnabled();

    // Find second client
    let secondClient = "";
    for (const o of clientOpts) {
      if (o && o !== firstClient && !o.includes("Seleccionar") && !o.includes("*")) {
        secondClient = o;
        break;
      }
    }

    if (secondClient) {
      await modalClientSel.selectOption({ label: secondClient });
      await page.waitForTimeout(500);

      // Project should be reset to empty
      await expect(modalProjSel).toHaveValue("");
    }

    await page.getByRole("button", { name: "Cancelar" }).click();
  });

  // --- Flujo C: mobile viewport no horizontal overflow ---

  test("Flujo C — modal responsive no horizontal overflow", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });

    await page.goto(BASE + "/incomes", { waitUntil: "load" });
    await page.getByRole("button", { name: "Nuevo ingreso" }).click();
    await expect(page.getByRole("heading", { name: "Nuevo ingreso" })).toBeVisible({ timeout: 5000 });

    // No horizontal overflow
    const sw = await page.evaluate(() => document.documentElement.scrollWidth);
    const cw = await page.evaluate(() => document.documentElement.clientWidth);
    expect(sw).toBeLessThanOrEqual(cw + 1);

    // Modal card within viewport
    const modal = page.locator(".rounded-\\[1\\.5rem\\]").first();
    const box = await modal.boundingBox();
    if (box) expect(box.x + box.width).toBeLessThanOrEqual(cw + 1);

    // Buttons visible
    await expect(page.getByRole("button", { name: "Guardar" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Cancelar" })).toBeVisible();

    // Enable multi-income
    await page.getByText("Agregar varios ingresos").click();
    await page.waitForTimeout(300);

    const sw2 = await page.evaluate(() => document.documentElement.scrollWidth);
    const cw2 = await page.evaluate(() => document.documentElement.clientWidth);
    expect(sw2).toBeLessThanOrEqual(cw2 + 1);

    // Buttons still visible
    await expect(page.getByRole("button", { name: "Cancelar" })).toBeVisible();
    await page.getByRole("button", { name: "Cancelar" }).click();
  });
});
