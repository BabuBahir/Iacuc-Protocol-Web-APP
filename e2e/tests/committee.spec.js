import { test, expect } from "@playwright/test";

test("committee page lists protocols in review with no votes yet", async ({ page }) => {
  await page.goto("/committee");

  await expect(page.getByRole("heading", { name: "Full Committee Review" })).toBeVisible();
  await expect(page.getByText("IACUC-2026-0142")).toBeVisible();
  await expect(page.getByText("No votes cast yet.")).toBeVisible();
});

test("casting a vote updates the tally and vote history", async ({ page }) => {
  await page.goto("/committee");

  // The committee page lists every protocol in review; scope all interactions
  // to the IACUC-2026-0142 card.
  const card = page.locator(".rounded-lg").filter({ hasText: "IACUC-2026-0142" });
  await expect(card).toBeVisible();

  const selects = card.getByRole("combobox");
  // First select is the voter picker (voters sorted by name); index 1 is a
  // committee-eligible voter other than the default.
  await selects.first().selectOption({ index: 1 });
  await selects.nth(1).selectOption("Approve");
  await card.getByPlaceholder("Comment (optional)").fill("Looks good.");
  await card.getByRole("button", { name: "Cast vote" }).click();

  await expect(card.getByText(/voted Approve/)).toBeVisible();
  await expect(card.getByText(/Looks good/)).toBeVisible();
  await expect(card.getByText("No votes cast yet.")).not.toBeVisible();
});
