import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router";
import DetailPage from "../DetailPage";
import { api as realApi } from "../../api";
import type { ProtocolDetail } from "../../types";

vi.mock("../../api", () => ({
  api: {
    getProtocol: vi.fn(),
    listSpecies: vi.fn(),
    updateProtocol: vi.fn(),
    getProtocolPersonnel: vi.fn(),
    listPersonnel: vi.fn(),
    listTransfers: vi.fn(),
    createTransfer: vi.fn(),
  },
}));

vi.mock("react-router", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...(actual as object), useNavigate: vi.fn() };
});

const api = vi.mocked(realApi);

const SAMPLE_PROTOCOL: ProtocolDetail = {
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
  research_steps: [
    {
      description: "Habituate animals to handling",
      duration: "7 days",
      frequency: "Daily",
      species: "Mouse",
      pain_category: "Category B",
      anesthesia: "No",
      location: "Behavior suite",
      personnel: "Dr. Elena Marsh",
      notes: "",
    },
    {
      description: "Apply chronic stress paradigm",
      duration: "21 days",
      frequency: "Daily",
      species: "Mouse",
      pain_category: "Category D",
      anesthesia: "No",
      location: "Vivarium",
      personnel: "Sam Whitfield",
      notes: "",
    },
  ],
  purpose_summary: "Understanding how chronic stress affects behavior",
  harm_benefit_analysis: "Mild distress vs. long-term health benefit",
  scientific_summary: "C57BL/6 mice exposed to chronic restraint stress",
  status: "IACUC Review",
  submitted: "2026-06-30",
  expires: null,
  stages: ["Draft", "Submitted", "Veterinary Review", "IACUC Review", "Approved", "Active"],
  related: {
    Personnel: ["Dr. Elena Marsh — PI", "Sam Whitfield — Lab tech"],
    Amendments: ["AM-01 — Add second mouse strain (Pending)"],
  },
};

