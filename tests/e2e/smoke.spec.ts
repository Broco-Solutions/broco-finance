import { test, expect } from "@playwright/test";

const BASE = "http://localhost:3299";

// Income page: 4 filter selects (status, type, client, project) on left
// Modal selects start at index 4: type(4), client(5), project(6), status(7)
const M_TYPE = 4;
const M_CLIENT = 5;
const M_PROJECT = 6;

test.describe("Smoke - dates, filters, totalizer", () => {
  test.beforeEach(async ({ context }) => {
    await context.addCookies([
      { name: "broco_session", value: "ok", domain: "localhost", path: "/" },
    ]);
  });

  // --- Flujo A: dates ---
  test("dates — create PENDING income with manual date, verify it appears in table", async ({ page }) => {
    const concept = `Date-${Date.now()}`;

    await page.goto(BASE + "/incomes", { waitUntil: "load" });
    await page.getByRole("button", { name: "Nuevo ingreso" }).click();
    await expect(page.getByRole("heading", { name: "Nuevo ingreso" })).toBeVisible({ timeout: 5000 });

    // Set type to OTHER (no project needed) - modal type is at index 4
    await page.locator("select").nth(M_TYPE).selectOption("OTHER");
    await page.waitForTimeout(200);

    // Find the status select in the modal by scanning all selects for PENDIENTE option
    const statusIdx = await page.evaluate(() => {
      const sels = document.querySelectorAll("select");
      for (let i = 0; i < sels.length; i++) {
        const opts = Array.from(sels[i].options).map(o => o.textContent || "");
        if (opts.includes("Pendiente")) return i;
      }
      return -1;
    });
    expect(statusIdx).toBeGreaterThan(-1);

    await page.locator("select").nth(statusIdx!).selectOption("PENDING");
    await page.waitForTimeout(200);

    // Fill dueDate
    const dateInputs = page.locator('input[type="date"]');
    if (await dateInputs.count() > 0) await dateInputs.last().fill("2026-12-25");

    // Fill concept and amount
    await page.getByPlaceholder("Concepto *").fill(concept);
    await page.getByPlaceholder("Monto USD").fill("150");

    // Save
    await page.getByRole("button", { name: "Guardar" }).click();
    await page.waitForTimeout(2500);

    // Reload and verify
    await page.goto(BASE + "/incomes", { waitUntil: "load" });
    await expect(page.getByText(concept).first()).toBeVisible({ timeout: 5000 });

    // Verify date shows 25/12/2026 not today
    const pageText = await page.textContent("body");
    expect(pageText).toContain("25/12/2026");
  });

  // --- Flujo B: income filters client → project cascade ---
  test("filters — client selects projects in cascade", async ({ page }) => {
    await page.goto(BASE + "/incomes", { waitUntil: "load" });

    // Filter selects: 0=status, 1=type, 2=client, 3=project
    const clientFilter = page.locator("select").nth(2);
    const projectFilter = page.locator("select").nth(3);

    // Select a client
    const clientOpts = await clientFilter.locator("option").allTextContents();
    const validClient = clientOpts.find(o => o && o !== "Cliente" && !o.startsWith("Seleccionar"));
    if (validClient) {
      await clientFilter.selectOption({ label: validClient });
      await page.waitForTimeout(300);
      await expect(projectFilter).toBeEnabled();
    }

    // Clear
    await clientFilter.selectOption("");
  });

  // --- Flujo C: project detail totalizer ---
  test("totalizer — project detail shows income/expense totals", async ({ page }) => {
    await page.goto(BASE + "/projects", { waitUntil: "load" });

    const firstLink = page.locator("a.text-cobalt").first();
    if (await firstLink.isVisible()) {
      await firstLink.click();
      await page.waitForLoadState("load");

      await expect(page.getByText("Movimientos")).toBeVisible({ timeout: 5000 });

      // Use .first() to avoid matching the nav link
      await expect(page.getByText("Ingresos").first()).toBeVisible({ timeout: 3000 });
      await expect(page.getByText("Gastos").first()).toBeVisible({ timeout: 3000 });
    }
  });
});
