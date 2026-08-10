import { describe, test, expect, beforeEach } from "vitest";
import { getActingAs, setActingAs, onActingAsChange, ACTOR_HEADER_NAME } from "../identity";
import type { ActingAs } from "../identity";

describe("identity.ts", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test("returns null when nothing has been set", () => {
    expect(getActingAs()).toBeNull();
  });

  test("setActingAs persists and getActingAs retrieves it", () => {
    setActingAs({ personnelId: 5, name: "Dr. Test", roleName: "Committee Member" });
    expect(getActingAs()).toEqual({ personnelId: 5, name: "Dr. Test", roleName: "Committee Member" });
  });

  test("setActingAs(null) clears the stored identity", () => {
    setActingAs({ personnelId: 5, name: "Dr. Test", roleName: "Committee Member" });
    setActingAs(null);
    expect(getActingAs()).toBeNull();
  });

  test("onActingAsChange notifies listeners on change and unsubscribe stops it", () => {
    const seen: Array<ActingAs | null> = [];
    const unsubscribe = onActingAsChange(() => seen.push(getActingAs()));

    setActingAs({ personnelId: 1, name: "Dr. A", roleName: "PI" });
    setActingAs(null);
    unsubscribe();
    setActingAs({ personnelId: 2, name: "Dr. B", roleName: "PI" });

    expect(seen).toEqual([
      { personnelId: 1, name: "Dr. A", roleName: "PI" },
      null,
    ]);
  });

  test("survives a fresh getActingAs call after being set (simulates a page reload)", () => {
    setActingAs({ personnelId: 9, name: "Dr. Reload", roleName: "PI" });
    // A second, independent read — same as what happens across a reload
    // since this all comes from localStorage, not in-memory state.
    const first = getActingAs();
    const second = getActingAs();
    expect(first).toEqual(second);
  });

  test("fails open (returns null) on corrupted localStorage content", () => {
    localStorage.setItem("iacuc.actingAs", "{not valid json");
    expect(getActingAs()).toBeNull();
  });

  test("fails open (returns null) on a validly-parsed but wrong-shaped value", () => {
    localStorage.setItem("iacuc.actingAs", JSON.stringify({ foo: "bar" }));
    expect(getActingAs()).toBeNull();
  });

  test("ACTOR_HEADER_NAME matches the header the backend's resolveActor() checks first", () => {
    // This is a contract test: the whole feature is only correct if this
    // string matches server/src/audit.js's req.get("x-actor") check
    // (HTTP header names are case-insensitive, so casing here is cosmetic,
    // but the value itself must match).
    expect(ACTOR_HEADER_NAME.toLowerCase()).toBe("x-actor");
  });
});
