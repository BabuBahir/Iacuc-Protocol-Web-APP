import { test, expect } from "@playwright/test";

// Design tokens the app chrome relies on. These guard against the CSS bundle
// coming back empty or Tailwind silently failing to emit styles: if that
// happens, the computed styles below no longer match and these tests fail.
const HEADER_BG = "rgb(3, 45, 96)";        // #032D60 dark navy app header
const HEADER_FG = "rgb(255, 255, 255)";    // white header text
const BRAND_BLUE = "rgb(1, 118, 211)";     // #0176D3 primary buttons / links
const WHITE = "rgb(255, 255, 255)";
const BORDER_GRAY = "rgb(229, 231, 235)";  // gray-200
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
