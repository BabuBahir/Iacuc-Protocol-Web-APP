import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import AmendmentsPage from "../AmendmentsPage";
import { api as realApi } from "../../api";
import type { Amendment, Protocol, ProtocolVersion, Renewal } from "../../types";

vi.mock("../../api", () => ({
  api: {
    listProtocols: vi.fn(),
    listAmendments: vi.fn(),
    createAmendment: vi.fn(),
    addAmendmentChange: vi.fn(),
    updateAmendmentStatus: vi.fn(),
    listProtocolVersions: vi.fn(),
    listRenewals: vi.fn(),
    createRenewal: vi.fn(),
    updateRenewalStatus: vi.fn(),
  },
}));

const api = vi.mocked(realApi);

const PROTOCOLS: Protocol[] = [
  {
    id: "IACUC-2026-0142",
    title: "Neurobehavioral Effects of Chronic Stress in C57BL/6 Mice",
    pi: "Dr. Elena Marsh",
    pi_proxy: null,
    ptm_member: null,
    protocol_type: null,
    species: "Mouse",
    status: "Approved",
    animals: 240,
    pain_category: "Category D",
    anesthesia_required: 1,
    housing: null,
    disposal: null,
    npg: null,
    research_steps: [],
    purpose_summary: null,
    harm_benefit_analysis: null,
    scientific_summary: null,
    submitted: "2026-06-30",
    expires: "2029-06-30",
  },
];

const PENDING_AMENDMENT: Amendment = {
  id: 1,
  protocol_id: "IACUC-2026-0142",
  reason: "Add a second mouse strain.",
  status: "Pending",
  created_at: "2026-07-01T10:00:00.000Z",
  changes: [],
};

const APPROVED_AMENDMENT: Amendment = {
  ...PENDING_AMENDMENT,
  id: 2,
  reason: "Switch analgesic.",
  status: "Approved",
  created_at: "2026-06-01T10:00:00.000Z",
  changes: [
    { id: 5, amendment_id: 2, section: "drugs", field: "dose", previous_value: "10 mg/kg", new_value: "5 mg/kg", created_at: null },
  ],
};

const VERSIONS: ProtocolVersion[] = [
  { id: 1, protocol_id: "IACUC-2026-0142", version_number: "0001", source: "New Document", approved_date: "2026-06-01", expiration_date: "2029-06-01", version_date: null },
  { id: 2, protocol_id: "IACUC-2026-0142", version_number: "0002", source: "Amendment Document", approved_date: "2026-07-01", expiration_date: "2027-07-01", version_date: null },
];

const RENEWALS: Renewal[] = [
  { id: 1, protocol_id: "IACUC-2026-0142", type: "Continuing Review", status: "Pending", submitted_date: "2026-07-01", decision_date: null, approved_until: null, created_at: null },
  { id: 2, protocol_id: "IACUC-2026-0142", type: "De Novo Review", status: "Approved", submitted_date: "2026-01-01", decision_date: "2026-01-15", approved_until: "2029-01-15", created_at: null },
];

function renderAmendmentsPage() {
  return render(
    <MemoryRouter>
      <AmendmentsPage />
    </MemoryRouter>
  );
}

