import { test, expect } from "@playwright/test";

test("creates a protocol from the UI and lands on its detail page", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "New protocol" }).click();
  await expect(page).toHaveURL(/\/protocols\/new/);

  await page.getByLabel("Protocol number").fill("IACUC-2026-0999");
  await page.getByLabel("Title").fill("raju owl protocol");
  await page.getByLabel("Principal investigator").fill("Dr. Raju");
  await page.getByLabel("Number of animals").fill("42");

  await page.getByRole("button", { name: "Add step" }).click();
  await page.getByLabel("Step description").fill("Habituate animals to handling");
  await page.getByLabel("Duration").fill("7 days");
  await page.getByRole("button", { name: "Save step" }).click();

  await page.getByRole("button", { name: "Create protocol" }).click();

  // Created protocol is a Draft and lands on its detail page.
  await expect(page).toHaveURL(/\/protocols\/IACUC-2026-0999/);
  await expect(page.getByRole("heading", { name: "IACUC-2026-0999" })).toBeVisible();
  await expect(page.getByText("raju owl protocol")).toBeVisible();
  // The stage stepper renders "Draft" too; scope to the status badge.
  await expect(page.locator("span").filter({ hasText: "Draft" }).first()).toBeVisible();

  // The research-plan step carried through to the detail page.
  await expect(page.getByText("Habituate animals to handling")).toBeVisible();
  await expect(page.getByText(/7 days/)).toBeVisible();

  // The new protocol is listed on the dashboard.
  await page.goto("/");
  await expect(page.locator("tbody tr").filter({ hasText: "IACUC-2026-0999" })).toBeVisible();
});

test("empty submit shows the required-field message and does not navigate", async ({ page }) => {
  await page.goto("/protocols/new");

  await page.getByRole("button", { name: "Create protocol" }).click();

  await expect(
    page.getByText("Please fill in a protocol number, a title, a principal investigator before saving.")
  ).toBeVisible();
  await expect(page).toHaveURL(/\/protocols\/new/);

  // Filling the missing fields clears the block and creates successfully.
  await page.getByLabel("Protocol number").fill("IACUC-2026-0997");
  await page.getByLabel("Title").fill("partial then completed");
  await page.getByLabel("Principal investigator").fill("Dr. Raju");
  await page.getByRole("button", { name: "Create protocol" }).click();
  await expect(page).toHaveURL(/\/protocols\/IACUC-2026-0997/);
  await expect(page.getByRole("heading", { name: "IACUC-2026-0997" })).toBeVisible();
});

test("duplicate protocol number surfaces the server error and stays on the page", async ({ page }) => {
  // IACUC-2026-0142 already exists in the seeded database.
  await page.goto("/protocols/new");
  await page.getByLabel("Protocol number").fill("IACUC-2026-0142");
  await page.getByLabel("Title").fill("duplicate id attempt");
  await page.getByLabel("Principal investigator").fill("Dr. Raju");
  await page.getByRole("button", { name: "Create protocol" }).click();

  await expect(page.getByText("UNIQUE constraint failed")).toBeVisible();
  await expect(page).toHaveURL(/\/protocols\/new/);
  await expect(page.getByLabel("Protocol number")).toBeVisible();
});
