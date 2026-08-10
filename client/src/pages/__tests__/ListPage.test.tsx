import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useNavigate } from "react-router";
import ListPage from "../ListPage";
import { api as realApi } from "../../api";
import type { FilterClause, Protocol, SavedFilter, Summary } from "../../types";

vi.mock("../../api", () => ({
  api: {
    listProtocols: vi.fn(),
    getSummary: vi.fn(),
    getAuditLog: vi.fn(),
    listSavedFilters: vi.fn(),
    saveSavedFilter: vi.fn(),
    deleteSavedFilter: vi.fn(),
  },
}));

vi.mock("react-router", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...(actual as object), useNavigate: vi.fn() };
});

const api = vi.mocked(realApi);

function renderListPage() {
  return render(
    <MemoryRouter>
      <ListPage />
    </MemoryRouter>
  );
}

const SAMPLE_PROTOCOLS: Protocol[] = [
  {
    id: "IACUC-2026-0001",
    title: "Test protocol one",
    pi: "Dr. One",
    pi_proxy: null,
    ptm_member: null,
    protocol_type: null,
    species: "Mouse",
    status: "Active",
    animals: 10,
    pain_category: null,
    anesthesia_required: 0,
    housing: null,
    disposal: null,
    npg: null,
    research_steps: [],
    purpose_summary: null,
    harm_benefit_analysis: null,
    scientific_summary: null,
    submitted: null,
    expires: null,
  },
  {
    id: "IACUC-2026-0002",
    title: "Test protocol two",
    pi: "Dr. Two",
    pi_proxy: null,
    ptm_member: null,
    protocol_type: null,
    species: "Rat",
    status: "Draft",
    animals: 5,
    pain_category: null,
    anesthesia_required: 0,
    housing: null,
    disposal: null,
    npg: null,
    research_steps: [],
    purpose_summary: null,
    harm_benefit_analysis: null,
    scientific_summary: null,
    submitted: null,
    expires: null,
  },
];

const SAMPLE_SUMMARY: Summary = { active: 2, pendingReview: 1, expiringSoon: 0, approvedThisQuarter: 3 };
const EMPTY_SUMMARY: Summary = { active: 0, pendingReview: 0, expiringSoon: 0, approvedThisQuarter: 0 };

const DRAFT_FILTER: FilterClause[] = [{ field: "status", op: "eq", value: "Draft" }];

const SAVED_FILTER: SavedFilter = {
  id: 1,
  name: "Draft protocols",
  search_type: "protocol",
  filters: DRAFT_FILTER,
  created_at: "2026-08-01T00:00:00.000Z",
};

async function resolveInitialLoad() {
  await waitFor(() => {
    expect(screen.getByText("IACUC-2026-0001")).toBeInTheDocument();
  });
}

