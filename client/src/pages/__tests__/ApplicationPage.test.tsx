import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import ApplicationPage from "../ApplicationPage";
import { api as realApi } from "../../api";
import type {
  Alternatives,
  AnimalUseRow,
  DrugRow,
  Procedure,
  ProtocolDetail,
} from "../../types";

vi.mock("../../api", () => ({
  api: {
    getProtocol: vi.fn(),
    listProcedures: vi.fn(),
    listDrugs: vi.fn(),
    listAnimalUse: vi.fn(),
    getAlternatives: vi.fn(),
    updateProtocol: vi.fn(),
    updateProcedures: vi.fn(),
    createDrug: vi.fn(),
    updateDrug: vi.fn(),
    deleteDrug: vi.fn(),
    createAnimalUse: vi.fn(),
    updateAnimalUse: vi.fn(),
    deleteAnimalUse: vi.fn(),
    updateAlternatives: vi.fn(),
  },
}));

const api = vi.mocked(realApi);

const PROTOCOL: ProtocolDetail = {
  id: "IACUC-2026-0142",
  title: "Neurobehavioral Effects of Chronic Stress in C57BL/6 Mice",
  pi: "Dr. Elena Marsh",
  pi_proxy: "Sam Whitfield",
  ptm_member: "Dr. Harold Kim",
  protocol_type: "Research",
  species: "Mouse",
  animals: 240,
  pain_category: "Category D",
  anesthesia_required: 1,
  housing: "Group-housed, enrichment",
  disposal: "CO2 euthanasia, incineration",
  npg: null,
  research_steps: ["Habituate animals", "Apply stressor"],
  purpose_summary: "Understanding how chronic stress affects behavior",
  harm_benefit_analysis: "Mild distress vs. long-term benefit",
  scientific_summary: "Mice exposed to chronic restraint stress",
  status: "IACUC Review",
  submitted: "2026-06-30",
  expires: null,
  stages: ["Draft", "Submitted", "Veterinary Review", "IACUC Review", "Approved", "Active"],
  related: {},
};

const PROCEDURES: Procedure[] = [
  { procedure_key: "anesthesia", label: "Anesthesia", checked: true, description: "Isoflurane" },
  { procedure_key: "breeding", label: "Breeding", checked: false, description: "" },
  { procedure_key: "survival_surgery", label: "Survival surgery", checked: false, description: "" },
];

const DRUGS: DrugRow[] = [
  {
    id: 1,
    protocol_id: "IACUC-2026-0142",
    reason_for_use: "Anesthesia",
    drug: "Isoflurane",
    dose: "2-3%",
    route: "Inhalation",
    duration: "15 min",
  },
];

const ANIMAL_USE: AnimalUseRow[] = [
  {
    id: 1,
    protocol_id: "IACUC-2026-0142",
    species_strain: "C57BL/6 mouse",
    sex: "Female",
    approx_age: "8 weeks",
    max_count: 240,
  },
];

const ALTERNATIVES: Alternatives = {
  protocol_id: "IACUC-2026-0142",
  replacement_text: "Cell culture models considered",
  refinement_text: "Refined endpoints",
  reduction_text: "Power analysis",
  lit_databases: "PubMed, AGRICOLA",
  lit_years_from: "2019",
  lit_years_to: "2026",
  lit_search_date: "2026-06-01",
  lit_keywords: "chronic stress, alternatives",
  lit_summary: "No full alternatives found",
  colleague_name: "Dr. Priya Nair",
  colleague_date: "2026-05-15",
  colleague_notes: "Suggested refinement",
  av_consult_date: null,
  av_consultation_required: true,
};

