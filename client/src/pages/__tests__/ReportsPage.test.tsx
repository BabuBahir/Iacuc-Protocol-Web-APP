import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import ReportsPage from "../ReportsPage";
import { api as realApi } from "../../api";
import type { ReportsPayload } from "../../types";

vi.mock("../../api", () => ({
  api: {
    getReports: vi.fn(),
  },
}));

const api = vi.mocked(realApi);

const PAYLOAD: ReportsPayload = {
  generated_at: "2026-08-09T12:00:00.000Z",
  reports: {
    restraint_by_species: [
      { protocol_id: "IACUC-2026-0150", species: "Rat", restraint_method: "Rat restrainer cone" },
    ],
    euthanasia_by_species: [
      { protocol_id: "IACUC-2026-0142", species: "Mouse", method: "CO2", dose: null, route: "inhalation" },
      { protocol_id: "IACUC-2026-0021", species: "Rabbit", method: "Pentobarbital", dose: "120 mg/kg", route: "IV" },
    ],
    surgery_locations: [
      { protocol_id: "IACUC-2026-0150", species: "Rat", surgery_type: "Survival surgery", location: "Surgical suite A" },
    ],
    multiple_major_recovery_surgery: [
      { protocol_id: "IACUC-2026-0147", species: "Pig", experiment: "Wound healing model", description: null },
    ],
    analgesic_anesthetic_drugs: [
      { protocol_id: "IACUC-2026-0150", species: "Rat", reason_for_use: "Anesthesia", drug: "Isoflurane", dose: "2-3%", route: "inhalation" },
      { protocol_id: "IACUC-2026-0142", species: "Mouse", reason_for_use: "Analgesia", drug: "Buprenorphine", dose: "0.05 mg/kg", route: "SC" },
    ],
    use_locations_by_species: [
      { location: "Surgical suite A", species: "Rat", protocol_count: 1, protocol_ids: ["IACUC-2026-0150"] },
    ],
  },
};

function renderPage() {
  return render(
    <MemoryRouter>
      <ReportsPage />
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  api.getReports.mockResolvedValue(PAYLOAD);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ReportsPage — rendering", () => {
  test("loads reports on mount and renders all six tables", async () => {
    renderPage();

    await waitFor(() => expect(screen.getByText("Restraint by species")).toBeInTheDocument());
    expect(api.getReports).toHaveBeenCalled();

    expect(screen.getByText("Euthanasia methods by species")).toBeInTheDocument();
    expect(screen.getByText("Surgery locations and types")).toBeInTheDocument();
    expect(screen.getByText("Multiple major recovery surgery")).toBeInTheDocument();
    expect(screen.getByText("Analgesic and anesthetic drugs")).toBeInTheDocument();
    expect(screen.getByText("Use locations by species")).toBeInTheDocument();
  });

  test("renders report rows from the payload", async () => {
    renderPage();

    await waitFor(() => expect(screen.getByText("Rat restrainer cone")).toBeInTheDocument());
    expect(screen.getByText("CO2")).toBeInTheDocument();
    expect(screen.getByText("Pentobarbital")).toBeInTheDocument();
    expect(screen.getAllByText("Surgical suite A").length).toBeGreaterThan(0);
    expect(screen.getByText("Wound healing model")).toBeInTheDocument();
    expect(screen.getByText("Isoflurane")).toBeInTheDocument();
    expect(screen.getByText("Buprenorphine")).toBeInTheDocument();
  });

  test("shows empty states when a report has no rows", async () => {
    api.getReports.mockResolvedValue({
      generated_at: "2026-08-09T12:00:00.000Z",
      reports: {
        restraint_by_species: [],
        euthanasia_by_species: [],
        surgery_locations: [],
        multiple_major_recovery_surgery: [],
        analgesic_anesthetic_drugs: [],
        use_locations_by_species: [],
      },
    });
    renderPage();

    await waitFor(() => expect(screen.getByText("No protocols report prolonged restraint.")).toBeInTheDocument());
    expect(screen.getByText("No euthanasia agents recorded.")).toBeInTheDocument();
    expect(screen.getByText("No surgery protocols on file.")).toBeInTheDocument();
    expect(screen.getByText("No experiments flagged for multiple major recovery surgery.")).toBeInTheDocument();
    expect(screen.getByText("No analgesic or anesthetic drugs recorded.")).toBeInTheDocument();
    expect(screen.getByText("No research-plan locations recorded.")).toBeInTheDocument();
  });

  test("shows an error message when the fetch fails", async () => {
    api.getReports.mockRejectedValue(new Error("Reports unavailable"));
    renderPage();

    await waitFor(() => expect(screen.getByText("Reports unavailable")).toBeInTheDocument());
  });
});

describe("ReportsPage — CSV download", () => {
  test("downloads a CSV with headers and row cells", async () => {
    const user = userEvent.setup();
    const createObjectURL = vi.fn((_blob: Blob) => "blob:mock");
    const revokeObjectURL = vi.fn();
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });

    renderPage();
    await waitFor(() => expect(screen.getByText("Rat restrainer cone")).toBeInTheDocument());

    await user.click(screen.getAllByRole("button", { name: /Download CSV/ })[0]);

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:mock");

    const blob = createObjectURL.mock.calls[0][0] as Blob;
    const text = await blob.text();
    expect(text).toContain("Protocol,Species,Restraint method");
    expect(text).toContain("IACUC-2026-0150,Rat,Rat restrainer cone");
  });

  test("disables the CSV button when a report has no rows", async () => {
    api.getReports.mockResolvedValue({
      generated_at: "2026-08-09T12:00:00.000Z",
      reports: {
        restraint_by_species: [],
        euthanasia_by_species: [],
        surgery_locations: [],
        multiple_major_recovery_surgery: [],
        analgesic_anesthetic_drugs: [],
        use_locations_by_species: [],
      },
    });
    renderPage();

    await waitFor(() => expect(screen.getByText("No protocols report prolonged restraint.")).toBeInTheDocument());
    expect(screen.getAllByRole("button", { name: /Download CSV/ })[0]).toBeDisabled();
  });
});
