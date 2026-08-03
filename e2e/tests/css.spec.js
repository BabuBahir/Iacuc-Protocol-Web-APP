import { test, expect } from "@playwright/test";

// Design tokens the app chrome relies on. These guard against the CSS bundle
// coming back empty or Tailwind silently failing to emit styles: if that
// happens, the computed styles below no longer match and these tests fail.
const HEADER_BG = "rgb(3, 45, 96)";        // #032D60 dark navy app header
const HEADER_FG = "rgb(255, 255, 255)";    // white header text
const BRAND_BLUE = "rgb(1, 118, 211)";     // #0176D3 primary buttons / links
const WHITE = "rgb(255, 255, 255)";
const BORDER_GRAY = "rgb(229, 231, 235)";  // gray-200
const EMERALD_TEXT = "rgb(4, 120, 87)";     // text-emerald-700
const EMERALD_BG = "rgb(236, 253, 245)";    // bg-emerald-50
const RED_TEXT = "rgb(185, 28, 28)";        // text-red-700
const RED_BG = "rgb(254, 242, 242)";        // bg-red-50
const DMR_BG = "rgb(235, 245, 252)";        // bg-[#EBF5FC] designated-member badge
const FCR_BG = "rgb(243, 244, 246)";        // bg-[#F3F4F6] full-committee badge
const MIN_HEADER_HEIGHT = 25; // py-2 + brand row

// The "IACUC Protocols" brand label is the first item inside the dark header
// bar on the dashboard, committee, and admin pages — its parent is the bar.
function headerBar(page) {
  return page.getByText("IACUC Protocols", { exact: true }).locator("xpath=..");
}

test("the dashboard keeps its dark header bar and styled primary button", async ({ page }) => {
  await page.goto("/");

  const header = headerBar(page);
  await expect(header).toBeVisible();
  await expect(header).toHaveCSS("background-color", HEADER_BG);
  await expect(header).toHaveCSS("color", HEADER_FG);
  const headerHeight = await header.evaluate(el => el.getBoundingClientRect().height);
  expect(headerHeight).toBeGreaterThan(MIN_HEADER_HEIGHT);

  const newButton = page.getByRole("button", { name: "New protocol" });
  await expect(newButton).toHaveCSS("background-color", BRAND_BLUE);
  await expect(newButton).toHaveCSS("color", HEADER_FG);
  const buttonPadding = await newButton.evaluate(el =>
    parseFloat(getComputedStyle(el).paddingTop)
  );
  expect(buttonPadding).toBeGreaterThan(0);
});

test("committee and admin pages keep their styled header chrome", async ({ page }) => {
  for (const path of ["/committee", "/admin"]) {
    await page.goto(path);
    const header = headerBar(page);
    await expect(header).toBeVisible();
    await expect(header).toHaveCSS("background-color", HEADER_BG);
    await expect(header).toHaveCSS("color", HEADER_FG);
    const height = await header.evaluate(el => el.getBoundingClientRect().height);
    expect(height).toBeGreaterThan(MIN_HEADER_HEIGHT);
  }
});

test("the detail page keeps its breadcrumb bar", async ({ page }) => {
  await page.goto("/protocols/IACUC-2026-0142");

  const breadcrumb = page.getByRole("button", { name: "IACUC Protocols" }).locator("xpath=..");
  await expect(breadcrumb).toBeVisible();
  await expect(breadcrumb).toHaveCSS("background-color", WHITE);
  await expect(breadcrumb).toHaveCSS("border-bottom-width", "1px");
  await expect(breadcrumb).toHaveCSS("border-bottom-color", BORDER_GRAY);
});

test("the app actually ships a non-empty CSS bundle", async ({ page }) => {
  await page.goto("/");

  // Vite dev injects CSS as <style> tags; sum the cssText of every rule.
  // If Tailwind ever produces an empty/absent stylesheet, this collapses to 0.
  const cssBytes = await page.evaluate(() => {
    let bytes = 0;
    for (const sheet of Array.from(document.styleSheets)) {
      try {
        for (const rule of sheet.cssRules) bytes += rule.cssText?.length ?? 0;
      } catch {
        bytes += (sheet.ownerNode?.textContent ?? "").length;
      }
    }
    return bytes;
  });
  expect(cssBytes).toBeGreaterThan(1000);
});

test("the animal usage register styles within- and over-allowance states distinctly", async ({ page }) => {
  // IACUC-2026-0142 is seeded under its allowance -> green "Within allowance".
  await page.goto("/protocols/IACUC-2026-0142/application");
  const within = page.getByText("Within allowance");
  await expect(within).toBeVisible();
  await expect(within).toHaveCSS("color", EMERALD_TEXT);
  await expect(within).toHaveCSS("background-color", EMERALD_BG);

  // IACUC-2026-0021 is seeded over its Rabbit allowance -> red "Over allowance".
  await page.goto("/protocols/IACUC-2026-0021/application");
  const over = page.getByText("Over allowance");
  await expect(over).toBeVisible();
  await expect(over).toHaveCSS("color", RED_TEXT);
  await expect(over).toHaveCSS("background-color", RED_BG);
});

test("the review-method badge visually distinguishes DMR and FCR protocols", async ({ page }) => {
  await page.goto("/committee");

  // 0142 is seeded as a designated-member review -> blue badge.
  const dmrCard = page.locator(".rounded-lg").filter({ hasText: "IACUC-2026-0142" });
  const dmr = dmrCard.getByLabel("Review method");
  await expect(dmr).toBeVisible();
  await expect(dmr).toHaveCSS("background-color", DMR_BG);
  await expect(dmr).toHaveCSS("color", BRAND_BLUE);

  // 0150 is seeded as a full-committee review -> gray badge.
  const fcrCard = page.locator(".rounded-lg").filter({ hasText: "IACUC-2026-0150" });
  const fcr = fcrCard.getByLabel("Review method");
  await expect(fcr).toBeVisible();
  await expect(fcr).toHaveCSS("background-color", FCR_BG);
});
