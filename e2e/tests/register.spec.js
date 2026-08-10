import { test, expect } from "@playwright/test";
import fs from "node:fs";

// Animal usage register (Roadmap item 8, register half): the global ledger
// across all protocols, filterable with the shared filter-builder, with saved
// filters (search_type 'register') and CSV export.
test("register page lists seeded transactions across protocols", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Register" }).click();
  await expect(page).toHaveURL(/\/register/);

  await expect(page.getByRole("heading", { name: "Animal usage register" })).toBeVisible();

  // 0142's two Mouse ledger rows (order + use).
  await expect(page.locator("tbody tr").filter({ hasText: "IACUC-2026-0142" }).first()).toBeVisible();
  await expect(page.getByText("First cohort ordering")).toBeVisible();
  await expect(page.getByText("Cohort 1 on study")).toBeVisible();

  // 0021's over-allowance Rabbit rows.
  await expect(page.locator("tbody tr").filter({ hasText: "IACUC-2026-0021" }).first()).toBeVisible();
  await expect(page.getByText("Exceeds 60 allowance by 10")).toBeVisible();

  // 0158's Zebrafish order. Use .first() — the log-usage spec (detail.spec.js)
  // writes an extra Zebrafish row into this shared DB, and spec files run in
  // parallel workers, so more than one cell can exist by the time we assert.
  await expect(page.getByRole("cell", { name: "Zebrafish / mutant line" }).first()).toBeVisible();

  await expect(page.getByText(/\d+ transactions?/)).toBeVisible();
});

test("register filter-builder narrows the ledger", async ({ page }) => {
  await page.goto("/register");

  await page.getByRole("button", { name: /Filters/ }).click();
  await page.getByRole("button", { name: "Add clause" }).click();

  await page.getByLabel("Filter 1 field").selectOption("pain_level");
  await page.getByLabel("Filter 1 value").selectOption("D");

  // Only 0021's two Category-D Rabbit rows survive.
  await expect(page.locator("tbody tr").filter({ hasText: "IACUC-2026-0021" }).first()).toBeVisible();
  await expect(page.getByText("First cohort ordering")).not.toBeVisible();
  await expect(page.getByText("Cohort 1 on study")).not.toBeVisible();
  await expect(page.getByText("2 transactions")).toBeVisible();
});

test("register saved filter saves, applies, and deletes", async ({ page }) => {
  await page.goto("/register");

  await page.getByRole("button", { name: /Filters/ }).click();
  await page.getByRole("button", { name: "Add clause" }).click();
  await page.getByLabel("Filter 1 field").selectOption("pain_level");
  await page.getByLabel("Filter 1 value").selectOption("D");

  await page.getByRole("button", { name: "Saved filters" }).click();
  await page.getByLabel("Filter name").fill("Pain D register");
  await page.getByRole("button", { name: "Save", exact: true }).click();

  // The saved filter is listed and applying it restores the clauses.
  await expect(page.getByRole("button", { name: /^Pain D register/ })).toBeVisible();
  await page.getByRole("button", { name: /^Pain D register/ }).click();
  await expect(page.getByTestId("active-filter-chip")).toBeVisible();

  // Delete it so a retry of this spec starts clean.
  await page.getByRole("button", { name: "Saved filters" }).click();
  await page.getByRole("button", { name: "Delete saved filter Pain D register" }).click();
  await expect(page.getByRole("button", { name: "Delete saved filter Pain D register" })).not.toBeVisible();
});

test("register CSV export downloads the ledger", async ({ page }) => {
  await page.goto("/register");
  // Count is not an exact number — other specs (detail.spec.js's log-usage
  // test) add ledger rows into this shared DB during the same run.
  await expect(page.getByText(/\d+ transactions?/)).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await page.getByTestId("export-csv").click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toMatch(/^animal-usage-\d{4}-\d{2}-\d{2}\.csv$/);
  const content = fs.readFileSync(await download.path(), "utf8");
  expect(content).toContain("Protocol number,Title,Transaction date,Species / strain,Pain level,Quantity,Type,Procedure,Notes");
  expect(content).toContain("IACUC-2026-0142");
  expect(content).toContain("IACUC-2026-0021");
});
