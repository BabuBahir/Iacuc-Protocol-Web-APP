import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useNavigate } from "react-router-dom";
import CreatePage from "../CreatePage";
import { api as realApi } from "../../api";
import type { Protocol } from "../../types";

vi.mock("../../api", () => ({
  api: {
    listSpecies: vi.fn(),
    createProtocol: vi.fn(),
  },
}));

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...(actual as object), useNavigate: vi.fn() };
});

const api = vi.mocked(realApi);

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

  test("creates a protocol with the full application payload and navigates to its detail page", async () => {
    api.listSpecies.mockResolvedValue([{ id: 1, name: "Mouse" }, { id: 2, name: "Rat" }]);
    api.createProtocol.mockResolvedValue({ id: "IACUC-2026-0999", title: "raju owl protocol" } as Protocol);
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
        pi_proxy: null,
        ptm_member: null,
        protocol_type: null,
        species: "Rat",
        animals: 42,
        pain_category: "Category C",
        anesthesia_required: 0,
        housing: null,
        disposal: null,
        npg: null,
        research_steps: [],
        purpose_summary: null,
        harm_benefit_analysis: null,
        scientific_summary: null,
        status: null,
        submitted: null,
        expires: null,
      });
    });
    expect(navigate).toHaveBeenCalledWith("/protocols/IACUC-2026-0999");
  });

  test("captures key personnel, animal care, and research-plan fields via the sub-modal", async () => {
    api.listSpecies.mockResolvedValue([{ id: 1, name: "Mouse" }, { id: 2, name: "Rat" }]);
    api.createProtocol.mockResolvedValue({ id: "IACUC-2026-0999", title: "raju owl protocol" } as Protocol);
    const navigate = vi.fn();
    vi.mocked(useNavigate).mockReturnValue(navigate);
    const user = userEvent.setup();

    renderCreatePage();
    await waitFor(() => expect(screen.getByLabelText("Species")).toHaveValue("Mouse"));

    await user.type(screen.getByLabelText("Protocol number"), "IACUC-2026-0999");
    await user.type(screen.getByLabelText("Title"), "raju owl protocol");
    await user.type(screen.getByLabelText("Principal investigator"), "Dr. Raju");
    await user.type(screen.getByLabelText("PI proxy"), "Sam Whitfield");
    await user.type(screen.getByLabelText("PTM member"), "Dr. Kim");
    await user.selectOptions(screen.getByLabelText("Type of IACUC protocol"), "Research");
    await user.type(screen.getByLabelText("Number of animals"), "10");

    const radios = screen.getAllByRole("radio");
    await user.click(radios[0]); // anesthesia: Yes
    await user.click(radios[2]); // NPG: Yes
    await user.type(screen.getByLabelText("NPG compounds & source"), "Dextran sulfate, purity 95%, Sigma");
    await user.type(screen.getByLabelText("How will the animals be housed?"), "Individually caged, enrichments");
    await user.type(screen.getByLabelText("How will the animals be disposed of?"), "CO2 euthanasia, incineration");

    await user.click(screen.getByRole("button", { name: "Add step" }));
    await user.type(screen.getByLabelText("Step description"), "Habituate animals to handling");
    await user.click(screen.getByRole("button", { name: "Save step" }));
    await user.click(screen.getByRole("button", { name: "Add step" }));
    await user.type(screen.getByLabelText("Step description"), "Apply chronic stress paradigm");
    await user.click(screen.getByRole("button", { name: "Save step" }));

    expect(screen.getByText(/Habituate animals to handling/)).toBeInTheDocument();
    expect(screen.getByText(/Apply chronic stress paradigm/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Create protocol" }));

    await waitFor(() => {
      expect(api.createProtocol).toHaveBeenCalledWith(expect.objectContaining({
        id: "IACUC-2026-0999",
        pi_proxy: "Sam Whitfield",
        ptm_member: "Dr. Kim",
        protocol_type: "Research",
        animals: 10,
        anesthesia_required: 1,
        npg: "Dextran sulfate, purity 95%, Sigma",
        housing: "Individually caged, enrichments",
        disposal: "CO2 euthanasia, incineration",
        research_steps: ["Habituate animals to handling", "Apply chronic stress paradigm"],
      }));
    });
    expect(navigate).toHaveBeenCalledWith("/protocols/IACUC-2026-0999");
  }, 15000);

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
