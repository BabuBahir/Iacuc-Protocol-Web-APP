import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useNavigate } from "react-router-dom";
import CreatePage from "../CreatePage.jsx";
import { api } from "../../api.js";

vi.mock("../../api.js", () => ({
  api: {
    listSpecies: vi.fn(),
    createProtocol: vi.fn(),
  },
}));

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, useNavigate: vi.fn() };
});

function renderCreatePage() {
  return render(
    <MemoryRouter>
      <CreatePage />
    </MemoryRouter>
  );
}

describe("CreatePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("loads species into the dropdown on mount", async () => {
    api.listSpecies.mockResolvedValue([{ id: 1, name: "Mouse" }, { id: 2, name: "Rat" }]);

    renderCreatePage();

    await waitFor(() => {
      expect(screen.getByLabelText("Species")).toHaveValue("Mouse");
    });
  });

  test("creates a protocol and navigates to its detail page", async () => {
    api.listSpecies.mockResolvedValue([{ id: 1, name: "Mouse" }, { id: 2, name: "Rat" }]);
    api.createProtocol.mockResolvedValue({ id: "IACUC-2026-0999", title: "raju owl protocol" });
    const navigate = vi.fn();
    vi.mocked(useNavigate).mockReturnValue(navigate);
    const user = userEvent.setup();

    renderCreatePage();
    await waitFor(() => expect(screen.getByLabelText("Species")).toHaveValue("Mouse"));

    await user.type(screen.getByLabelText("Protocol number"), "IACUC-2026-0999");
    await user.type(screen.getByLabelText("Title"), "raju owl protocol");
    await user.type(screen.getByLabelText("Principal investigator"), "Dr. Raju");
    await user.selectOptions(screen.getByLabelText("Species"), "Rat");
    await user.type(screen.getByLabelText("Number of animals"), "42");
    await user.selectOptions(screen.getByLabelText("Pain category"), "Category C");
    await user.click(screen.getByRole("button", { name: "Create protocol" }));

    await waitFor(() => {
      expect(api.createProtocol).toHaveBeenCalledWith({
        id: "IACUC-2026-0999",
        title: "raju owl protocol",
        pi: "Dr. Raju",
        species: "Rat",
        animals: 42,
        pain_category: "Category C",
      });
    });
    expect(navigate).toHaveBeenCalledWith("/protocols/IACUC-2026-0999");
  });

  test("surfaces a server error (e.g. duplicate id) and stays on the page", async () => {
    api.listSpecies.mockResolvedValue([{ id: 1, name: "Mouse" }]);
    api.createProtocol.mockRejectedValue(new Error("UNIQUE constraint failed"));
    const navigate = vi.fn();
    vi.mocked(useNavigate).mockReturnValue(navigate);
    const user = userEvent.setup();

    renderCreatePage();
    await waitFor(() => expect(screen.getByLabelText("Species")).toHaveValue("Mouse"));

    await user.type(screen.getByLabelText("Protocol number"), "IACUC-2026-0999");
    await user.type(screen.getByLabelText("Title"), "raju owl protocol");
    await user.type(screen.getByLabelText("Principal investigator"), "Dr. Raju");
    await user.click(screen.getByRole("button", { name: "Create protocol" }));

    await waitFor(() => {
      expect(screen.getByText("UNIQUE constraint failed")).toBeInTheDocument();
    });
    expect(navigate).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Protocol number")).toBeInTheDocument();
  });

  test("submitting an empty form does not call createProtocol", async () => {
    api.listSpecies.mockResolvedValue([{ id: 1, name: "Mouse" }]);
    const user = userEvent.setup();

    renderCreatePage();
    await waitFor(() => expect(screen.getByLabelText("Species")).toHaveValue("Mouse"));

    await user.click(screen.getByRole("button", { name: "Create protocol" }));

    expect(api.createProtocol).not.toHaveBeenCalled();
  });
});
