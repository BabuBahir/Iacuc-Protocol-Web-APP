import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import InspectionsPage from "../InspectionsPage";
import { api as realApi } from "../../api";
import type { Facility, Inspection, InspectionDetail } from "../../types";

vi.mock("../../api", () => ({
  api: {
    listFacilities: vi.fn(),
    createFacility: vi.fn(),
    deleteFacility: vi.fn(),
    listInspections: vi.fn(),
    createInspection: vi.fn(),
    getInspection: vi.fn(),
    createDeficiency: vi.fn(),
    remediateDeficiency: vi.fn(),
  },
}));

const api = vi.mocked(realApi);

const FACILITIES: Facility[] = [
  { id: 1, name: "Central Vivarium — Rodent Housing", type: "Housing Room", species: "Mouse, Rat" },
  { id: 2, name: "Surgical Suite 3B", type: "Surgical Suite", species: null },
];

const INSPECTIONS: Inspection[] = [
  { id: 10, facility_id: 1, facility_name: "Central Vivarium — Rodent Housing", inspection_date: "2026-06-15", report: null, result: "Pass", created_at: null },
  { id: 11, facility_id: 2, facility_name: "Surgical Suite 3B", inspection_date: "2026-05-02", report: "Ductwork noise above threshold.", result: "Re-inspection required", created_at: null },
];

const DETAIL: InspectionDetail = {
  ...INSPECTIONS[0],
  deficiencies: [
    { id: 20, inspection_id: 10, severity: "Minor", description: "Slightly worn gasket on cage rack.", remediation_deadline: "2026-08-01", remediated_at: null },
  ],
};

function renderPage() {
  return render(
    <MemoryRouter>
      <InspectionsPage />
    </MemoryRouter>
  );
}

function mockLoad(facilities: Facility[] = FACILITIES, inspections: Inspection[] = INSPECTIONS) {
  api.listFacilities.mockResolvedValue(facilities);
  api.listInspections.mockResolvedValue(inspections);
}

beforeEach(() => {
  vi.clearAllMocks();
});

function facilitiesPanel() {
  return within(screen.getByText("Facilities").closest(".rounded-lg") as HTMLElement);
}

function inspectionsPanel() {
  return within(screen.getByText("Semi-annual inspections").closest(".rounded-lg") as HTMLElement);
}

