import { test, expect } from "@playwright/test";

test("opens a protocol detail page with stages, related items, and study contact", async ({ page }) => {
  await page.goto("/");
  // Click the actual table row, not the static "Recent committee activity"
  // text which also contains the protocol id.
  await page.locator("tbody tr").filter({ hasText: "IACUC-2026-0142" }).click();

  await expect(page.getByRole("heading", { name: "IACUC-2026-0142" })).toBeVisible();
  await expect(
    page.getByText("Neurobehavioral Effects of Chronic Stress in C57BL/6 Mice")
  ).toBeVisible();
  // exact match: the study-contact list also renders "Dr. Elena Marsh — PI".
  await expect(page.getByText("Dr. Elena Marsh", { exact: true })).toBeVisible();

  // Stage stepper shows the full lifecycle (scoped to the stepper: the
  // header status badge also reads "IACUC Review").
  const stepper = page.locator(".items-stretch");
  await expect(stepper.getByText("Veterinary Review")).toBeVisible();
  await expect(stepper.getByText("IACUC Review")).toBeVisible();

  // Related items are grouped with counts.
  await expect(page.getByText("Personnel (3)")).toBeVisible();
  await expect(page.getByText("Attachments (2)")).toBeVisible();

  // Study contact email is derived from the PI.
  await expect(page.getByText("elena@university.edu")).toBeVisible();
});

test("shows the not-found message for an unknown protocol", async ({ page }) => {
  await page.goto("/protocols/NOPE-9999");
  await expect(page.getByText(/Couldn't load NOPE-9999/)).toBeVisible();
});

test("edits a protocol from the detail page", async ({ page }) => {
  // IACUC-2026-0158 is a Draft protocol, so editing its title is safe and
  // doesn't touch the e2e invariants on 0142 (review) or 0064 (Macaque).
  await page.goto("/");
  await page.locator("tbody tr").filter({ hasText: "IACUC-2026-0158" }).click();
  await expect(page.getByRole("heading", { name: "IACUC-2026-0158" })).toBeVisible();

  await page.getByRole("button", { name: "Edit" }).click();
  const titleInput = page.getByLabel("Title");
  await expect(titleInput).toHaveValue("Genetic Basis of Spontaneous Seizures in Zebrafish");
  await titleInput.fill("Genetic Basis of Spontaneous Seizures (edited)");
  await page.getByRole("button", { name: "Save changes" }).click();

  await expect(page.getByText("Genetic Basis of Spontaneous Seizures (edited)")).toBeVisible();
  await expect(page.getByRole("button", { name: "Edit" })).toBeVisible();
});