describe("ListPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.listSavedFilters.mockResolvedValue([]);
    api.getAuditLog.mockResolvedValue([]);
  });

  test("shows a loading state before data resolves", () => {
    api.listProtocols.mockReturnValue(new Promise<Protocol[]>(() => {})); // never resolves
    api.getSummary.mockReturnValue(new Promise<Summary>(() => {}));
    api.getAuditLog.mockReturnValue(new Promise<any>(() => {}));

    renderListPage();
    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });

  test("renders protocols and summary metrics once data resolves", async () => {
    api.listProtocols.mockResolvedValue(SAMPLE_PROTOCOLS);
    api.getSummary.mockResolvedValue(SAMPLE_SUMMARY);

    renderListPage();

    await waitFor(() => {
      expect(screen.getByText("IACUC-2026-0001")).toBeInTheDocument();
    });
    expect(screen.getByText("Test protocol two")).toBeInTheDocument();
    expect(screen.getByText("Dr. One")).toBeInTheDocument();
    expect(screen.getByText("2 items")).toBeInTheDocument();
  });

  test("shows an error message if the API call fails", async () => {
    api.listProtocols.mockRejectedValue(new Error("Network error"));
    api.getSummary.mockRejectedValue(new Error("Network error"));

    renderListPage();

    await waitFor(() => {
      expect(screen.getByText(/Couldn't load protocols/)).toBeInTheDocument();
    });
  });

  test("shows an empty state when no protocols match", async () => {
    api.listProtocols.mockResolvedValue([]);
    api.getSummary.mockResolvedValue(SAMPLE_SUMMARY);

    renderListPage();

    await waitFor(() => {
      expect(screen.getByText(/No protocols/)).toBeInTheDocument();
    });
  });

  test("typing in the search box re-queries the API with the new query", async () => {
    api.listProtocols.mockResolvedValue(SAMPLE_PROTOCOLS);
    api.getSummary.mockResolvedValue(SAMPLE_SUMMARY);
    const user = userEvent.setup();

    renderListPage();
    await waitFor(() => expect(api.listProtocols).toHaveBeenCalledWith("", []));

    const searchInput = screen.getByPlaceholderText("Search this list...");
    await user.type(searchInput, "mouse");

    await waitFor(() => {
      expect(api.listProtocols).toHaveBeenLastCalledWith("mouse", []);
    });
  });

  test("New protocol button navigates to the create page", async () => {
    api.listProtocols.mockResolvedValue(SAMPLE_PROTOCOLS);
    api.getSummary.mockResolvedValue(SAMPLE_SUMMARY);
    const navigate = vi.fn();
    vi.mocked(useNavigate).mockReturnValue(navigate);
    const user = userEvent.setup();

    renderListPage();
    await resolveInitialLoad();

    await user.click(screen.getByRole("button", { name: "New protocol" }));
    expect(navigate).toHaveBeenCalledWith("/protocols/new");
  });

  describe("filter-builder", () => {
    test("adding a clause re-queries with the filters payload", async () => {
      api.listProtocols.mockResolvedValue(SAMPLE_PROTOCOLS);
      api.getSummary.mockResolvedValue(SAMPLE_SUMMARY);
      const user = userEvent.setup();

      renderListPage();
      await resolveInitialLoad();

      await user.click(screen.getByRole("button", { name: /Filters/ }));
      await user.click(screen.getByRole("button", { name: "Add clause" }));

      const valueInput = screen.getByLabelText("Filter 1 value");
      await user.type(valueInput, "IACUC-2026");

      await waitFor(() => {
        expect(api.listProtocols).toHaveBeenLastCalledWith("", [
          { field: "id", op: "eq", value: "IACUC-2026" },
        ]);
      });
    });

    test("enum fields render a value select and eq/neq-only operators", async () => {
      api.listProtocols.mockResolvedValue(SAMPLE_PROTOCOLS);
      api.getSummary.mockResolvedValue(SAMPLE_SUMMARY);
      const user = userEvent.setup();

      renderListPage();
      await resolveInitialLoad();

      await user.click(screen.getByRole("button", { name: /Filters/ }));
      await user.click(screen.getByRole("button", { name: "Add clause" }));

      await user.selectOptions(screen.getByLabelText("Filter 1 field"), "status");
      const opSelect = screen.getByLabelText("Filter 1 operator");
      const ops = Array.from(opSelect.querySelectorAll("option")).map(o => o.textContent);
      expect(ops).toEqual(["is", "is not"]);

      const valueSelect = screen.getByLabelText("Filter 1 value");
      const values = Array.from(valueSelect.querySelectorAll("option")).map(o => o.textContent);
      expect(values).toContain("Active");
      expect(values).toContain("Draft");

      await user.selectOptions(valueSelect, "Draft");
      await waitFor(() => {
        expect(api.listProtocols).toHaveBeenLastCalledWith("", DRAFT_FILTER);
      });
    });

    test("removing a clause clears the filter payload", async () => {
      api.listProtocols.mockResolvedValue(SAMPLE_PROTOCOLS);
      api.getSummary.mockResolvedValue(SAMPLE_SUMMARY);
      const user = userEvent.setup();

      renderListPage();
      await resolveInitialLoad();

      await user.click(screen.getByRole("button", { name: /Filters/ }));
      await user.click(screen.getByRole("button", { name: "Add clause" }));
      await user.type(screen.getByLabelText("Filter 1 value"), "X");

      await user.click(screen.getByRole("button", { name: "Remove filter 1" }));
      await waitFor(() => {
        expect(api.listProtocols).toHaveBeenLastCalledWith("", []);
      });
    });

    test("clear all removes every clause and shows a chip-free state", async () => {
      api.listProtocols.mockResolvedValue(SAMPLE_PROTOCOLS);
      api.getSummary.mockResolvedValue(SAMPLE_SUMMARY);
      const user = userEvent.setup();

      renderListPage();
      await resolveInitialLoad();

      await user.click(screen.getByRole("button", { name: /Filters/ }));
      await user.click(screen.getByRole("button", { name: "Add clause" }));
      await user.type(screen.getByLabelText("Filter 1 value"), "X");
      await waitFor(() => expect(screen.getAllByTestId("active-filter-chip").length).toBe(1));

      await user.click(screen.getByRole("button", { name: "Clear all filters" }));
      expect(screen.queryByTestId("active-filter-chip")).not.toBeInTheDocument();
      await waitFor(() => {
        expect(api.listProtocols).toHaveBeenLastCalledWith("", []);
      });
    });
  });

  describe("saved filters", () => {
    test("applying a saved filter re-queries with its clauses", async () => {
      api.listProtocols.mockResolvedValue(SAMPLE_PROTOCOLS);
      api.getSummary.mockResolvedValue(SAMPLE_SUMMARY);
      api.listSavedFilters.mockResolvedValue([SAVED_FILTER]);
      const user = userEvent.setup();

      renderListPage();
      await resolveInitialLoad();

      await user.click(screen.getByRole("button", { name: "Saved filters" }));
      await user.click(screen.getByRole("button", { name: /^Draft protocols/ }));

      await waitFor(() => {
        expect(api.listProtocols).toHaveBeenLastCalledWith("", DRAFT_FILTER);
      });
      expect(screen.getByTestId("active-filter-chip")).toBeInTheDocument();
    });

    test("saving the current filter posts it and refreshes the list", async () => {
      api.listProtocols.mockResolvedValue(SAMPLE_PROTOCOLS);
      api.getSummary.mockResolvedValue(SAMPLE_SUMMARY);
      api.saveSavedFilter.mockResolvedValue({ ...SAVED_FILTER, name: "My filter" });
      const user = userEvent.setup();

      renderListPage();
      await resolveInitialLoad();

      await user.click(screen.getByRole("button", { name: /Filters/ }));
      await user.click(screen.getByRole("button", { name: "Add clause" }));
      await user.selectOptions(screen.getByLabelText("Filter 1 field"), "status");
      await user.selectOptions(screen.getByLabelText("Filter 1 value"), "Draft");

      await user.click(screen.getByRole("button", { name: "Saved filters" }));
      await user.type(screen.getByLabelText("Filter name"), "My filter");
      await user.click(screen.getByRole("button", { name: "Save" }));

      await waitFor(() => {
        expect(api.saveSavedFilter).toHaveBeenCalledWith("My filter", "protocol", DRAFT_FILTER);
      });
    });

    test("save button is disabled when no clauses exist", async () => {
      api.listProtocols.mockResolvedValue(SAMPLE_PROTOCOLS);
      api.getSummary.mockResolvedValue(SAMPLE_SUMMARY);
      const user = userEvent.setup();

      renderListPage();
      await resolveInitialLoad();

      await user.click(screen.getByRole("button", { name: "Saved filters" }));
      expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    });

    test("deleting a saved filter calls the delete endpoint", async () => {
      api.listProtocols.mockResolvedValue(SAMPLE_PROTOCOLS);
      api.getSummary.mockResolvedValue(SAMPLE_SUMMARY);
      api.listSavedFilters.mockResolvedValue([SAVED_FILTER]);
      api.deleteSavedFilter.mockResolvedValue(null);
      const user = userEvent.setup();

      renderListPage();
      await resolveInitialLoad();

      await user.click(screen.getByRole("button", { name: "Saved filters" }));
      await user.click(screen.getByRole("button", { name: "Delete saved filter Draft protocols" }));

      await waitFor(() => {
        expect(api.deleteSavedFilter).toHaveBeenCalledWith(1);
      });
    });

    test("shows a validation error when saving without a name", async () => {
      api.listProtocols.mockResolvedValue(SAMPLE_PROTOCOLS);
      api.getSummary.mockResolvedValue(SAMPLE_SUMMARY);
      const user = userEvent.setup();

      renderListPage();
      await resolveInitialLoad();

      await user.click(screen.getByRole("button", { name: /Filters/ }));
      await user.click(screen.getByRole("button", { name: "Add clause" }));
      await user.type(screen.getByLabelText("Filter 1 value"), "X");

      await user.click(screen.getByRole("button", { name: "Saved filters" }));
      await user.click(screen.getByRole("button", { name: "Save" }));

      expect(await screen.findByText("Enter a name for this filter.")).toBeInTheDocument();
      expect(api.saveSavedFilter).not.toHaveBeenCalled();
    });
  });

  describe("Recent committee activity", () => {
    test("renders various audit activity types", async () => {
      api.listProtocols.mockResolvedValue([]);
      api.getSummary.mockResolvedValue(EMPTY_SUMMARY);
      api.getAuditLog.mockResolvedValue([
        { id: 1, action: "protocol.created", entity_type: "protocol", entity_id: "IACUC-001", actor: "Alice", details: null, provenance: "human", created_at: "2026-08-01T10:00:00Z" },
        { id: 2, action: "vote.cast", entity_type: "protocol", entity_id: "IACUC-001", actor: "Bob", details: { vote: "Approve" }, provenance: "human", created_at: "2026-08-01T11:00:00Z" },
        { id: 3, action: "assignment.updated", entity_type: "protocol", entity_id: "IACUC-002", actor: "System", details: { reviewer: "Charlie", role: "Primary Reviewer" }, provenance: "system", created_at: "2026-08-01T12:00:00Z" },
      ] as any);

      renderListPage();
      
      await waitFor(() => {
        expect(screen.getByText("IACUC-001 created by Alice — Aug 1, 2026")).toBeInTheDocument();
        expect(screen.getByText("IACUC-001 vote cast: Approve by Bob — Aug 1, 2026")).toBeInTheDocument();
        expect(screen.getByText("IACUC-002 assigned to Charlie as Primary Reviewer — Aug 1, 2026")).toBeInTheDocument();
      });
    });
  });

  describe("CSV export", () => {
    test("downloads the filtered result set as a UTF-8 CSV", async () => {
      api.listProtocols.mockResolvedValue(SAMPLE_PROTOCOLS);
      api.getSummary.mockResolvedValue(SAMPLE_SUMMARY);
      const createObjectURL = vi.fn((_blob: Blob) => "blob:mock");
      const revokeObjectURL = vi.fn();
      vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });
      const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
      const user = userEvent.setup();

      renderListPage();
      await resolveInitialLoad();

      await user.click(screen.getByTestId("export-csv"));

      expect(createObjectURL).toHaveBeenCalledTimes(1);
      expect(clickSpy).toHaveBeenCalledTimes(1);
      const blob = createObjectURL.mock.calls[0][0] as Blob;
      const text = await blob.text();
      expect(text).toContain("Protocol number,Title,Principal investigator,Species,Status");
      expect(text).toContain("IACUC-2026-0001,Test protocol one,Dr. One,Mouse,Active");
      expect(text).toContain("IACUC-2026-0002,Test protocol two,Dr. Two,Rat,Draft");
    });
  });
});