describe("InspectionsPage — facilities panel", () => {
  test("renders existing facilities with type and species", async () => {
    mockLoad();
    renderPage();

    await waitFor(() => expect(screen.getAllByText("Central Vivarium — Rodent Housing").length).toBeGreaterThan(0));
    expect(screen.getByText(/Housing Room · Mouse, Rat/)).toBeInTheDocument();
    expect(facilitiesPanel().getByText("Surgical Suite 3B")).toBeInTheDocument();
  });

  test("adding a facility calls the API and refreshes the list", async () => {
    const user = userEvent.setup();
    mockLoad();
    api.createFacility.mockResolvedValue({ id: 3, name: "Aquatics Core", type: "Lab", species: "Zebrafish" });

    renderPage();
    await waitFor(() => expect(screen.getAllByText("Central Vivarium — Rodent Housing").length).toBeGreaterThan(0));

    await user.type(facilitiesPanel().getByPlaceholderText(/Facility name/), "Aquatics Core");
    await user.type(facilitiesPanel().getByPlaceholderText(/Species housed there/), "Zebrafish");

    api.listFacilities.mockResolvedValue([...FACILITIES, { id: 3, name: "Aquatics Core", type: "Lab", species: "Zebrafish" }]);

    const addButtons = screen.getAllByRole("button", { name: /Add/ });
    await user.click(addButtons[0]);

    await waitFor(() => {
      expect(api.createFacility).toHaveBeenCalledWith({ name: "Aquatics Core", type: "Housing Room", species: "Zebrafish" });
    });
    await waitFor(() => expect(facilitiesPanel().getByText("Aquatics Core")).toBeInTheDocument());
  });

  test("sends null species when the field is blank", async () => {
    const user = userEvent.setup();
    mockLoad();
    api.createFacility.mockResolvedValue({ id: 3, name: "Surgical Suite 4A", type: "Surgical Suite", species: null });

    renderPage();
    await waitFor(() => expect(screen.getAllByText("Central Vivarium — Rodent Housing").length).toBeGreaterThan(0));

    await user.type(facilitiesPanel().getByPlaceholderText(/Facility name/), "Surgical Suite 4A");
    await user.selectOptions(facilitiesPanel().getByRole("combobox"), "Surgical Suite");

    const addButtons = screen.getAllByRole("button", { name: /Add/ });
    await user.click(addButtons[0]);

    await waitFor(() => {
      expect(api.createFacility).toHaveBeenCalledWith({ name: "Surgical Suite 4A", type: "Surgical Suite", species: null });
    });
  });

  test("deleting a facility calls the API and refreshes", async () => {
    const user = userEvent.setup();
    mockLoad();
    api.deleteFacility.mockResolvedValue(null);

    renderPage();
    await waitFor(() => expect(screen.getAllByText("Central Vivarium — Rodent Housing").length).toBeGreaterThan(0));

    api.listFacilities.mockResolvedValue([FACILITIES[0]]);
    const row = facilitiesPanel().getByText("Surgical Suite 3B").closest(".px-4");
    await user.click(within(row as HTMLElement).getByRole("button"));

    await waitFor(() => {
      expect(api.deleteFacility).toHaveBeenCalledWith(2);
    });
    await waitFor(() => expect(facilitiesPanel().queryByText("Surgical Suite 3B")).not.toBeInTheDocument());
  });

  test("shows an error when creating a facility fails", async () => {
    const user = userEvent.setup();
    mockLoad();
    api.createFacility.mockRejectedValue(new Error("A facility with that name already exists."));

    renderPage();
    await waitFor(() => expect(screen.getAllByText("Central Vivarium — Rodent Housing").length).toBeGreaterThan(0));

    await user.type(facilitiesPanel().getByPlaceholderText(/Facility name/), "Central Vivarium — Rodent Housing");
    const addButtons = screen.getAllByRole("button", { name: /Add/ });
    await user.click(addButtons[0]);

    await waitFor(() => {
      expect(screen.getByText("A facility with that name already exists.")).toBeInTheDocument();
    });
  });

  test("shows an error when deleting a facility fails", async () => {
    const user = userEvent.setup();
    mockLoad();
    api.deleteFacility.mockRejectedValue(new Error("Facility has inspections."));

    renderPage();
    await waitFor(() => expect(screen.getAllByText("Central Vivarium — Rodent Housing").length).toBeGreaterThan(0));

    const row = facilitiesPanel().getByText("Surgical Suite 3B").closest(".px-4");
    await user.click(within(row as HTMLElement).getByRole("button"));

    await waitFor(() => {
      expect(screen.getByText("Facility has inspections.")).toBeInTheDocument();
    });
  });
});

