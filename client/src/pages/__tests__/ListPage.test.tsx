import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useNavigate } from "react-router-dom";
import ListPage from "../ListPage";
import { api as realApi } from "../../api";
import type { Protocol, Summary } from "../../types";

vi.mock("../../api", () => ({
  api: {
    listProtocols: vi.fn(),
    getSummary: vi.fn(),
  },
}));

vi.mock("react-router-dom", async (importOriginal) => {
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

describe("ListPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("shows a loading state before data resolves", () => {
    api.listProtocols.mockReturnValue(new Promise<Protocol[]>(() => {})); // never resolves
    api.getSummary.mockReturnValue(new Promise<Summary>(() => {}));

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
      expect(screen.getByText(/No protocols match/)).toBeInTheDocument();
    });
  });

  test("typing in the search box re-queries the API with the new query", async () => {
    api.listProtocols.mockResolvedValue(SAMPLE_PROTOCOLS);
    api.getSummary.mockResolvedValue(SAMPLE_SUMMARY);
    const user = userEvent.setup();

    renderListPage();
    await waitFor(() => expect(api.listProtocols).toHaveBeenCalledWith(""));

    const searchInput = screen.getByPlaceholderText("Search this list...");
    await user.type(searchInput, "mouse");

    await waitFor(() => {
      expect(api.listProtocols).toHaveBeenLastCalledWith("mouse");
    });
  });

  test("New protocol button navigates to the create page", async () => {
    api.listProtocols.mockResolvedValue(SAMPLE_PROTOCOLS);
    api.getSummary.mockResolvedValue(SAMPLE_SUMMARY);
    const navigate = vi.fn();
    vi.mocked(useNavigate).mockReturnValue(navigate);
    const user = userEvent.setup();

    renderListPage();
    await waitFor(() => expect(screen.getByText("IACUC-2026-0001")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "New protocol" }));
    expect(navigate).toHaveBeenCalledWith("/protocols/new");
  });
});
