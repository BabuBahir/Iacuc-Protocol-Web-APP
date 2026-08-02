import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useNavigate } from "react-router-dom";
import ListPage from "../ListPage.jsx";
import { api } from "../../api.js";

vi.mock("../../api.js", () => ({
  api: {
    listProtocols: vi.fn(),
    getSummary: vi.fn(),
  },
}));

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, useNavigate: vi.fn() };
});

function renderListPage() {
  return render(
    <MemoryRouter>
      <ListPage />
    </MemoryRouter>
  );
}

const SAMPLE_PROTOCOLS = [
  { id: "IACUC-2026-0001", title: "Test protocol one", pi: "Dr. One", species: "Mouse", status: "Active" },
  { id: "IACUC-2026-0002", title: "Test protocol two", pi: "Dr. Two", species: "Rat", status: "Draft" },
];

const SAMPLE_SUMMARY = { active: 2, pendingReview: 1, expiringSoon: 0, approvedThisQuarter: 3 };

describe("ListPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("shows a loading state before data resolves", () => {
    api.listProtocols.mockReturnValue(new Promise(() => {})); // never resolves
    api.getSummary.mockReturnValue(new Promise(() => {}));

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