describe("InspectionsPage — inspections panel", () => {
  test("renders inspections with facility name, date, and result badge", async () => {
    mockLoad();
    renderPage();

    await waitFor(() => expect(screen.getByText("Semi-annual inspections")).toBeInTheDocument());
    expect(screen.getAllByText("Central Vivarium — Rodent Housing").length).toBeGreaterThan(0);
    expect(screen.getByText("Inspected 2026-06-15")).toBeInTheDocument();
    // Result badges (the same words also appear as options in the result select)
    expect(screen.getAllByText("Pass").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Re-inspection required").length).toBeGreaterThan(0);
  });

  test("recording an inspection calls the API and refreshes", async () => {
    const user = userEvent.setup();
    mockLoad();
    api.createInspection.mockResolvedValue({
      ...INSPECTIONS[0],
      deficiencies: [],
    });

    renderPage();
    await waitFor(() => expect(screen.getByText("Semi-annual inspections")).toBeInTheDocument());

    await user.selectOptions(inspectionsPanel().getAllByRole("combobox")[0], "1");
    const panelEl = screen.getByText("Semi-annual inspections").closest(".rounded-lg") as HTMLElement;
    await user.type(panelEl.querySelector('input[type="date"]') as HTMLElement, "2026-07-01");
    await user.type(inspectionsPanel().getByPlaceholderText("Report (optional)"), "All clean.");
    const recordButton = inspectionsPanel().getByRole("button", { name: /Record/ });
    await user.click(recordButton);

    await waitFor(() => {
      expect(api.createInspection).toHaveBeenCalledWith({
        facility_id: 1,
        inspection_date: "2026-07-01",
        result: "Pending",
        report: "All clean.",
      });
    });
  });

  test("does not record an inspection without a facility or date", async () => {
    const user = userEvent.setup();
    mockLoad();
    renderPage();
    await waitFor(() => expect(screen.getByText("Semi-annual inspections")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /Record/ }));
    expect(api.createInspection).not.toHaveBeenCalled();
  });

  test("expanding an inspection loads its deficiencies", async () => {
    const user = userEvent.setup();
    mockLoad();
    api.getInspection.mockResolvedValue(DETAIL);

    renderPage();
    await waitFor(() => expect(screen.getByText("Inspected 2026-06-15")).toBeInTheDocument());

    await user.click(screen.getByText("Inspected 2026-06-15"));

    await waitFor(() => {
      expect(screen.getByText("Slightly worn gasket on cage rack.")).toBeInTheDocument();
    });
    // "Minor" also appears as an option in the deficiency severity select
    expect(screen.getAllByText("Minor").length).toBeGreaterThan(0);
    expect(screen.getByText(/Due 2026-08-01/)).toBeInTheDocument();
  });

  test("adding a deficiency calls the API and refreshes the detail", async () => {
    const user = userEvent.setup();
    mockLoad();
    const newDef = { id: 21, inspection_id: 10, severity: "Minor" as const, description: "Loose water bottle valve.", remediation_deadline: null, remediated_at: null };
    api.getInspection.mockResolvedValueOnce({ ...DETAIL, deficiencies: [] })
      .mockResolvedValueOnce({ ...DETAIL, deficiencies: [...DETAIL.deficiencies, newDef] });
    api.createDeficiency.mockResolvedValue(newDef);

    renderPage();
    await waitFor(() => expect(screen.getByText("Inspected 2026-06-15")).toBeInTheDocument());

    await user.click(screen.getByText("Inspected 2026-06-15"));
    await waitFor(() => expect(screen.getByPlaceholderText(/Record a deficiency/)).toBeInTheDocument());

    await user.type(screen.getByPlaceholderText(/Record a deficiency/), "Loose water bottle valve.");
    await user.click(screen.getAllByRole("button", { name: /^Add$/ })[1]);

    await waitFor(() => {
      expect(api.createDeficiency).toHaveBeenCalledWith(10, {
        severity: "Minor",
        description: "Loose water bottle valve.",
        remediation_deadline: null,
      });
    });
    await waitFor(() => expect(screen.getByText("Loose water bottle valve.")).toBeInTheDocument());
  });

  test("marking a deficiency remediated calls the API and refreshes", async () => {
    const user = userEvent.setup();
    mockLoad();
    api.getInspection.mockResolvedValueOnce(DETAIL)
      .mockResolvedValueOnce({ ...DETAIL, deficiencies: [{ ...DETAIL.deficiencies[0], remediated_at: "2026-07-20 12:00:00" }] });
    api.remediateDeficiency.mockResolvedValue({ ...DETAIL.deficiencies[0], remediated_at: "2026-07-20 12:00:00" });

    renderPage();
    await waitFor(() => expect(screen.getByText("Inspected 2026-06-15")).toBeInTheDocument());

    await user.click(screen.getByText("Inspected 2026-06-15"));
    await waitFor(() => expect(screen.getByText("Slightly worn gasket on cage rack.")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /Mark remediated/ }));

    await waitFor(() => {
      expect(api.remediateDeficiency).toHaveBeenCalledWith(10, 20);
    });
    await waitFor(() => expect(screen.getByText(/· remediated/)).toBeInTheDocument());
  });
});
