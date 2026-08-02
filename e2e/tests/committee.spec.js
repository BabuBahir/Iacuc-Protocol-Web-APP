import { test, expect } from "@playwright/test";

test("committee page lists protocols in review with no votes yet", async ({ page }) => {
  await page.goto("/committee");

  await expect(page.getByRole("heading", { name: "Full Committee Review" })).toBeVisible();
  await expect(page.getByText("IACUC-2026-0142")).toBeVisible();
  await expect(page.getByText("No votes cast yet.")).toBeVisible();
});

test("casting a vote updates the tally and vote history", async ({ page }) => {
  await page.goto("/committee");
  await expect(page.getByText("IACUC-2026-0142")).toBeVisible();

  const selects = page.getByRole("combobox");
  // First select is the voter picker (voters sorted by name); index 1 is a
  // committee-eligible voter other than the default.
  await selects.first().selectOption({ index: 1 });
  await selects.nth(1).selectOption("Approve");
  await page.getByPlaceholder("Comment (optional)").fill("Looks good.");
  await page.getByRole("button", { name: "Cast vote" }).click();

  await expect(page.getByText(/voted Approve/)).toBeVisible();
  await expect(page.getByText(/Looks good/)).toBeVisible();
  await expect(page.getByText("No votes cast yet.")).not.toBeVisible();
});
