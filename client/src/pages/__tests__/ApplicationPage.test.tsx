import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import ApplicationPage from "../ApplicationPage";
import { api as realApi } from "../../api";
import type {
  Alternatives,
  AnimalUsageLedger,
  AnimalUseRow,
  DrugRow,
  ExperimentRow,
  Procedure,
  ProtocolDetail,
  RrrEntry,
  ValidationResult,
} from "../../types";

vi.mock("../../api", () => ({
  api: {
    getProtocol: vi.fn(),
    listProcedures: vi.fn(),
    listDrugs: vi.fn(),
    listAnimalUse: vi.fn(),
    listExperiments: vi.fn(),
    getAlternatives: vi.fn(),
    listRrrEntries: vi.fn(),
    getValidation: vi.fn(),
    updateProtocol: vi.fn(),
    updateProcedures: vi.fn(),
    createDrug: vi.fn(),
    updateDrug: vi.fn(),
    deleteDrug: vi.fn(),
    createAnimalUse: vi.fn(),
    updateAnimalUse: vi.fn(),
    deleteAnimalUse: vi.fn(),
    createExperiment: vi.fn(),
    updateExperiment: vi.fn(),
    deleteExperiment: vi.fn(),
    createRrrEntry: vi.fn(),
    updateRrrEntry: vi.fn(),
    deleteRrrEntry: vi.fn(),
    updateAlternatives: vi.fn(),
    listAnimalUsage: vi.fn(),
    createAnimalUsage: vi.fn(),
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
  {
    procedure_key: "anesthesia",
    label: "Anesthesia",
    checked: true,
    description: "Isoflurane",
    surgical_description: "",
    aseptic_preparation: "",
    analgesia_level: "",
    postop_care: "",
  },
  {
    procedure_key: "breeding",
    label: "Breeding",
    checked: false,
    description: "",
    surgical_description: "",
    aseptic_preparation: "",
    analgesia_level: "",
    postop_care: "",
  },
  {
    procedure_key: "survival_surgery",
    label: "Survival surgery",
    checked: true,
    description: "Coronary artery ligation",
    surgical_description: "LAD ligation via thoracotomy",
    aseptic_preparation: "Clipped, chlorhexidine prep, sterile instruments",
    analgesia_level: "Moderate",
    postop_care: "Monitored twice daily for 72 h",
  },
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

const EXPERIMENTS: ExperimentRow[] = [
  {
    id: 1,
    protocol_id: "IACUC-2026-0142",
    name: "Chronic restraint stress",
    description: "4 weeks of daily restraint, 6 h/day",
    multiple_surgical_events: 0,
    humane_endpoints: "Weight loss > 20%",
    persistent_clinical_signs_justification: null,
    monitoring_plan: "Daily scoring",
    husbandry_exceptions: null,
  },
];

const ALTERNATIVES: Alternatives = {
  protocol_id: "IACUC-2026-0142",
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

const RRR_ENTRIES: RrrEntry[] = [
  { id: 1, protocol_id: "IACUC-2026-0142", rrr_type: "replacement", method: "Cell culture models", explanation: "Cell culture models considered" },
  { id: 2, protocol_id: "IACUC-2026-0142", rrr_type: "refinement", method: "Refined endpoints", explanation: "Refined endpoints used" },
  { id: 3, protocol_id: "IACUC-2026-0142", rrr_type: "reduction", method: "Power analysis", explanation: "Power analysis employed" },
];

const VALIDATION: ValidationResult = {
  overall: false,
  avRequired: true,
  sections: {
    summaries: { complete: true, missing: [] },
    procedures: { complete: true, missing: [] },
    drugs: { complete: true, missing: [] },
    animal_use: { complete: true, missing: [] },
    experiments: { complete: true, missing: [] },
    alternatives: { complete: false, missing: ["Attending Veterinarian consult date", "At least 2 databases"] },
  },
};

const USAGE_LEDGER: AnimalUsageLedger = {
  transactions: [
    {
      id: 1,
      protocol_id: "IACUC-2026-0142",
      transaction_date: "2026-07-10",
      species_strain: "C57BL/6 mouse",
      pain_level: "C",
      quantity: 55,
      type: "use",
      procedure_key: "injections",
      notes: "Weekly cohort",
      created_at: "2026-07-10 12:00:00",
    },
    {
      id: 2,
      protocol_id: "IACUC-2026-0142",
      transaction_date: "2026-07-01",
      species_strain: "C57BL/6 mouse",
      pain_level: "C",
      quantity: 60,
      type: "order",
      procedure_key: null,
      notes: null,
      created_at: "2026-07-01 09:00:00",
    },
  ],
  by_species: [
    {
      species_strain: "C57BL/6 mouse",
      allowance: 240,
      ordered: 60,
      used: 55,
      remaining: 125,
      over_allowance: false,
    },
  ],
  by_pain_category: [{ pain_level: "C", count: 2 }],
  by_procedure: [{ procedure_key: "injections", count: 1 }],
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
    api.listExperiments.mockResolvedValue(EXPERIMENTS);
    api.getAlternatives.mockResolvedValue(ALTERNATIVES);
    api.listRrrEntries.mockResolvedValue(RRR_ENTRIES);
    api.getValidation.mockResolvedValue(VALIDATION);
    api.updateProtocol.mockResolvedValue(PROTOCOL);
    api.updateProcedures.mockResolvedValue({ ok: true });
    api.createDrug.mockResolvedValue({ ...DRUGS[0] });
    api.deleteDrug.mockResolvedValue(null);
    api.createAnimalUse.mockResolvedValue({ ...ANIMAL_USE[0] });
    api.deleteAnimalUse.mockResolvedValue(null);
    api.createExperiment.mockResolvedValue({ ...EXPERIMENTS[0] });
    api.deleteExperiment.mockResolvedValue(null);
    api.createRrrEntry.mockResolvedValue({ ...RRR_ENTRIES[0] });
    api.deleteRrrEntry.mockResolvedValue(null);
    api.updateAlternatives.mockResolvedValue(ALTERNATIVES);
    api.listAnimalUsage.mockResolvedValue(USAGE_LEDGER);
    api.createAnimalUsage.mockResolvedValue({ ...USAGE_LEDGER.transactions[0] });
  });

  test("shows a loading state before data resolves", () => {
    api.getProtocol.mockReturnValue(new Promise<ProtocolDetail>(() => {}));

    renderApplicationPage();
    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });

  test("renders all Appendix A sections pre-filled from the loaded data", async () => {
    renderApplicationPage();

    await waitFor(() => {
      expect(screen.getAllByText("Purpose & summary").length).toBeGreaterThan(0);
    });
    expect(screen.getByText("Procedures applied to animals")).toBeInTheDocument();
    expect(screen.getAllByText("Drugs / dosing").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Animal use").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Experiments").length).toBeGreaterThan(0);
    expect(screen.getAllByText("3 Rs & alternatives").length).toBeGreaterThan(0);
    expect(screen.getByText("Submission readiness")).toBeInTheDocument();

    expect(screen.getByLabelText("Lay purpose")).toHaveValue(PROTOCOL.purpose_summary);
    expect(screen.getByLabelText("Harm–benefit analysis")).toHaveValue(PROTOCOL.harm_benefit_analysis);
    expect(screen.getByLabelText("Scientific summary")).toHaveValue(PROTOCOL.scientific_summary);

    // the checked Anesthesia procedure shows its narrative
    expect(screen.getByRole("checkbox", { name: /Anesthesia/ })).toBeChecked();
    expect(screen.getByLabelText("Anesthesia description")).toHaveValue("Isoflurane");

    // the drug table row and animal-use row render
    expect(screen.getAllByText("Isoflurane").length).toBeGreaterThan(0);
    expect(screen.getAllByText("C57BL/6 mouse").length).toBeGreaterThan(0);
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

  test("shows surgical detail fields for a checked surgery procedure and Save sends them", async () => {
    const user = userEvent.setup();
    renderApplicationPage();

    await waitFor(() => {
      expect(screen.getByRole("checkbox", { name: /Survival surgery/ })).toBeInTheDocument();
    });

    // the checked surgery procedure shows its expanded detail block
    const surgicalDesc = screen.getByLabelText("Survival surgery surgical description");
    expect(surgicalDesc).toHaveValue("LAD ligation via thoracotomy");
    expect(screen.getByLabelText("Survival surgery aseptic preparation")).toHaveValue(
      "Clipped, chlorhexidine prep, sterile instruments"
    );
    expect(screen.getByLabelText("Survival surgery analgesia level")).toHaveValue("Moderate");
    expect(screen.getByLabelText("Survival surgery post-operative care")).toHaveValue(
      "Monitored twice daily for 72 h"
    );

    // survival surgery is the only surgery key that shows post-op care
    await user.click(screen.getByRole("button", { name: "Save procedures" }));

    await waitFor(() => {
      expect(api.updateProcedures).toHaveBeenCalledWith(
        "IACUC-2026-0142",
        expect.arrayContaining([
          expect.objectContaining({
            procedure_key: "survival_surgery",
            surgical_description: "LAD ligation via thoracotomy",
            aseptic_preparation: "Clipped, chlorhexidine prep, sterile instruments",
            analgesia_level: "Moderate",
            postop_care: "Monitored twice daily for 72 h",
          }),
        ])
      );
    });
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

  test("renders the animal usage register with tallies and transactions", async () => {
    renderApplicationPage();

    await waitFor(() => {
      expect(screen.getByText("Animal usage register")).toBeInTheDocument();
    });
    // per-species tally row with allowance/ordered/used/remaining
    expect(screen.getAllByText("C57BL/6 mouse").length).toBeGreaterThan(0);
    expect(screen.getByText("Within allowance")).toBeInTheDocument();
    // transactions list
    expect(screen.getByText("Weekly cohort")).toBeInTheDocument();
    expect(screen.getByText("order")).toBeInTheDocument();
    expect(screen.getByText("injections")).toBeInTheDocument();
  });

  test("marks a species over its allowance with a warning badge", async () => {
    api.listAnimalUsage.mockResolvedValue({
      transactions: [],
      by_species: [
        {
          species_strain: "Rabbit",
          allowance: 60,
          ordered: 30,
          used: 40,
          remaining: -10,
          over_allowance: true,
        },
      ],
      by_pain_category: [],
      by_procedure: [],
    });

    renderApplicationPage();

    await waitFor(() => {
      expect(screen.getByText("Over allowance")).toBeInTheDocument();
    });
  });

  test("logging a usage transaction calls createAnimalUsage and closes the modal", async () => {
    const user = userEvent.setup();
    renderApplicationPage();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Log usage" })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Log usage" }));
    await user.type(screen.getByLabelText("Species / strain"), "Wistar rat");
    await user.type(screen.getByLabelText("Quantity"), "20");
    await user.selectOptions(screen.getByLabelText("Type"), "order");
    await user.click(screen.getByRole("button", { name: "Save usage" }));

    await waitFor(() => {
      expect(api.createAnimalUsage).toHaveBeenCalledWith(
        "IACUC-2026-0142",
        expect.objectContaining({ species_strain: "Wistar rat", quantity: 20, type: "order" })
      );
    });
    await waitFor(() => {
      expect(screen.queryByLabelText("Quantity")).not.toBeInTheDocument();
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

  test("adding an experiment calls createExperiment", async () => {
    const user = userEvent.setup();
    renderApplicationPage();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Add experiment" })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Add experiment" }));
    await user.type(screen.getByLabelText("Experiment name"), "Penetrating keratoplasty");
    await user.click(screen.getByRole("button", { name: "Save experiment" }));

    await waitFor(() => {
      expect(api.createExperiment).toHaveBeenCalledWith(
        "IACUC-2026-0142",
        expect.objectContaining({ name: "Penetrating keratoplasty", multiple_surgical_events: 0 })
      );
    });
  });

  test("editing an experiment pre-fills the modal and calls updateExperiment", async () => {
    const user = userEvent.setup();
    renderApplicationPage();

    await waitFor(() => {
      expect(screen.getByLabelText("Edit Chronic restraint stress")).toBeInTheDocument();
    });

    await user.click(screen.getByLabelText("Edit Chronic restraint stress"));
    expect(screen.getByLabelText("Experiment name")).toHaveValue("Chronic restraint stress");
    await user.type(screen.getByLabelText("Experiment name"), " Protocol A");
    await user.click(screen.getByRole("button", { name: "Save experiment" }));

    await waitFor(() => {
      expect(api.updateExperiment).toHaveBeenCalledWith(
        "IACUC-2026-0142",
        1,
        expect.objectContaining({ name: "Chronic restraint stress Protocol A" })
      );
    });
  });

  test("deleting an experiment calls deleteExperiment", async () => {
    const user = userEvent.setup();
    renderApplicationPage();

    await waitFor(() => {
      expect(screen.getByLabelText("Delete Chronic restraint stress")).toBeInTheDocument();
    });

    await user.click(screen.getByLabelText("Delete Chronic restraint stress"));

    await waitFor(() => {
      expect(api.deleteExperiment).toHaveBeenCalledWith("IACUC-2026-0142", 1);
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

  test("renders structured 3 Rs justifications from the loaded entries", async () => {
    renderApplicationPage();

    await waitFor(() => {
      expect(screen.getByText("Cell culture models")).toBeInTheDocument();
    });
    expect(screen.getByText("Refined endpoints")).toBeInTheDocument();
    expect(screen.getByText("Power analysis")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add Replacement justification" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add Refinement justification" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add Reduction justification" })).toBeInTheDocument();
  });

  test("adding a 3 Rs justification calls createRrrEntry", async () => {
    const user = userEvent.setup();
    renderApplicationPage();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Add Replacement justification" })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Add Replacement justification" }));
    await user.type(screen.getByLabelText("Method"), "In-vitro pre-screening");
    await user.type(screen.getByLabelText("Explanation"), "Screening compounds in cell lines first");
    await user.click(screen.getByRole("button", { name: "Save 3 Rs justification" }));

    await waitFor(() => {
      expect(api.createRrrEntry).toHaveBeenCalledWith(
        "IACUC-2026-0142",
        expect.objectContaining({ rrr_type: "replacement", method: "In-vitro pre-screening", explanation: "Screening compounds in cell lines first" })
      );
    });
  });

  test("editing a 3 Rs justification pre-fills the modal and calls updateRrrEntry", async () => {
    const user = userEvent.setup();
    renderApplicationPage();

    await waitFor(() => {
      expect(screen.getByLabelText("Edit Cell culture models")).toBeInTheDocument();
    });

    await user.click(screen.getByLabelText("Edit Cell culture models"));
    expect(screen.getByLabelText("Method")).toHaveValue("Cell culture models");
    await user.clear(screen.getByLabelText("Method"));
    await user.type(screen.getByLabelText("Method"), "Organoids and cell lines");
    await user.click(screen.getByRole("button", { name: "Save 3 Rs justification" }));

    await waitFor(() => {
      expect(api.updateRrrEntry).toHaveBeenCalledWith(
        "IACUC-2026-0142",
        1,
        expect.objectContaining({ method: "Organoids and cell lines", explanation: "Cell culture models considered" })
      );
    });
  });

  test("deleting a 3 Rs justification calls deleteRrrEntry", async () => {
    const user = userEvent.setup();
    renderApplicationPage();

    await waitFor(() => {
      expect(screen.getByLabelText("Delete Cell culture models")).toBeInTheDocument();
    });

    await user.click(screen.getByLabelText("Delete Cell culture models"));

    await waitFor(() => {
      expect(api.deleteRrrEntry).toHaveBeenCalledWith("IACUC-2026-0142", 1);
    });
  });

  test("shows the submission readiness panel with incomplete sections flagged", async () => {
    api.getProtocol.mockResolvedValue({ ...PROTOCOL, status: "Draft" });
    renderApplicationPage();

    await waitFor(() => {
      expect(screen.getByText("Submission readiness")).toBeInTheDocument();
    });
    expect(screen.getByText("Attending Veterinarian consult date")).toBeInTheDocument();
    expect(screen.getByText("At least 2 databases")).toBeInTheDocument();
    expect(screen.getByText("Not ready yet — complete the flagged sections.")).toBeInTheDocument();
  });

  test("submit stays disabled until validation passes", async () => {
    api.getProtocol.mockResolvedValue({ ...PROTOCOL, status: "Draft" });
    const user = userEvent.setup();
    renderApplicationPage();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Submit protocol" })).toBeDisabled();
    });

    await user.click(screen.getByRole("button", { name: "Submit protocol" }));
    expect(api.updateProtocol).not.toHaveBeenCalled();
  });

  test("submit refuses when a re-check finds incomplete sections", async () => {
    api.getProtocol.mockResolvedValue({ ...PROTOCOL, status: "Draft" });
    api.getValidation
      .mockResolvedValueOnce({
        ...VALIDATION,
        overall: true,
        sections: { ...VALIDATION.sections, alternatives: { complete: true, missing: [] } },
      })
      .mockResolvedValueOnce({ ...VALIDATION, overall: false });
    const user = userEvent.setup();
    renderApplicationPage();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Submit protocol" })).toBeEnabled();
    });

    await user.click(screen.getByRole("button", { name: "Submit protocol" }));

    await waitFor(() => {
      expect(screen.getByText("Complete all required sections first.")).toBeInTheDocument();
    });
    expect(api.updateProtocol).not.toHaveBeenCalled();
  });

  test("submits a complete Draft protocol for review", async () => {
    api.getProtocol.mockResolvedValue({ ...PROTOCOL, status: "Draft" });
    api.getValidation.mockResolvedValue({
      ...VALIDATION,
      overall: true,
      sections: { ...VALIDATION.sections, alternatives: { complete: true, missing: [] } },
    });
    api.updateProtocol.mockResolvedValue({ ...PROTOCOL, status: "Submitted" });
    const user = userEvent.setup();
    renderApplicationPage();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Submit protocol" })).toBeEnabled();
    });

    await user.click(screen.getByRole("button", { name: "Submit protocol" }));

    await waitFor(() => {
      expect(api.updateProtocol).toHaveBeenCalledWith(
        "IACUC-2026-0142",
        expect.objectContaining({ status: "Submitted" })
      );
    });
    expect(screen.getByText("Protocol submitted for review.")).toBeInTheDocument();
    expect(screen.getByText("Status: Submitted")).toBeInTheDocument();
  });
});
