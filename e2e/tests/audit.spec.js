import { test, expect } from "@playwright/test";
import { actAsOffice } from "../utils/acting-as.js";

// Audit log (Roadmap item 11). The admin page renders the append-only trail;
// a mutation performed in the UI must show up as a new entry with a
// human-readable actor and action.
test("a species mutation appears in the audit log panel", async ({ page, request }) => {
  // Species creation is an office-only mutation (server/src/access.js), so act
  // as the seeded IACUC Coordinator before the page loads.
  await actAsOffice(request, page);
  await page.goto("/admin");

  // Perform a mutation the audit trail will capture.
  await page.getByPlaceholder("e.g. Guinea pig").fill("Chinchilla");
  await page.getByRole("button", { name: "Add" }).first().click();
  // .first(): the species row renders above the audit log, and the audit
  // panel's slow on-mount fetch can resolve after this add and include a
  // species.created entry whose diff also contains "Chinchilla".
  await expect(page.getByText("Chinchilla").first()).toBeVisible();

  // The audit panel sits below the transfer panel. It loads on mount (before
  // the mutation), so Apply/refresh to pull the new entry — recorded with the
  // actor we're acting as (Maya Patel, via the X-Actor header). Earlier tests
  // may have created other species (e.g. admin.spec's Alpaca), so multiple
  // species.created entries can be present — take the first.
  await expect(page.getByText("Audit log").first()).toBeVisible();
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page.getByTestId("audit-entries").getByText("species.created").first()).toBeVisible();
  await expect(page.getByTestId("audit-entries").getByText("Chinchilla")).toBeVisible();

  // Filtering by the action narrows the trail to that entry type.
  await page.getByLabel("Filter by action").fill("species");
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page.getByTestId("audit-entries").getByText("species.created").first()).toBeVisible();
});
