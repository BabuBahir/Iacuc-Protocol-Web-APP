import { test, expect } from "@playwright/test";

// Audit log (Roadmap item 11). The admin page renders the append-only trail;
// a mutation performed in the UI must show up as a new entry with a
// human-readable actor and action.
test("a species mutation appears in the audit log panel", async ({ page }) => {
  await page.goto("/admin");

  // Perform a mutation the audit trail will capture.
  await page.getByPlaceholder("e.g. Guinea pig").fill("Chinchilla");
  await page.getByRole("button", { name: "Add" }).first().click();
  await expect(page.getByText("Chinchilla")).toBeVisible();

  // The audit panel sits below the transfer panel. It loads on mount (before
  // the mutation), so Apply/refresh to pull the new entry — recorded with the
  // actor 'system' until auth exists.
  await expect(page.getByText("Audit log").first()).toBeVisible();
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page.getByText("species.created")).toBeVisible();
  await expect(page.getByTestId("audit-entries").getByText("Chinchilla")).toBeVisible();

  // Filtering by the action narrows the trail to that entry type.
  await page.getByLabel("Filter by action").fill("species");
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page.getByText("species.created")).toBeVisible();
});
