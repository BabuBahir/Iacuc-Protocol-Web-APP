import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useNavigate } from "react-router";
import RegisterPage from "../RegisterPage";
import { api as realApi } from "../../api";
import type { AnimalUsageTransaction, FilterClause, SavedFilter } from "../../types";

vi.mock("../../api", () => ({
  api: {
    searchAnimalUsage: vi.fn(),
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

function renderRegisterPage() {
  return render(
    <MemoryRouter>
      <RegisterPage />
    </MemoryRouter>
  );
}

const SAMPLE_TRANSACTIONS: AnimalUsageTransaction[] = [
  {
    id: 1,
    protocol_id: "IACUC-2026-0142",
    protocol_title: "Retinal degeneration study",
    transaction_date: "2026-06-20",
    species_strain: "Mouse / C57BL/6",
    pain_level: "C",
    quantity: 55,
    type: "use",
    procedure_key: "injections",
    notes: "Cohort 1 on study",
    created_at: "2026-06-20T00:00:00.000Z",
  },
  {
    id: 2,
    protocol_id: "IACUC-2026-0158",
    protocol_title: "Zebrafish regeneration",
    transaction_date: "2026-07-02",
    species_strain: "Zebrafish / mutant line",
    pain_level: "B",
    quantity: 100,
    type: "order",
    procedure_key: null,
    notes: null,
    created_at: "2026-07-02T00:00:00.000Z",
  },
];

const PAIN_FILTER: FilterClause[] = [{ field: "pain_level", op: "eq", value: "D" }];

const SAVED_FILTER: SavedFilter = {
  id: 3,
  name: "Pain level D",
  search_type: "register",
  filters: PAIN_FILTER,
  created_at: "2026-08-01T00:00:00.000Z",
};

async function resolveInitialLoad() {
  await waitFor(() => {
    expect(screen.getByText("IACUC-2026-0142")).toBeInTheDocument();
  });
}

describe("RegisterPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.listSavedFilters.mockResolvedValue([]);
  });

  test("shows a loading state before data resolves", () => {
    api.searchAnimalUsage.mockReturnValue(new Promise<AnimalUsageTransaction[]>(() => {}));

    renderRegisterPage();
    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });

  test("renders transactions across protocols once data resolves", async () => {
    api.searchAnimalUsage.mockResolvedValue(SAMPLE_TRANSACTIONS);

    renderRegisterPage();

    await waitFor(() => {
      expect(screen.getByText("IACUC-2026-0142")).toBeInTheDocument();
    });
    expect(screen.getByText("Retinal degeneration study")).toBeInTheDocument();
    expect(screen.getByText("Mouse / C57BL/6")).toBeInTheDocument();
    expect(screen.getByText("Zebrafish / mutant line")).toBeInTheDocument();
    expect(screen.getByText("2 transactions")).toBeInTheDocument();
    expect(screen.getByText("injections")).toBeInTheDocument();
    expect(screen.getByText("Order")).toBeInTheDocument();
    expect(screen.getByText("Use")).toBeInTheDocument();
  });

  test("shows an error message if the API call fails", async () => {
    api.searchAnimalUsage.mockRejectedValue(new Error("Network error"));

    renderRegisterPage();

    await waitFor(() => {
      expect(screen.getByText(/Couldn't load the register/)).toBeInTheDocument();
    });
  });

  test("shows an empty state when no transactions match", async () => {
    api.searchAnimalUsage.mockResolvedValue([]);

    renderRegisterPage();

    await waitFor(() => {
      expect(screen.getByText(/No animal usage transactions yet/)).toBeInTheDocument();
    });
  });

  describe("filter-builder", () => {
    test("adding a clause re-queries with the filters payload", async () => {
      api.searchAnimalUsage.mockResolvedValue(SAMPLE_TRANSACTIONS);
      const user = userEvent.setup();

      renderRegisterPage();
      await resolveInitialLoad();

      await user.click(screen.getByRole("button", { name: /Filters/ }));
      await user.click(screen.getByRole("button", { name: "Add clause" }));

      const valueInput = screen.getByLabelText("Filter 1 value");
      await user.type(valueInput, "Mouse");

      await waitFor(() => {
        expect(api.searchAnimalUsage).toHaveBeenLastCalledWith([
          { field: "protocol_id", op: "eq", value: "Mouse" },
        ]);
      });
    });

    test("register enum fields offer the server whitelist (pain level, procedure)", async () => {
      api.searchAnimalUsage.mockResolvedValue(SAMPLE_TRANSACTIONS);
      const user = userEvent.setup();

      renderRegisterPage();
      await resolveInitialLoad();

      await user.click(screen.getByRole("button", { name: /Filters/ }));
      await user.click(screen.getByRole("button", { name: "Add clause" }));

      await user.selectOptions(screen.getByLabelText("Filter 1 field"), "pain_level");
      const painValues = Array.from(
        screen.getByLabelText("Filter 1 value").querySelectorAll("option")
      ).map(o => o.textContent);
      expect(painValues).toEqual(["— select —", "B", "C", "D", "E"]);

      await user.selectOptions(screen.getByLabelText("Filter 1 field"), "procedure_key");
      const procValues = Array.from(
        screen.getByLabelText("Filter 1 value").querySelectorAll("option")
      ).map(o => o.textContent);
      expect(procValues).toContain("survival_surgery");
      expect(procValues).toContain("breeding");
      expect(procValues).toContain("injections");
    });

    test("clear all removes every clause and shows a chip-free state", async () => {
      api.searchAnimalUsage.mockResolvedValue(SAMPLE_TRANSACTIONS);
      const user = userEvent.setup();

      renderRegisterPage();
      await resolveInitialLoad();

      await user.click(screen.getByRole("button", { name: /Filters/ }));
      await user.click(screen.getByRole("button", { name: "Add clause" }));
      await user.type(screen.getByLabelText("Filter 1 value"), "X");
      await waitFor(() => expect(screen.getAllByTestId("active-filter-chip").length).toBe(1));

      await user.click(screen.getByRole("button", { name: "Clear all filters" }));
      expect(screen.queryByTestId("active-filter-chip")).not.toBeInTheDocument();
      await waitFor(() => {
        expect(api.searchAnimalUsage).toHaveBeenLastCalledWith([]);
      });
    });
  });

  describe("saved filters", () => {
    test("applying a saved register filter re-queries with its clauses", async () => {
      api.searchAnimalUsage.mockResolvedValue(SAMPLE_TRANSACTIONS);
      api.listSavedFilters.mockResolvedValue([SAVED_FILTER]);
      const user = userEvent.setup();

      renderRegisterPage();
      await resolveInitialLoad();

      await user.click(screen.getByRole("button", { name: "Saved filters" }));
      await user.click(screen.getByRole("button", { name: /^Pain level D/ }));

      await waitFor(() => {
        expect(api.searchAnimalUsage).toHaveBeenLastCalledWith(PAIN_FILTER);
      });
      expect(screen.getByTestId("active-filter-chip")).toBeInTheDocument();
    });

    test("saving the current filter posts it with search_type 'register'", async () => {
      api.searchAnimalUsage.mockResolvedValue(SAMPLE_TRANSACTIONS);
      api.saveSavedFilter.mockResolvedValue({ ...SAVED_FILTER, name: "My register filter" });
      const user = userEvent.setup();

      renderRegisterPage();
      await resolveInitialLoad();

      await user.click(screen.getByRole("button", { name: /Filters/ }));
      await user.click(screen.getByRole("button", { name: "Add clause" }));
      await user.selectOptions(screen.getByLabelText("Filter 1 field"), "pain_level");
      await user.selectOptions(screen.getByLabelText("Filter 1 value"), "D");

      await user.click(screen.getByRole("button", { name: "Saved filters" }));
      await user.type(screen.getByLabelText("Filter name"), "My register filter");
      await user.click(screen.getByRole("button", { name: "Save" }));

      await waitFor(() => {
        expect(api.saveSavedFilter).toHaveBeenCalledWith("My register filter", "register", PAIN_FILTER);
      });
    });

    test("save button is disabled when no clauses exist", async () => {
      api.searchAnimalUsage.mockResolvedValue(SAMPLE_TRANSACTIONS);
      const user = userEvent.setup();

      renderRegisterPage();
      await resolveInitialLoad();

      await user.click(screen.getByRole("button", { name: "Saved filters" }));
      expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    });

    test("deleting a saved filter calls the delete endpoint", async () => {
      api.searchAnimalUsage.mockResolvedValue(SAMPLE_TRANSACTIONS);
      api.listSavedFilters.mockResolvedValue([SAVED_FILTER]);
      api.deleteSavedFilter.mockResolvedValue(null);
      const user = userEvent.setup();

      renderRegisterPage();
      await resolveInitialLoad();

      await user.click(screen.getByRole("button", { name: "Saved filters" }));
      await user.click(screen.getByRole("button", { name: "Delete saved filter Pain level D" }));

      await waitFor(() => {
        expect(api.deleteSavedFilter).toHaveBeenCalledWith(3);
      });
    });
  });

  describe("CSV export", () => {
    test("downloads the transaction set as a UTF-8 CSV", async () => {
      api.searchAnimalUsage.mockResolvedValue(SAMPLE_TRANSACTIONS);
      const createObjectURL = vi.fn((_blob: Blob) => "blob:mock");
      const revokeObjectURL = vi.fn();
      vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });
      const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
      const user = userEvent.setup();

      renderRegisterPage();
      await resolveInitialLoad();

      await user.click(screen.getByTestId("export-csv"));

      expect(createObjectURL).toHaveBeenCalledTimes(1);
      expect(clickSpy).toHaveBeenCalledTimes(1);
      const blob = createObjectURL.mock.calls[0][0] as Blob;
      const text = await blob.text();
      expect(text).toContain(
        "Protocol number,Title,Transaction date,Species / strain,Pain level,Quantity,Type,Procedure,Notes"
      );
      expect(text).toContain(
        "IACUC-2026-0142,Retinal degeneration study,2026-06-20,Mouse / C57BL/6,C,55,use,injections,Cohort 1 on study"
      );
    });
  });

  describe("navigation", () => {
    test("clicking a row navigates to the protocol detail page", async () => {
      api.searchAnimalUsage.mockResolvedValue(SAMPLE_TRANSACTIONS);
      const navigate = vi.fn();
      vi.mocked(useNavigate).mockReturnValue(navigate);
      const user = userEvent.setup();

      renderRegisterPage();
      await resolveInitialLoad();

      await user.click(screen.getByText("IACUC-2026-0142"));
      expect(navigate).toHaveBeenCalledWith("/protocols/IACUC-2026-0142");
    });
  });
});
