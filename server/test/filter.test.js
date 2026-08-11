import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  validateFilters,
  applyFilters,
  matchesFilter,
  PROTOCOL_FILTER_FIELDS,
} from "../src/routes/filter.js";

// filter.js is a pure module (no DB), so these run directly against it rather
// than through an HTTP route — faster, and pins down the exact contract
// (validateFilters returning null vs. an error string) that every route
// using it (protocols, animal-usage, saved-filters) depends on.

describe("validateFilters — non-primitive value rejection (regression)", () => {
  test("rejects an object value on a text field", () => {
    const err = validateFilters(
      [{ field: "title", op: "contains", value: { nested: "x" } }],
      PROTOCOL_FILTER_FIELDS
    );
    assert.match(err, /must be a string or number/);
  });

  test("rejects an array value on a text field", () => {
    const err = validateFilters(
      [{ field: "title", op: "contains", value: ["x"] }],
      PROTOCOL_FILTER_FIELDS
    );
    assert.match(err, /must be a string or number/);
    assert.match(err, /an array/); // array gets a more specific message than "object"
  });

  test("rejects an object value on a date field (routes through NUMERIC_OPS, was previously unguarded)", () => {
    const err = validateFilters(
      [{ field: "expires", op: "gt", value: { nested: "x" } }],
      PROTOCOL_FILTER_FIELDS
    );
    assert.match(err, /must be a string or number/);
  });

  test("rejects an array value on an enum field", () => {
    const err = validateFilters(
      [{ field: "status", op: "eq", value: ["Draft"] }],
      PROTOCOL_FILTER_FIELDS
    );
    assert.match(err, /must be a string or number/);
  });

  test("rejects a boolean value (also not string or number)", () => {
    const err = validateFilters(
      [{ field: "title", op: "contains", value: true }],
      PROTOCOL_FILTER_FIELDS
    );
    assert.match(err, /must be a string or number/);
  });

  test("still accepts a normal string value on a text field", () => {
    const err = validateFilters(
      [{ field: "title", op: "contains", value: "normal text" }],
      PROTOCOL_FILTER_FIELDS
    );
    assert.equal(err, null);
  });

  test("still accepts a normal number value on a numeric field", () => {
    const err = validateFilters([{ field: "animals", op: "gt", value: 5 }], PROTOCOL_FILTER_FIELDS);
    assert.equal(err, null);
  });

  test("still accepts a numeric-looking string value on a numeric field (matches existing coercion behavior)", () => {
    const err = validateFilters([{ field: "animals", op: "gt", value: "5" }], PROTOCOL_FILTER_FIELDS);
    assert.equal(err, null);
  });
});

describe("matchesFilter / applyFilters — confirms the crash is actually gone end-to-end", () => {
  test(
    "a filter set that validateFilters rejects is never passed to applyFilters " +
      "in real route code, but applyFilters itself should not be the only thing " +
      "standing between a bad value and a crash — verify matchesFilter throws " +
      "predictably (not silently) if ever called directly with a bad value, so " +
      "future callers don't assume it's safe to skip validateFilters",
    () => {
      const def = PROTOCOL_FILTER_FIELDS.title;
      assert.throws(
        () => matchesFilter({ title: "Some Title" }, { field: "title", op: "contains", value: {} }, def),
        /toLowerCase is not a function/
      );
    }
  );

  test("applyFilters with a validated (string) value works correctly, for contrast", () => {
    const rows = [{ id: "A", title: "Mouse study" }, { id: "B", title: "Rat study" }];
    const result = applyFilters(rows, [{ field: "title", op: "contains", value: "mouse" }], PROTOCOL_FILTER_FIELDS);
    assert.deepEqual(result.map(r => r.id), ["A"]);
  });
});