function renderApplicationPage() {
  return render(
    <MemoryRouter initialEntries={["/protocols/IACUC-2026-0142/application"]}>
      <Routes>
        <Route path="/protocols/:id/application" element={<ApplicationPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("ApplicationPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.getProtocol.mockResolvedValue(PROTOCOL);
    api.listProcedures.mockResolvedValue(PROCEDURES);
    api.listDrugs.mockResolvedValue(DRUGS);
    api.listAnimalUse.mockResolvedValue(ANIMAL_USE);
    api.getAlternatives.mockResolvedValue(ALTERNATIVES);
    api.updateProtocol.mockResolvedValue(PROTOCOL);
    api.updateProcedures.mockResolvedValue({ ok: true });
    api.createDrug.mockResolvedValue({ ...DRUGS[0] });
    api.deleteDrug.mockResolvedValue(null);
    api.createAnimalUse.mockResolvedValue({ ...ANIMAL_USE[0] });
    api.deleteAnimalUse.mockResolvedValue(null);
    api.updateAlternatives.mockResolvedValue(ALTERNATIVES);
  });

  test("shows a loading state before data resolves", () => {
    api.getProtocol.mockReturnValue(new Promise<ProtocolDetail>(() => {}));

    renderApplicationPage();
    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });

  test("renders all Appendix A sections pre-filled from the loaded data", async () => {
    renderApplicationPage();

    await waitFor(() => {
      expect(screen.getByText("Purpose & summary")).toBeInTheDocument();
    });
    expect(screen.getByText("Procedures applied to animals")).toBeInTheDocument();
    expect(screen.getByText("Drugs / dosing")).toBeInTheDocument();
    expect(screen.getByText("Animal use")).toBeInTheDocument();
    expect(screen.getByText("3 Rs & alternatives")).toBeInTheDocument();

    expect(screen.getByLabelText("Lay purpose")).toHaveValue(PROTOCOL.purpose_summary);
    expect(screen.getByLabelText("Harm–benefit analysis")).toHaveValue(PROTOCOL.harm_benefit_analysis);
    expect(screen.getByLabelText("Scientific summary")).toHaveValue(PROTOCOL.scientific_summary);

    // the checked Anesthesia procedure shows its narrative
    expect(screen.getByRole("checkbox", { name: /Anesthesia/ })).toBeChecked();
    expect(screen.getByLabelText("Anesthesia description")).toHaveValue("Isoflurane");

    // the drug table row and animal-use row render
    expect(screen.getAllByText("Isoflurane").length).toBeGreaterThan(0);
    expect(screen.getByText("C57BL/6 mouse")).toBeInTheDocument();
  });

  test("saving summaries calls updateProtocol and shows confirmation", async () => {
    const user = userEvent.setup();
    renderApplicationPage();

    await waitFor(() => {
      expect(screen.getByLabelText("Lay purpose")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Save summaries" }));

    await waitFor(() => {
      expect(api.updateProtocol).toHaveBeenCalledWith(
        "IACUC-2026-0142",
        expect.objectContaining({ purpose_summary: PROTOCOL.purpose_summary })
      );
    });
    expect(screen.getByText("Saved summaries")).toBeInTheDocument();
  });

  test("checking a procedure reveals a narrative field and Save sends the checklist", async () => {
    const user = userEvent.setup();
    renderApplicationPage();

    await waitFor(() => {
      expect(screen.getByRole("checkbox", { name: /Breeding/ })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("checkbox", { name: /Breeding/ }));
    const narrative = screen.getByLabelText("Breeding description");
    await user.type(narrative, "Breeding to maintain colony");

    await user.click(screen.getByRole("button", { name: "Save procedures" }));

    await waitFor(() => {
      expect(api.updateProcedures).toHaveBeenCalledWith(
        "IACUC-2026-0142",
        expect.arrayContaining([
          expect.objectContaining({ procedure_key: "breeding", checked: true, description: "Breeding to maintain colony" }),
        ])
      );
    });
    expect(screen.getByText("Saved procedures")).toBeInTheDocument();
  });

  test("adding a drug calls createDrug and refreshes the table", async () => {
    const user = userEvent.setup();
    renderApplicationPage();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Add drug" })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Add drug" }));
    await user.type(screen.getByLabelText("Drug"), "Ketamine");
    await user.type(screen.getByLabelText("Dose"), "80 mg/kg");
    await user.click(screen.getByRole("button", { name: "Save drug" }));

    await waitFor(() => {
      expect(api.createDrug).toHaveBeenCalledWith(
        "IACUC-2026-0142",
        expect.objectContaining({ drug: "Ketamine", dose: "80 mg/kg" })
      );
    });
    expect(api.listDrugs).toHaveBeenCalled();
  });

  test("deleting a drug calls deleteDrug", async () => {
    const user = userEvent.setup();
    renderApplicationPage();

    await waitFor(() => {
      expect(screen.getByLabelText("Delete Isoflurane")).toBeInTheDocument();
    });

    await user.click(screen.getByLabelText("Delete Isoflurane"));

    await waitFor(() => {
      expect(api.deleteDrug).toHaveBeenCalledWith("IACUC-2026-0142", 1);
    });
  });

  test("adding an animal-use row calls createAnimalUse", async () => {
    const user = userEvent.setup();
    renderApplicationPage();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Add animal use" })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Add animal use" }));
    await user.type(screen.getByLabelText("Species / strain"), "Wistar rat");
    await user.type(screen.getByLabelText("Max count"), "40");
    await user.click(screen.getByRole("button", { name: "Save animal use" }));

    await waitFor(() => {
      expect(api.createAnimalUse).toHaveBeenCalledWith(
        "IACUC-2026-0142",
        expect.objectContaining({ species_strain: "Wistar rat", max_count: 40 })
      );
    });
  });

  test("saving alternatives calls updateAlternatives with the AV consult date", async () => {
    const user = userEvent.setup();
    renderApplicationPage();

    await waitFor(() => {
      expect(screen.getByLabelText("Databases")).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText("AV consultation date"), "2026-07-01");
    await user.click(screen.getByRole("button", { name: "Save 3 Rs & alternatives" }));

    await waitFor(() => {
      expect(api.updateAlternatives).toHaveBeenCalledWith(
        "IACUC-2026-0142",
        expect.objectContaining({ av_consult_date: "2026-07-01" })
      );
    });
    expect(screen.getByText("Saved 3 Rs & alternatives")).toBeInTheDocument();
  });

  test("shows the AV consultation requirement banner for a Category D/E protocol without a date", async () => {
    renderApplicationPage();

    await waitFor(() => {
      expect(screen.getByText(/an Attending Veterinarian consultation is required/i)).toBeInTheDocument();
    });
  });

  test("shows an error message and back link if the initial load fails", async () => {
    api.getProtocol.mockRejectedValue(new Error("Network error"));

    renderApplicationPage();

    await waitFor(() => {
      expect(screen.getByText(/Couldn't load application: Network error/)).toBeInTheDocument();
    });
    expect(screen.getByRole("link", { name: "Back to list" })).toBeInTheDocument();
  });

  test("editing a drug pre-fills the modal and calls updateDrug", async () => {
    const user = userEvent.setup();
    renderApplicationPage();

    await waitFor(() => {
      expect(screen.getByLabelText("Edit Isoflurane")).toBeInTheDocument();
    });

    await user.click(screen.getByLabelText("Edit Isoflurane"));
    expect(screen.getByLabelText("Drug")).toHaveValue("Isoflurane");
    await user.clear(screen.getByLabelText("Dose"));
    await user.type(screen.getByLabelText("Dose"), "3%");
    await user.click(screen.getByRole("button", { name: "Save drug" }));

    await waitFor(() => {
      expect(api.updateDrug).toHaveBeenCalledWith(
        "IACUC-2026-0142",
        1,
        expect.objectContaining({ drug: "Isoflurane", dose: "3%" })
      );
    });
  });

  test("editing an animal-use row calls updateAnimalUse", async () => {
    const user = userEvent.setup();
    renderApplicationPage();

    await waitFor(() => {
      expect(screen.getByLabelText("Edit C57BL/6 mouse")).toBeInTheDocument();
    });

    await user.click(screen.getByLabelText("Edit C57BL/6 mouse"));
    await user.clear(screen.getByLabelText("Sex"));
    await user.type(screen.getByLabelText("Sex"), "Male");
    await user.click(screen.getByRole("button", { name: "Save animal use" }));

    await waitFor(() => {
      expect(api.updateAnimalUse).toHaveBeenCalledWith(
        "IACUC-2026-0142",
        1,
        expect.objectContaining({ sex: "Male" })
      );
    });
  });

  test("deleting an animal-use row calls deleteAnimalUse", async () => {
    const user = userEvent.setup();
    renderApplicationPage();

    await waitFor(() => {
      expect(screen.getByLabelText("Delete C57BL/6 mouse")).toBeInTheDocument();
    });

    await user.click(screen.getByLabelText("Delete C57BL/6 mouse"));

    await waitFor(() => {
      expect(api.deleteAnimalUse).toHaveBeenCalledWith("IACUC-2026-0142", 1);
    });
  });

  test("surfaces a table action error when a drug save fails", async () => {
    api.createDrug.mockRejectedValue(new Error("drug create failed"));
    const user = userEvent.setup();
    renderApplicationPage();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Add drug" })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Add drug" }));
    await user.type(screen.getByLabelText("Drug"), "Ketamine");
    await user.click(screen.getByRole("button", { name: "Save drug" }));

    await waitFor(() => {
      expect(screen.getByText("drug create failed")).toBeInTheDocument();
    });
  });
});
