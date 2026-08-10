import { test, expect } from "@playwright/test";
import fs from "node:fs";

// AAALAC-style compliance reports (Roadmap item 9). The Reports tab renders
// six canned tables aggregated from seeded Appendix A content, each with a
// CSV export.
test("reports page shows the six canned tables with seeded content", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Reports" }).click();
  await expect(page).toHaveURL(/\/reports/);

  await expect(page.getByRole("heading", { name: "Compliance reports" })).toBeVisible();

  // All six table titles.
  for (const title of [
    "Restraint by species",
    "Euthanasia methods by species",
    "Surgery locations and types",
    "Multiple major recovery surgery",
    "Analgesic and anesthetic drugs",
    "Use locations by species",
  ]) {
    await expect(page.getByText(title)).toBeVisible();
  }

  // Restraint fixture: IACUC-2026-0150's prolonged_restraint narrative.
  await expect(page.getByText("Rats briefly restrained in a holding tube during stimulation sessions.")).toBeVisible();

  // Euthanasia methods by species (drug = method).
  await expect(page.getByText("Pentobarbital").first()).toBeVisible();
  await expect(page.getByText("Tricaine methanesulfonate (MS-222)").first()).toBeVisible();

  // Surgery locations: research-plan steps on the surgery protocols.
  await expect(page.getByText("Surgical suite A").first()).toBeVisible();
  await expect(page.getByText("Surgical suite B").first()).toBeVisible();

  // Analgesic / anesthetic drugs.
  await expect(page.getByText("Isoflurane").first()).toBeVisible();
  await expect(page.getByText("Buprenorphine").first()).toBeVisible();
});

test("reports CSV export downloads a file with header and data rows", async ({ page }) => {
  await page.goto("/reports");
  await expect(page.getByText("Rats briefly restrained in a holding tube during stimulation sessions.")).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  // The first Download CSV button belongs to the restraint-by-species report.
  await page.getByRole("button", { name: "Download CSV" }).first().click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toBe("restraint-by-species.csv");
  const path = await download.path();
  const content = fs.readFileSync(path, "utf8");
  expect(content).toContain("Protocol,Species,Restraint method");
  expect(content).toContain("IACUC-2026-0150");
  expect(content).toContain("holding tube");
});
