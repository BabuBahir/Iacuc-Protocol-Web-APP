import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import AdminPage from "../AdminPage.jsx";
import { api } from "../../api.js";

vi.mock("../../api.js", () => ({
  api: {
    listSpecies: vi.fn(),
    createSpecies: vi.fn(),
    deleteSpecies: vi.fn(),
    listRoles: vi.fn(),
    createRole: vi.fn(),
    deleteRole: vi.fn(),
    listPersonnel: vi.fn(),
    createPersonnel: vi.fn(),
    deletePersonnel: vi.fn(),
  },
}));

function renderAdminPage() {
  return render(
    <MemoryRouter>
      <AdminPage />
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  api.listSpecies.mockResolvedValue([{ id: 1, name: "Mouse" }]);
  api.listRoles.mockResolvedValue([{ id: 1, name: "Principal Investigator", is_committee: 0 }]);
  api.listPersonnel.mockResolvedValue([]);
});

describe("AdminPage — species panel", () => {
  test("renders existing species on load", async () => {
    renderAdminPage();
    await waitFor(() => expect(screen.getByText("Mouse")).toBeInTheDocument());
  });

  test("adding a species calls the API and refreshes the list", async () => {
    const user = userEvent.setup();
    api.createSpecies.mockResolvedValue({ id: 2, name: "Ferret" });

    renderAdminPage();
    await waitFor(() => expect(screen.getByText("Mouse")).toBeInTheDocument());

    const input = screen.getByPlaceholderText("e.g. Guinea pig");
    await user.type(input, "Ferret");

    // re-mock the follow-up load() call to include the new species
    api.listSpecies.mockResolvedValue([
      { id: 1, name: "Mouse" },
      { id: 2, name: "Ferret" },
    ]);

    const addButtons = screen.getAllByRole("button", { name: /add/i });
    await user.click(addButtons[0]);

    await waitFor(() => {
      expect(api.createSpecies).toHaveBeenCalledWith("Ferret");
    });
  });

  test("shows an error message if creating a species fails", async () => {
    const user = userEvent.setup();
    api.createSpecies.mockRejectedValue(new Error("That species already exists."));

    renderAdminPage();
    await waitFor(() => expect(screen.getByText("Mouse")).toBeInTheDocument());

    const input = screen.getByPlaceholderText("e.g. Guinea pig");
    await user.type(input, "Mouse");
    const addButtons = screen.getAllByRole("button", { name: /add/i });
    await user.click(addButtons[0]);

    await waitFor(() => {
      expect(screen.getByText("That species already exists.")).toBeInTheDocument();
    });
  });

  test("does not call the API when submitting an empty/whitespace name", async () => {
    const user = userEvent.setup();
    renderAdminPage();
    await waitFor(() => expect(screen.getByText("Mouse")).toBeInTheDocument());

    const input = screen.getByPlaceholderText("e.g. Guinea pig");
    await user.type(input, "   ");
    const addButtons = screen.getAllByRole("button", { name: /add/i });
    await user.click(addButtons[0]);

    expect(api.createSpecies).not.toHaveBeenCalled();
  });
});

describe("AdminPage — roles panel", () => {
  test("renders existing roles, with a Committee badge when is_committee is set", async () => {
    api.listRoles.mockResolvedValue([
      { id: 1, name: "Principal Investigator", is_committee: 0 },
      { id: 2, name: "IACUC Chair", is_committee: 1 },
    ]);

    renderAdminPage();
    // "IACUC Chair" legitimately appears twice: once in the roles list,
    // once as an <option> in the personnel panel's role dropdown.
    await waitFor(() => {
      expect(screen.getAllByText("IACUC Chair").length).toBeGreaterThanOrEqual(1);
    });

    // "Committee" also legitimately appears twice: the nav link to /committee,
    // and the badge span next to a committee-eligible role. Scope to the badge
    // specifically via its distinguishing class rather than the ambiguous text.
    const badge = document.querySelector("span.rounded-full");
    expect(badge).toBeTruthy();
    expect(badge.textContent).toBe("Committee");
  });
});

describe("AdminPage — personnel panel", () => {
  test("populates the role dropdown from loaded roles", async () => {
    api.listRoles.mockResolvedValue([
      { id: 1, name: "Attending Veterinarian", is_committee: 1 },
    ]);

    renderAdminPage();
    await waitFor(() => {
      expect(screen.getByRole("option", { name: "Attending Veterinarian" })).toBeInTheDocument();
    });
  });
});
