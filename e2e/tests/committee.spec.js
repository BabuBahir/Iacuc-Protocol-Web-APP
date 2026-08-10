import { test, expect } from "@playwright/test";
import { actAsOffice } from "../utils/acting-as.js";

test("committee page lists protocols in review with method, assignments, and comments", async ({ page }) => {
  await page.goto("/committee");

  await expect(page.getByRole("heading", { name: "Full Committee Review" })).toBeVisible();
  await expect(page.getByText("IACUC-2026-0142")).toBeVisible();
  await expect(page.getByText("No votes cast yet.")).toBeVisible();

  // 0142 is a designated-member review with a seeded assignment and comment.
  const card = page.locator(".rounded-lg").filter({ hasText: "IACUC-2026-0142" });
  await expect(card.getByLabel("Review method")).toHaveValue("DMR");
  const assignment = card.getByText("Dr. Sofia Ramos", { exact: true }).locator("xpath=..");
  await expect(assignment).toContainText("Designated Member");
  await expect(card.getByText(/daily restraint duration is capped at 2 h/)).toBeVisible();
});

test("assigns a reviewer and posts a section comment", async ({ page }) => {
  await page.goto("/committee");

  // Scope to a protocol that already has FCR votes, so the write test doesn't
  // disturb the vote-free 0142 fixture used by the vote-casting test.
  const card = page.locator(".rounded-lg").filter({ hasText: "IACUC-2026-0147" });
  await expect(card).toBeVisible();

  await card.getByLabel("Assignee").selectOption({ index: 1 }); // Dr. Harold Kim
  await card.getByLabel("Assignment role").selectOption("Designated Member");
  await card.getByRole("button", { name: "Assign" }).click();

  const assignment = card.getByText("Dr. Harold Kim", { exact: true }).locator("xpath=..");
  await expect(assignment).toContainText("Designated Member");

  await card.getByPlaceholder("Add section feedback…").fill("Clarify the humane endpoint criteria.");
  await card.getByRole("button", { name: "Add comment" }).click();

  await expect(card.getByText(/Clarify the humane endpoint criteria/)).toBeVisible();
});

test("switches a protocol's review method between FCR and DMR", async ({ page, request }) => {
  // Review-method is office-gated (server/src/access.js) and its body carries no
  // identity, unlike votes/comments/assignments (which resolve the persona from
  // body personnel_id). Without a persona the PATCH 401s and the select's
  // optimistic state makes this test pass spuriously — so act as the office.
  await actAsOffice(request, page);
  await page.goto("/committee");

  const card = page.locator(".rounded-lg").filter({ hasText: "IACUC-2026-0150" });
  await expect(card).toBeVisible();
  await expect(card.getByLabel("Review method")).toHaveValue("FCR");

  await card.getByLabel("Review method").selectOption("DMR");
  await expect(card.getByLabel("Review method")).toHaveValue("DMR");

  await card.getByLabel("Review method").selectOption("FCR");
  await expect(card.getByLabel("Review method")).toHaveValue("FCR");
});

test("casting a vote updates the tally and vote history", async ({ page }) => {
  await page.goto("/committee");

  // The committee page lists every protocol in review; scope all interactions
  // to the IACUC-2026-0142 card. Combobox order on a card is: review method,
  // voter picker, vote, assignee, role, commenter, section.
  const card = page.locator(".rounded-lg").filter({ hasText: "IACUC-2026-0142" });
  await expect(card).toBeVisible();

  const selects = card.getByRole("combobox");
  // Index 1 is the voter picker (voters sorted by name; index 1 is a
  // committee-eligible voter other than the default); index 2 is the vote.
  await selects.nth(1).selectOption({ index: 1 });
  await selects.nth(2).selectOption("Approve");
  await card.getByPlaceholder("Comment (optional)").fill("Looks good.");
  await card.getByRole("button", { name: "Cast vote" }).click();

  await expect(card.getByText(/voted Approve/)).toBeVisible();
  await expect(card.getByText(/Looks good/)).toBeVisible();
  await expect(card.getByText("No votes cast yet.")).not.toBeVisible();
});
