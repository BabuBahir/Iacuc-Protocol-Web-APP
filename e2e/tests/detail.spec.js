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

  await page.getByRole("button", { name: "Edit", exact: true }).click();
  const titleInput = page.getByLabel("Title");
  await expect(titleInput).toHaveValue("Genetic Basis of Spontaneous Seizures in Zebrafish");
  await titleInput.fill("Genetic Basis of Spontaneous Seizures (edited)");
  await page.getByRole("button", { name: "Save changes" }).click();

  await expect(page.getByText("Genetic Basis of Spontaneous Seizures (edited)")).toBeVisible();
  await expect(page.getByRole("button", { name: "Edit", exact: true })).toBeVisible();
});

test("opens the Appendix A application page pre-filled from seeded data", async ({ page }) => {
  // IACUC-2026-0142 has full seeded Appendix A content (procedures, drugs,
  // animal use, alternatives). This test only reads, so it can't disturb the
  // committee invariant that 0142 stays vote-free.
  await page.goto("/");
  await page.locator("tbody tr").filter({ hasText: "IACUC-2026-0142" }).click();
  await expect(page.getByRole("heading", { name: "IACUC-2026-0142" })).toBeVisible();

  await page.getByRole("button", { name: "Edit application" }).click();
  await expect(
    page.getByRole("heading", { name: "Application details — IACUC-2026-0142" })
  ).toBeVisible();

  // Seeded procedure checklist with a checked item.
  await expect(page.getByText("Procedures applied to animals")).toBeVisible();
  await expect(page.getByRole("checkbox", { name: "Breeding" })).toBeChecked();

  // Seeded drug row renders in the dosing table.
  await expect(page.getByRole("cell", { name: "Isoflurane", exact: true })).toBeVisible();
  await expect(page.getByRole("cell", { name: "Mouse / C57BL/6", exact: true })).toBeVisible();

  // Seeded experiment row renders with its detail fields.
  await expect(page.getByText("Experiments").first()).toBeVisible();
  await expect(page.getByText("Chronic restraint stress paradigm")).toBeVisible();
  await expect(
    page.getByText("Animals checked twice daily for fur quality, posture, and responsiveness; LAMS consulted if any animal shows sustained clinical signs.")
  ).toBeVisible();

  // Seeded 3 Rs literature search content.
  await expect(page.getByText("3 Rs & alternatives").first()).toBeVisible();
  await expect(
    page.getByText("Review of 3R alternatives confirmed no non-animal model reproduces the neuroendocrine phenotype.")
  ).toBeVisible();

  // Seeded structured 3 Rs justifications (one entry per R).
  await expect(page.getByText("Screening of non-animal models")).toBeVisible();
  await expect(page.getByText("Welfare refinement of procedures")).toBeVisible();
  await expect(page.getByText("Statistical and experimental design")).toBeVisible();

  // Submission readiness panel: 0142 is a review protocol, not a draft, so
  // it shows the status readout rather than a submit button.
  await expect(page.getByText("Submission readiness")).toBeVisible();
  await expect(page.getByText("Status: IACUC Review")).toBeVisible();
});

test("adds an experiment to a draft protocol from the application page", async ({ page }) => {
  // IACUC-2026-0158 is a Draft protocol; adding an experiment to it is safe
  // and doesn't touch the e2e invariants on 0142 (review, vote-free) or 0064.
  await page.goto("/");
  await page.locator("tbody tr").filter({ hasText: "IACUC-2026-0158" }).click();
  await expect(page.getByRole("heading", { name: "IACUC-2026-0158" })).toBeVisible();

  await page.getByRole("button", { name: "Edit application" }).click();
  await expect(
    page.getByRole("heading", { name: "Application details — IACUC-2026-0158" })
  ).toBeVisible();

  await page.getByRole("button", { name: "Add experiment" }).click();
  await page.getByLabel("Experiment name").fill("Larval locomotor activity assay");
  await page.getByLabel("Detailed description").fill("Score movement of 5 dpf larvae in a 24-well plate over 10 minutes.");
  await page.getByRole("button", { name: "Save experiment" }).click();

  await expect(page.getByText("Larval locomotor activity assay")).toBeVisible();
  await expect(
    page.getByText("Score movement of 5 dpf larvae in a 24-well plate over 10 minutes.")
  ).toBeVisible();
});

test("submits a fully-seeded draft protocol from the application page", async ({ page }) => {
  // IACUC-2026-0158 is a Draft protocol with every Appendix A section seeded,
  // so its Submit button is enabled and the server accepts the transition.
  await page.goto("/");
  await page.locator("tbody tr").filter({ hasText: "IACUC-2026-0158" }).click();
  await expect(page.getByRole("heading", { name: "IACUC-2026-0158" })).toBeVisible();

  await page.getByRole("button", { name: "Edit application" }).click();
  await expect(
    page.getByRole("heading", { name: "Application details — IACUC-2026-0158" })
  ).toBeVisible();

  const submitButton = page.getByRole("button", { name: "Submit protocol" });
  await expect(submitButton).toBeEnabled();
  await submitButton.click();

  await expect(page.getByText("Protocol submitted for review.")).toBeVisible();
  await expect(page.getByText("Status: Submitted")).toBeVisible();
});

test("keeps submission blocked on an incomplete draft protocol", async ({ page, request }) => {
  // IACUC-2026-0021 is a sparse Draft protocol with no Appendix A content.
  await page.goto("/");
  await page.locator("tbody tr").filter({ hasText: "IACUC-2026-0021" }).click();
  await expect(page.getByRole("heading", { name: "IACUC-2026-0021" })).toBeVisible();

  await page.getByRole("button", { name: "Edit application" }).click();
  await expect(
    page.getByRole("heading", { name: "Application details — IACUC-2026-0021" })
  ).toBeVisible();

  // The UI gates submission behind validation, so the button is disabled.
  await expect(page.getByRole("button", { name: "Submit protocol" })).toBeDisabled();

  // Defense in depth: a direct API call to bypass the UI is rejected too.
  const res = await request.patch("/api/protocols/IACUC-2026-0021", {
    data: { status: "Submitted" },
  });
  expect(res.status()).toBe(400);
  expect((await res.json()).validation.overall).toBe(false);
});
