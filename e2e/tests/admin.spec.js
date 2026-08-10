import { test, expect } from "@playwright/test";
import { actAsOffice } from "../utils/acting-as.js";

test("admin page lists seeded species, roles, and personnel", async ({ page }) => {
  await page.goto("/admin");

  await expect(page.getByRole("heading", { name: "Admin" })).toBeVisible();
  await expect(page.getByText("Mouse")).toBeVisible();
  await expect(page.getByText("Attending Veterinarian").first()).toBeVisible();
  // Personnel names also appear in the transfer panel's PI dropdown, so take
  // the first match (the personnel list row renders before the options).
  await expect(page.getByText("Dr. Priya Nair").first()).toBeVisible();
});

test("adding a species makes it appear in the lookup list", async ({ page, request }) => {
  // Species creation is an office-only mutation (server/src/access.js), so act
  // as the seeded IACUC Coordinator before the page loads.
  await actAsOffice(request, page);
  await page.goto("/admin");

  await page.getByPlaceholder("e.g. Guinea pig").fill("Alpaca");
  await page.getByRole("button", { name: "Add" }).first().click();

  // .first(): the species row renders above the audit log, and the audit
  // panel's slow on-mount fetch can resolve after this add and include a
  // species.created entry whose diff also contains "Alpaca".
  await expect(page.getByText("Alpaca").first()).toBeVisible();
});

test("adding a personnel member and seeing them in the list", async ({ page, request }) => {
  // Personnel creation is an office-only mutation (server/src/access.js), so
  // act as the seeded IACUC Coordinator before the page loads.
  await actAsOffice(request, page);
  await page.goto("/admin");

  await page.getByPlaceholder("Full name").fill("Dr. E2E Reviewer");
  await page.getByPlaceholder("Email (optional)").fill("reviewer@university.edu");
  // The role dropdown is pre-populated from seeded roles, but the form's
  // role_id only gets set once the roles fetch resolves — the submit handler
  // returns early while it's empty, so wait for a value before clicking to
  // avoid racing the fetch. The personnel panel's submit button has no
  // accessible name, so scope to its form.
  const personnelForm = page.getByPlaceholder("Full name").locator("xpath=ancestor::form");
  const roleSelect = personnelForm.locator("select");
  await expect(roleSelect).not.toHaveValue("");
  await personnelForm.getByRole("button").click();

  // The new person also appears in the transfer panel's PI dropdown, so take
  // the first match (the personnel list row renders before the options).
  await expect(page.getByText("Dr. E2E Reviewer").first()).toBeVisible();
  await expect(page.getByText(/reviewer@university.edu/)).toBeVisible();
});