function renderDetailPage() {
  return render(
    <MemoryRouter initialEntries={["/protocols/IACUC-2026-0142"]}>
      <Routes>
        <Route path="/protocols/:id" element={<DetailPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("DetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.listPersonnel.mockResolvedValue([]);
    api.listTransfers.mockResolvedValue([]);
    api.getProtocolPersonnel.mockResolvedValue({
      protocol_id: "IACUC-2026-0142",
      personnel: [
        {
          label: "Dr. Elena Marsh — PI",
          name: "Dr. Elena Marsh",
          role: "PI",
          personnel_id: 1,
          compliance: { training_status: "Current", ohsp_status: "Cleared", compliant: true },
        },
        {
          label: "Sam Whitfield — Lab tech",
          name: "Sam Whitfield",
          role: "Lab tech",
          personnel_id: 2,
          compliance: { training_status: "No records", ohsp_status: "Pending", compliant: false },
        },
      ],
      all_compliant: false,
    });
  });

  test("shows a loading state before data resolves", () => {
    api.getProtocol.mockReturnValue(new Promise<ProtocolDetail>(() => {}));

    renderDetailPage();
    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });

  test("renders the protocol header and key fields once data resolves", async () => {
    api.getProtocol.mockResolvedValue(SAMPLE_PROTOCOL);

    renderDetailPage();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "IACUC-2026-0142" })).toBeInTheDocument();
    });
    expect(api.getProtocol).toHaveBeenCalledWith("IACUC-2026-0142");
    expect(screen.getByText("Dr. Elena Marsh")).toBeInTheDocument();
    expect(screen.getByText("Mouse")).toBeInTheDocument();
    expect(screen.getByText("240")).toBeInTheDocument();
    expect(screen.getByText("Category D")).toBeInTheDocument();
  });

  test("renders the stage stepper with the current status highlighted", async () => {
    api.getProtocol.mockResolvedValue(SAMPLE_PROTOCOL);

    renderDetailPage();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "IACUC-2026-0142" })).toBeInTheDocument();
    });
    for (const stage of SAMPLE_PROTOCOL.stages) {
      // The current status ("IACUC Review") also renders in the StatusBadge.
      const matches = screen.getAllByText(stage);
      expect(matches.length).toBeGreaterThanOrEqual(1);
    }
    expect(screen.getAllByText(SAMPLE_PROTOCOL.status).length).toBeGreaterThanOrEqual(2);
  });

  test("renders the protocol information section with title and dates", async () => {
    api.getProtocol.mockResolvedValue(SAMPLE_PROTOCOL);

    renderDetailPage();

    await waitFor(() => {
      expect(screen.getByText("Protocol information")).toBeInTheDocument();
    });
    expect(screen.getByText(SAMPLE_PROTOCOL.title)).toBeInTheDocument();
    expect(screen.getByText("2026-06-30")).toBeInTheDocument();
    expect(screen.getByText(SAMPLE_PROTOCOL.pi_proxy!)).toBeInTheDocument();
    expect(screen.getByText(SAMPLE_PROTOCOL.ptm_member!)).toBeInTheDocument();
    expect(screen.getByText(SAMPLE_PROTOCOL.protocol_type!)).toBeInTheDocument();
    // null expires renders an em dash
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });

  test("renders the animal care & use and research plan sections", async () => {
    api.getProtocol.mockResolvedValue(SAMPLE_PROTOCOL);

    renderDetailPage();

    await waitFor(() => {
      expect(screen.getByText("Animal care & use")).toBeInTheDocument();
    });
    expect(screen.getByText("Yes")).toBeInTheDocument();
    expect(screen.getByText("None")).toBeInTheDocument();
    expect(screen.getByText("Group-housed, enrichment")).toBeInTheDocument();
    expect(screen.getByText("CO2 euthanasia, incineration")).toBeInTheDocument();

    expect(screen.getByText("Research plan")).toBeInTheDocument();
    expect(screen.getByText(/Habituate animals to handling/)).toBeInTheDocument();
    expect(screen.getByText(/Apply chronic stress paradigm/)).toBeInTheDocument();
  });

  test("renders related-item lists with counts", async () => {
    api.getProtocol.mockResolvedValue(SAMPLE_PROTOCOL);

    renderDetailPage();

    await waitFor(() => {
      expect(screen.getByText("Personnel (2)")).toBeInTheDocument();
    });
    expect(screen.getByText("Amendments (1)")).toBeInTheDocument();
    expect(screen.getByText("Dr. Elena Marsh — PI")).toBeInTheDocument();
    expect(screen.getByText("AM-01 — Add second mouse strain (Pending)")).toBeInTheDocument();
  });

  test("renders compliance chips in the Personnel card for each person", async () => {
    api.getProtocol.mockResolvedValue(SAMPLE_PROTOCOL);

    renderDetailPage();

    await waitFor(() => {
      expect(screen.getByText("Compliant")).toBeInTheDocument();
    });
    expect(screen.getByText("Action needed")).toBeInTheDocument();
    expect(api.getProtocolPersonnel).toHaveBeenCalledWith("IACUC-2026-0142");
  });

  test("renders the study contact email derived from the PI name", async () => {
    api.getProtocol.mockResolvedValue(SAMPLE_PROTOCOL);

    renderDetailPage();

    await waitFor(() => {
      expect(screen.getByText("Study contact")).toBeInTheDocument();
    });
    expect(screen.getByText("elena@university.edu")).toBeInTheDocument();
  });

  test("navigates back via the IACUC Protocols breadcrumb button", async () => {
    api.getProtocol.mockResolvedValue(SAMPLE_PROTOCOL);
    const navigate = vi.fn();
    vi.mocked(useNavigate).mockReturnValue(navigate);
    const user = userEvent.setup();

    renderDetailPage();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "IACUC-2026-0142" })).toBeInTheDocument();
    });

    const backButton = screen.getByRole("button", { name: /IACUC Protocols/ });
    await user.click(backButton);
    expect(navigate).toHaveBeenCalledWith(-1);
  });

  test("shows an error message and back link if the API call fails", async () => {
    api.getProtocol.mockRejectedValue(new Error("Network error"));

    renderDetailPage();

    await waitFor(() => {
      expect(screen.getByText(/Couldn't load IACUC-2026-0142/)).toBeInTheDocument();
    });
    expect(screen.getByRole("link", { name: "Back to list" })).toBeInTheDocument();
  });

  test("does not set state after unmount (cancelled flag)", async () => {
    let resolve: (value: ProtocolDetail) => void;
    api.getProtocol.mockReturnValue(new Promise<ProtocolDetail>(r => { resolve = r; }));

    const { unmount } = renderDetailPage();
    unmount();
    resolve!(SAMPLE_PROTOCOL);
  });

  test("Edit button opens a pre-filled modal and Cancel closes it without saving", async () => {
    api.getProtocol.mockResolvedValue(SAMPLE_PROTOCOL);
    api.listSpecies.mockResolvedValue([{ id: 1, name: "Mouse" }, { id: 2, name: "Rat" }]);
    const user = userEvent.setup();

    renderDetailPage();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "IACUC-2026-0142" })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Edit" }));
    expect(screen.getByLabelText("Title")).toHaveValue(SAMPLE_PROTOCOL.title);
    expect(screen.getByLabelText("Principal investigator")).toHaveValue(SAMPLE_PROTOCOL.pi);
    expect(screen.getByLabelText("PI proxy")).toHaveValue(SAMPLE_PROTOCOL.pi_proxy);
    expect(screen.getByLabelText("PTM member")).toHaveValue(SAMPLE_PROTOCOL.ptm_member);
    expect(screen.getByLabelText("Type of IACUC protocol")).toHaveValue(SAMPLE_PROTOCOL.protocol_type);
    expect(screen.getByLabelText("Status")).toHaveValue(SAMPLE_PROTOCOL.status);
    expect(screen.getByLabelText("Species")).toHaveValue(SAMPLE_PROTOCOL.species);
    expect(screen.getByLabelText("Number of animals")).toHaveValue(240);
    expect(screen.getByLabelText("Pain category")).toHaveValue(SAMPLE_PROTOCOL.pain_category);
    expect(screen.getByLabelText("Submitted")).toHaveValue(SAMPLE_PROTOCOL.submitted);
    expect(screen.getByLabelText("Expires")).toHaveValue("");

    // anesthesia: Yes is checked; NPG: No is checked
    const radios = screen.getAllByRole("radio");
    expect((radios[0] as HTMLInputElement).checked).toBe(true);
    expect((radios[3] as HTMLInputElement).checked).toBe(true);

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(api.updateProtocol).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("Title")).not.toBeInTheDocument();
  });

  test("saving edits calls updateProtocol and refreshes the detail view", async () => {
    const updated = { ...SAMPLE_PROTOCOL, title: "Updated Owl Title", animals: 100 };
    api.getProtocol.mockResolvedValueOnce(SAMPLE_PROTOCOL).mockResolvedValueOnce(updated);
    api.listSpecies.mockResolvedValue([{ id: 1, name: "Mouse" }]);
    api.updateProtocol.mockResolvedValue(updated);
    const user = userEvent.setup();

    renderDetailPage();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "IACUC-2026-0142" })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.clear(screen.getByLabelText("Title"));
    await user.type(screen.getByLabelText("Title"), "Updated Owl Title");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => {
      expect(api.updateProtocol).toHaveBeenCalledWith(
        "IACUC-2026-0142",
        expect.objectContaining({ title: "Updated Owl Title" })
      );
    });
    await waitFor(() => {
      expect(screen.getByText("Updated Owl Title")).toBeInTheDocument();
    });
    expect(api.getProtocol).toHaveBeenCalledTimes(2);
    expect(screen.queryByLabelText("Title")).not.toBeInTheDocument();
  });

  test("shows an inline error when saving fails and keeps the modal open", async () => {
    api.getProtocol.mockResolvedValue(SAMPLE_PROTOCOL);
    api.listSpecies.mockResolvedValue([]);
    api.updateProtocol.mockRejectedValue(new Error("Validation failed"));
    const user = userEvent.setup();

    renderDetailPage();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "IACUC-2026-0142" })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => {
      expect(screen.getByText("Validation failed")).toBeInTheDocument();
    });
    expect(screen.getByLabelText("Title")).toBeInTheDocument();
  });

  test("edit modal keeps a status that isn't in the standard stage list", async () => {
    const withOddStatus = { ...SAMPLE_PROTOCOL, status: "Expiring soon" };
    api.getProtocol.mockResolvedValue(withOddStatus);
    api.listSpecies.mockResolvedValue([]);
    const user = userEvent.setup();

    renderDetailPage();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "IACUC-2026-0142" })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Edit" }));
    expect(screen.getByLabelText("Status")).toHaveValue("Expiring soon");
  });

  test("Transfer ownership button opens the modal and submitting calls createTransfer", async () => {
    api.getProtocol.mockResolvedValue(SAMPLE_PROTOCOL);
    api.listPersonnel.mockResolvedValue([
      { id: 3, name: "Dr. Hana Sato", email: null, role_id: 1, role_name: "Principal Investigator", is_committee: 0 },
    ]);
    api.createTransfer.mockResolvedValue({} as never);
    const user = userEvent.setup();

    renderDetailPage();
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "IACUC-2026-0142" })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Transfer ownership" }));
    expect(screen.getByText("New principal investigator")).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("New principal investigator"), "3");
    await user.type(
      screen.getByLabelText("Reason for transfer (required)"),
      "Dr. Marsh is leaving the institution."
    );
    await user.click(screen.getByRole("button", { name: "Request transfer" }));

    await waitFor(() => {
      expect(api.createTransfer).toHaveBeenCalledWith("IACUC-2026-0142", {
        to_personnel_id: 3,
        reason: "Dr. Marsh is leaving the institution.",
      });
    });
    expect(api.listTransfers).toHaveBeenCalledWith("Pending");
  });

  test("transfer modal shows a pending-notice instead of the form when a request is in flight", async () => {
    api.getProtocol.mockResolvedValue(SAMPLE_PROTOCOL);
    api.listTransfers.mockResolvedValue([
      {
        id: 7,
        protocol_id: "IACUC-2026-0142",
        protocol_title: SAMPLE_PROTOCOL.title,
        from_pi: SAMPLE_PROTOCOL.pi,
        to_personnel_id: 3,
        to_name: "Dr. Hana Sato",
        reason: "PI is leaving.",
        status: "Pending",
        created_at: "2026-07-01",
        decision_date: null,
      },
    ]);
    const user = userEvent.setup();

    renderDetailPage();
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "IACUC-2026-0142" })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Transfer ownership" }));

    await waitFor(() => {
      expect(screen.getByText(/already pending for this protocol/)).toBeInTheDocument();
    });
    expect(screen.queryByRole("button", { name: "Request transfer" })).not.toBeInTheDocument();
  });
});
