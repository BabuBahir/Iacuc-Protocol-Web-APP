import { test, expect } from "@playwright/test";

test("dashboard loads seeded protocols and dashboard metrics", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "IACUC protocol dashboard" })).toBeVisible();
  await expect(page.locator("tbody tr").filter({ hasText: "IACUC-2026-0142" })).toBeVisible();
  await expect(page.locator("tbody tr").filter({ hasText: "IACUC-2025-0064" })).toBeVisible();

  // Dashboard metric cards reflect the seeded data.
  await expect(page.getByText("Active protocols")).toBeVisible();
  await expect(page.getByText("Pending IACUC review")).toBeVisible();
});

test("search filters the protocol list by species", async ({ page }) => {
  await page.goto("/");

  const search = page.getByPlaceholder("Search this list...");
  await search.fill("Mouse");

  // Scope to the table: the recent-activity text also mentions the protocol id.
  await expect(page.locator("tbody tr").filter({ hasText: "IACUC-2026-0142" })).toBeVisible();
  await expect(page.locator("tbody tr").filter({ hasText: "IACUC-2025-0064" })).not.toBeVisible();
});

test("a protocol created via the API appears on the dashboard", async ({ request, page }) => {
  const res = await request.post("http://localhost:4100/api/protocols", {
    data: {
      id: "E2E-0001",
      title: "E2E Created Protocol",
      pi: "Dr. E2E",
      species: "Guinea pig",
    },
  });
  expect(res.status()).toBe(201);

  await page.goto("/");
  await expect(page.locator("tbody tr").filter({ hasText: "E2E-0001" })).toBeVisible();
  await expect(page.getByText("E2E Created Protocol")).toBeVisible();
});