function mockLoadData(
  amendments: Amendment[] = [PENDING_AMENDMENT, APPROVED_AMENDMENT],
  versions: ProtocolVersion[] = VERSIONS,
  renewals: Renewal[] = RENEWALS,
) {
  api.listProtocols.mockResolvedValue(PROTOCOLS);
  api.listAmendments.mockResolvedValue(amendments);
  api.listProtocolVersions.mockResolvedValue(versions);
  api.listRenewals.mockResolvedValue(renewals);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("AmendmentsPage — rendering", () => {
  test("renders the selected protocol, amendments, versions, and renewals", async () => {
    const user = userEvent.setup();
    mockLoadData();
    renderAmendmentsPage();

    await waitFor(() => expect(screen.getByText("Amendments & annual renewals")).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText("Add a second mouse strain.")).toBeInTheDocument());

    expect(screen.getByText(/Neurobehavioral Effects/)).toBeInTheDocument();
    // Amendment status badges (also rendered on renewals)
    expect(screen.getAllByText("Pending").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Approved").length).toBeGreaterThan(0);
    // Live-diff change record lives inside the expanded approved card
    await user.click(screen.getByText("Switch analgesic."));
    await waitFor(() => expect(screen.getByText("drugs · dose")).toBeInTheDocument());
    expect(screen.getByText("10 mg/kg")).toBeInTheDocument();
    expect(screen.getByText("5 mg/kg")).toBeInTheDocument();
    // Version lineage
    expect(screen.getByText("0002")).toBeInTheDocument();
    expect(screen.getByText("Amendment Document")).toBeInTheDocument();
    // Renewals (the types also appear as select options)
    expect(screen.getAllByText("Continuing Review").length).toBeGreaterThan(0);
    expect(screen.getAllByText("De Novo Review").length).toBeGreaterThan(0);
  });

  test("shows empty states when nothing exists yet", async () => {
    mockLoadData([], [], []);
    renderAmendmentsPage();

    await waitFor(() => expect(screen.getByText(/No amendments for this protocol yet/)).toBeInTheDocument());
    expect(screen.getByText("No version lineage yet.")).toBeInTheDocument();
    expect(screen.getByText(/No renewals for this protocol yet/)).toBeInTheDocument();
  });
});

describe("AmendmentsPage — starting & recording changes", () => {
  test("starting an amendment requires a reason and calls the API", async () => {
    const user = userEvent.setup();
    mockLoadData();
    api.createAmendment.mockResolvedValue(PENDING_AMENDMENT);

    renderAmendmentsPage();
    await waitFor(() => expect(screen.getByText("Add a second mouse strain.")).toBeInTheDocument());

    const reasonInput = screen.getByPlaceholderText(/Reason for change/);
    await user.type(reasonInput, "Add a third strain.");
    api.listAmendments.mockResolvedValue([{ ...PENDING_AMENDMENT, reason: "Add a third strain." }]);
    await user.click(screen.getByRole("button", { name: /Start amendment/ }));

    await waitFor(() => {
      expect(api.createAmendment).toHaveBeenCalledWith("IACUC-2026-0142", { reason: "Add a third strain." });
    });
    await waitFor(() => expect(screen.getByText("Add a third strain.")).toBeInTheDocument());
  });

  test("does not call the API when the reason is blank", async () => {
    const user = userEvent.setup();
    mockLoadData();
    renderAmendmentsPage();
    await waitFor(() => expect(screen.getByText("Add a second mouse strain.")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /Start amendment/ }));
    expect(api.createAmendment).not.toHaveBeenCalled();
  });

  test("shows the 409 error when a second amendment is started while one is in flight", async () => {
    const user = userEvent.setup();
    mockLoadData();
    api.createAmendment.mockRejectedValue(new Error("Only one amendment can be in flight per protocol at a time."));

    renderAmendmentsPage();
    await waitFor(() => expect(screen.getByText("Add a second mouse strain.")).toBeInTheDocument());

    await user.type(screen.getByPlaceholderText(/Reason for change/), "A second change.");
    await user.click(screen.getByRole("button", { name: /Start amendment/ }));

    await waitFor(() => {
      expect(screen.getByText(/Only one amendment can be in flight/)).toBeInTheDocument();
    });
  });

  test("recording a change calls the API and refreshes the change list", async () => {
    const user = userEvent.setup();
    mockLoadData();
    api.addAmendmentChange.mockResolvedValue({} as never);

    renderAmendmentsPage();
    await waitFor(() => expect(screen.getByText("Add a second mouse strain.")).toBeInTheDocument());
    await user.click(screen.getByText("Add a second mouse strain."));

    await user.type(screen.getByPlaceholderText("Section, e.g. animal_use"), "animal_use");
    await user.type(screen.getByPlaceholderText("Field, e.g. species_strain"), "species_strain");
    await user.type(screen.getByPlaceholderText("Previous version"), "C57BL/6");
    await user.type(screen.getByPlaceholderText("Live change (proposed)"), "C57BL/6J");

    api.listAmendments.mockResolvedValue([
      { ...PENDING_AMENDMENT, changes: [
        { id: 9, amendment_id: 1, section: "animal_use", field: "species_strain", previous_value: "C57BL/6", new_value: "C57BL/6J", created_at: null },
      ] },
      APPROVED_AMENDMENT,
    ]);

    await user.click(screen.getByRole("button", { name: /Record change/ }));

    await waitFor(() => {
      expect(api.addAmendmentChange).toHaveBeenCalledWith("IACUC-2026-0142", 1, {
        section: "animal_use",
        field: "species_strain",
        previous_value: "C57BL/6",
        new_value: "C57BL/6J",
      });
    });
    await waitFor(() => expect(screen.getByText("animal_use · species_strain")).toBeInTheDocument());
  });
});

