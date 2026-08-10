import { describe, test, expect, vi, beforeEach } from "vitest";
import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import FilterBuilder from "../FilterBuilder";
import { PROTOCOL_FILTER_FIELD_DEFS } from "../../types";
import type { FilterClause } from "../../types";

const noop = () => {};

// Stateful wrapper mirroring real usage: the parent holds the clauses in state
// and passes setState as onChange. Without the re-render, a controlled input's
// value prop stays stale and keystrokes replace instead of accumulate.
function Harness({ initial }: { initial: FilterClause[] }) {
  const [clauses, setClauses] = useState(initial);
  return <FilterBuilder fieldDefs={PROTOCOL_FILTER_FIELD_DEFS} clauses={clauses} onChange={setClauses} />;
}

describe("FilterBuilder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("renders an empty-state hint when no clauses exist", () => {
    render(<FilterBuilder fieldDefs={PROTOCOL_FILTER_FIELD_DEFS} clauses={[]} onChange={noop} />);
    expect(screen.getByText(/No filters applied/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add clause" })).toBeInTheDocument();
  });

  test("adds a clause seeded with the first field and its first operator", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<FilterBuilder fieldDefs={PROTOCOL_FILTER_FIELD_DEFS} clauses={[]} onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: "Add clause" }));
    expect(onChange).toHaveBeenCalledWith([{ field: "id", op: "eq", value: "" }]);
  });

  test("renders one row per incoming clause", () => {
    const clauses: FilterClause[] = [
      { field: "status", op: "eq", value: "Active" },
      { field: "title", op: "contains", value: "cancer" },
    ];
    render(<FilterBuilder fieldDefs={PROTOCOL_FILTER_FIELD_DEFS} clauses={clauses} onChange={noop} />);
    expect(screen.getAllByTestId(/^filter-clause-/).length).toBe(2);
    expect(screen.getByDisplayValue("Active")).toBeInTheDocument();
    expect(screen.getByDisplayValue("cancer")).toBeInTheDocument();
  });

  test("editing a clause value accumulates the typed text", async () => {
    const user = userEvent.setup();
    render(<Harness initial={[{ field: "title", op: "contains", value: "" }]} />);

    await user.type(screen.getByLabelText("Filter 1 value"), "cancer");
    expect(screen.getByDisplayValue("cancer")).toBeInTheDocument();
  });

  test("changing the field resets the operator when it is no longer valid", async () => {
    const user = userEvent.setup();
    const clauses: FilterClause[] = [{ field: "title", op: "contains", value: "" }];
    const onChange = vi.fn();
    render(<FilterBuilder fieldDefs={PROTOCOL_FILTER_FIELD_DEFS} clauses={clauses} onChange={onChange} />);

    await user.selectOptions(screen.getByLabelText("Filter 1 field"), "status");
    expect(onChange).toHaveBeenLastCalledWith([{ field: "status", op: "eq", value: "" }]);
  });

  test("changing the field keeps a still-valid operator", async () => {
    const user = userEvent.setup();
    const clauses: FilterClause[] = [{ field: "title", op: "eq", value: "" }];
    const onChange = vi.fn();
    render(<FilterBuilder fieldDefs={PROTOCOL_FILTER_FIELD_DEFS} clauses={clauses} onChange={onChange} />);

    await user.selectOptions(screen.getByLabelText("Filter 1 field"), "pi");
    expect(onChange).toHaveBeenLastCalledWith([{ field: "pi", op: "eq", value: "" }]);
  });

  test("removing a clause calls onChange without it", async () => {
    const user = userEvent.setup();
    const clauses: FilterClause[] = [
      { field: "status", op: "eq", value: "Active" },
      { field: "title", op: "contains", value: "cancer" },
    ];
    const onChange = vi.fn();
    render(<FilterBuilder fieldDefs={PROTOCOL_FILTER_FIELD_DEFS} clauses={clauses} onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: "Remove filter 1" }));
    expect(onChange).toHaveBeenCalledWith([{ field: "title", op: "contains", value: "cancer" }]);
  });

  test("clear all empties the clause list", async () => {
    const user = userEvent.setup();
    const clauses: FilterClause[] = [{ field: "status", op: "eq", value: "Active" }];
    const onChange = vi.fn();
    render(<FilterBuilder fieldDefs={PROTOCOL_FILTER_FIELD_DEFS} clauses={clauses} onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: "Clear all" }));
    expect(onChange).toHaveBeenCalledWith([]);
  });
});
