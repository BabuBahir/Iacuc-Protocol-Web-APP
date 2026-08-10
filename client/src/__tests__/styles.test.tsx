import { describe, test, expect } from "vitest";
import "../index.css";

describe("CSS pipeline", () => {
  test("index.css compiles to a real stylesheet through tailwind/postcss", () => {
    const styles = Array.from(document.querySelectorAll("style"))
      .map((el) => el.textContent ?? "")
      .join("\n");

    expect(styles.length).toBeGreaterThan(1000);
    expect(styles.toLowerCase()).toContain("032d60");
  });
});