describe("AmendmentsPage — decisions", () => {
  test("approving an amendment sends the expiration date and refreshes", async () => {
    const user = userEvent.setup();
    mockLoadData();
    api.updateAmendmentStatus.mockResolvedValue({ ...PENDING_AMENDMENT, status: "Approved" });

    renderAmendmentsPage();
    await waitFor(() => expect(screen.getByText("Add a second mouse strain.")).toBeInTheDocument());
    await user.click(screen.getByText("Add a second mouse strain."));

    const expiration = screen.getByLabelText("Expiration date for amendment");
    await user.type(expiration, "2027-08-01");
    await user.click(screen.getByRole("button", { name: /Approve amendment/ }));

    await waitFor(() => {
      expect(api.updateAmendmentStatus).toHaveBeenCalledWith("IACUC-2026-0142", 1, "Approved", "2027-08-01");
    });
  });

  test("approving without an expiration sends no expiration date", async () => {
    const user = userEvent.setup();
    mockLoadData();
    api.updateAmendmentStatus.mockResolvedValue({ ...PENDING_AMENDMENT, status: "Approved" });

    renderAmendmentsPage();
    await waitFor(() => expect(screen.getByText("Add a second mouse strain.")).toBeInTheDocument());
    await user.click(screen.getByText("Add a second mouse strain."));

    await user.click(screen.getByRole("button", { name: /Approve amendment/ }));

    await waitFor(() => {
      expect(api.updateAmendmentStatus).toHaveBeenCalledWith("IACUC-2026-0142", 1, "Approved", undefined);
    });
  });

  test("rejecting an amendment calls the API with Rejected", async () => {
    const user = userEvent.setup();
    mockLoadData();
    api.updateAmendmentStatus.mockResolvedValue({ ...PENDING_AMENDMENT, status: "Rejected" });

    renderAmendmentsPage();
    await waitFor(() => expect(screen.getByText("Add a second mouse strain.")).toBeInTheDocument());
    await user.click(screen.getByText("Add a second mouse strain."));

    await user.click(screen.getAllByRole("button", { name: /^Reject$/ })[0]);

    await waitFor(() => {
      expect(api.updateAmendmentStatus).toHaveBeenCalledWith("IACUC-2026-0142", 1, "Rejected", undefined);
    });
  });

  test("shows an error when deciding fails", async () => {
    const user = userEvent.setup();
    mockLoadData();
    api.updateAmendmentStatus.mockRejectedValue(new Error("This amendment has already been decided"));

    renderAmendmentsPage();
    await waitFor(() => expect(screen.getByText("Add a second mouse strain.")).toBeInTheDocument());
    await user.click(screen.getByText("Add a second mouse strain."));

    await user.click(screen.getAllByRole("button", { name: /^Reject$/ })[0]);

    await waitFor(() => {
      expect(screen.getByText("This amendment has already been decided")).toBeInTheDocument();
    });
  });
});

describe("AmendmentsPage — renewals", () => {
  test("starting a renewal calls the API with the selected type", async () => {
    const user = userEvent.setup();
    mockLoadData();
    api.createRenewal.mockResolvedValue({
      id: 3, protocol_id: "IACUC-2026-0142", type: "De Novo Review", status: "Pending",
      submitted_date: "2026-07-05", decision_date: null, approved_until: null, created_at: null,
    });

    renderAmendmentsPage();
    await waitFor(() => expect(screen.getByText("Continuing Review")).toBeInTheDocument());

    await user.selectOptions(screen.getAllByRole("combobox")[1], "De Novo Review");
    api.listRenewals.mockResolvedValue([
      ...RENEWALS,
      { id: 3, protocol_id: "IACUC-2026-0142", type: "De Novo Review", status: "Pending", submitted_date: "2026-07-05", decision_date: null, approved_until: null, created_at: null },
    ]);
    await user.click(screen.getByRole("button", { name: /Start renewal/ }));

    await waitFor(() => {
      expect(api.createRenewal).toHaveBeenCalledWith("IACUC-2026-0142", { type: "De Novo Review" });
    });
  });

  test("approving a renewal sends approved_until and refreshes", async () => {
    const user = userEvent.setup();
    mockLoadData();
    api.updateRenewalStatus.mockResolvedValue({ ...RENEWALS[0], status: "Approved", approved_until: "2027-07-01" });

    renderAmendmentsPage();
    await waitFor(() => expect(screen.getByText("Continuing Review")).toBeInTheDocument());

    const approvedUntil = screen.getByLabelText("Approved until date for renewal");
    await user.type(approvedUntil, "2027-07-01");
    await user.click(screen.getByRole("button", { name: /Approve renewal/ }));

    await waitFor(() => {
      expect(api.updateRenewalStatus).toHaveBeenCalledWith("IACUC-2026-0142", 1, "Approved", "2027-07-01");
    });
  });

  test("rejecting a renewal calls the API without approved_until", async () => {
    const user = userEvent.setup();
    mockLoadData();
    api.updateRenewalStatus.mockResolvedValue({ ...RENEWALS[0], status: "Rejected" });

    renderAmendmentsPage();
    await waitFor(() => expect(screen.getByText("Continuing Review")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /^Reject$/ }));

    await waitFor(() => {
      expect(api.updateRenewalStatus).toHaveBeenCalledWith("IACUC-2026-0142", 1, "Rejected", undefined);
    });
  });

  test("shows the 409 error when starting a renewal while one is in flight", async () => {
    const user = userEvent.setup();
    mockLoadData();
    api.createRenewal.mockRejectedValue(new Error("A renewal is already in flight for this protocol"));

    renderAmendmentsPage();
    await waitFor(() => expect(screen.getByText("Continuing Review")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /Start renewal/ }));

    await waitFor(() => {
      expect(screen.getByText("A renewal is already in flight for this protocol")).toBeInTheDocument();
    });
  });
});
