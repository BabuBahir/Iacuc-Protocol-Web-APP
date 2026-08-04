import { test, expect } from "@playwright/test";

// The seeded compliance fixtures (see server/src/seed.js):
//  - Elena Marsh & Sam Whitfield (both on 0142) are fully compliant → green.
//  - Raj Patel (also on 0142) has no records → amber.
//  - Marcus Chen has current training but OHSP Pending → amber.
//  - Jordan Blake has lapsed (expired) training → amber.
//  - Hana Sato / Tom Nguyen / Ben Foster / Maya Patel are unseeded
//    (No records / Pending) — safe mutation targets: not on any protocol's
//    personnel list, so changing their status can't disturb other specs.

function personnelRow(page, name) {
  return page.getByText(name, { exact: true }).locator("xpath=ancestor::div[contains(@class,'px-4')][1]");
}

test("detail page shows a compliance chip for each listed person", async ({ page }) => {
  // IACUC-2026-0142 lists Elena Marsh (compliant), Raj Patel (action needed),
  // and Sam Whitfield (compliant). This test only reads.
  await page.goto("/");
  await page.locator("tbody tr").filter({ hasText: "IACUC-2026-0142" }).click();
  await expect(page.getByRole("heading", { name: "IACUC-2026-0142" })).toBeVisible();

  await expect(page.getByText("Personnel (3)")).toBeVisible();
  await expect(page.getByText("Compliant", { exact: true })).toHaveCount(2);
  await expect(page.getByText("Action needed", { exact: true })).toHaveCount(1);
});

test("admin page lists training and OHSP status chips per person", async ({ page }) => {
  await page.goto("/admin");

  await expect(page.getByRole("heading", { name: "Admin" })).toBeVisible();
  // Seeded spread of statuses: fully current (Elena), expired (Jordan),
  // no records (Hana), OHSP pending (Marcus) / cleared (Elena).
  await expect(page.getByText("Training: Current").first()).toBeVisible();
  await expect(page.getByText("OHSP: Cleared").first()).toBeVisible();
  await expect(page.getByText("Training: Expired").first()).toBeVisible();
  await expect(page.getByText("OHSP: Pending").first()).toBeVisible();
  await expect(page.getByText("Training: No records").first()).toBeVisible();
});

test("opens the compliance modal with training and OHSP data", async ({ page }) => {
  await page.goto("/admin");

  await personnelRow(page, "Dr. Elena Marsh")
    .getByRole("button", { name: "Manage compliance" })
    .click();

  await expect(page.getByText("Compliance — Dr. Elena Marsh")).toBeVisible();
  await expect(page.getByText("Working with the IACUC")).toBeVisible();
  await expect(page.getByText("Refinement of Rodent Handling")).toBeVisible();
  await expect(page.getByText("Last reviewed 2026-01-10")).toBeVisible();
});

test("adds a training record from the compliance modal", async ({ page }) => {
  // Hana Sato starts with no records; adding one flips her row to Current.
  await page.goto("/admin");

  const hanaRow = personnelRow(page, "Dr. Hana Sato");
  await expect(hanaRow.getByText("Training: No records")).toBeVisible();

  await hanaRow.getByRole("button", { name: "Manage compliance" }).click();
  await expect(page.getByText("Compliance — Dr. Hana Sato")).toBeVisible();
  await expect(page.getByText("No training records on file.")).toBeVisible();

  await page.getByLabel("Course name").fill("Laser Safety for Research Staff");
  await page.getByLabel("Completed date").fill("2026-02-01");
  await page.getByRole("button", { name: "Add training" }).click();

  await expect(page.getByText("Laser Safety for Research Staff")).toBeVisible();
  await expect(page.getByLabel("Course name")).toHaveValue("");

  // The admin list behind the modal refreshes via onChanged.
  await expect(hanaRow.getByText("Training: Current")).toBeVisible();
});

test("sets OHSP clearance from the compliance modal", async ({ page }) => {
  // Hana Sato starts with OHSP Pending; clearing her flips the row chip.
  await page.goto("/admin");

  const hanaRow = personnelRow(page, "Dr. Hana Sato");
  await expect(hanaRow.getByText("OHSP: Pending")).toBeVisible();

  await hanaRow.getByRole("button", { name: "Manage compliance" }).click();
  await expect(page.getByText("Compliance — Dr. Hana Sato")).toBeVisible();

  await page.getByRole("button", { name: "Cleared", exact: true }).click();

  await expect(hanaRow.getByText("OHSP: Cleared")).toBeVisible();
});
