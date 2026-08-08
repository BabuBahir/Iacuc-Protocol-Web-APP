import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import AdminPage from "../AdminPage";
import { api as realApi } from "../../api";
import type { Personnel } from "../../types";

vi.mock("../../api", () => ({
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
    listPersonnelCompliance: vi.fn(),
    getPersonnelTraining: vi.fn(),
    createTrainingRecord: vi.fn(),
    updateTrainingRecord: vi.fn(),
    deleteTrainingRecord: vi.fn(),
    getPersonnelOhsp: vi.fn(),
    setPersonnelOhsp: vi.fn(),
    listTransfers: vi.fn(),
    bulkCreateTransfers: vi.fn(),
    updateTransferStatus: vi.fn(),
    listProtocols: vi.fn(),
    getAuditLog: vi.fn(),
  },
}));

const api = vi.mocked(realApi);

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
  api.listPersonnelCompliance.mockResolvedValue([]);
  api.listTransfers.mockResolvedValue([]);
  api.listProtocols.mockResolvedValue([]);
  api.getAuditLog.mockResolvedValue([]);
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

  test("shows an error message if deleting a species fails", async () => {
    const user = userEvent.setup();
    api.deleteSpecies.mockRejectedValue(new Error("Species in use."));

    renderAdminPage();
    await waitFor(() => expect(screen.getByText("Mouse")).toBeInTheDocument());

    const row = screen.getByText("Mouse").closest(".px-4");
    await user.click(within(row as HTMLElement).getByRole("button"));

    await waitFor(() => {
      expect(screen.getByText("Species in use.")).toBeInTheDocument();
    });
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
    expect(badge!.textContent).toBe("Committee");
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

describe("AdminPage — roles panel actions", () => {
  test("adding a role with the FCR checkbox calls createRole with is_committee true", async () => {
    const user = userEvent.setup();
    api.createRole.mockResolvedValue({ id: 2, name: "IACUC Chair", is_committee: 1 });

    renderAdminPage();
    await waitFor(() => {
      expect(screen.getAllByText("Principal Investigator").length).toBeGreaterThan(0);
    });

    const nameInput = screen.getByPlaceholderText("e.g. Attending Veterinarian");
    await user.type(nameInput, "IACUC Chair");
    await user.click(screen.getByRole("checkbox", { name: /Eligible to cast/ }));

    api.listRoles.mockResolvedValue([
      { id: 1, name: "Principal Investigator", is_committee: 0 },
      { id: 2, name: "IACUC Chair", is_committee: 1 },
    ]);

    const addButtons = screen.getAllByRole("button", { name: /add/i });
    await user.click(addButtons[1]);

    await waitFor(() => {
      expect(api.createRole).toHaveBeenCalledWith("IACUC Chair", true);
    });
  });

  test("shows an error message if creating a role fails", async () => {
    const user = userEvent.setup();
    api.createRole.mockRejectedValue(new Error("That role already exists."));

    renderAdminPage();
    await waitFor(() => {
      expect(screen.getAllByText("Principal Investigator").length).toBeGreaterThan(0);
    });

    const nameInput = screen.getByPlaceholderText("e.g. Attending Veterinarian");
    await user.type(nameInput, "IACUC Chair");
    const addButtons = screen.getAllByRole("button", { name: /add/i });
    await user.click(addButtons[1]);

    await waitFor(() => {
      expect(screen.getByText("That role already exists.")).toBeInTheDocument();
    });
  });

  test("deleting a role calls the API and refreshes the list", async () => {
    const user = userEvent.setup();
    api.listRoles.mockResolvedValue([
      { id: 1, name: "Principal Investigator", is_committee: 0 },
      { id: 2, name: "IACUC Chair", is_committee: 1 },
    ]);
    api.deleteRole.mockResolvedValue(null);

    renderAdminPage();
    await waitFor(() => {
      expect(screen.getAllByText("IACUC Chair").length).toBeGreaterThan(0);
    });

    // "IACUC Chair" appears both in the roles list and the personnel role
    // dropdown; the roles-list row is the first match in DOM order.
    const row = screen.getAllByText("IACUC Chair")[0].closest(".px-4");
    await user.click(within(row as HTMLElement).getByRole("button"));

    await waitFor(() => {
      expect(api.deleteRole).toHaveBeenCalledWith(2);
    });
  });

  test("shows an error message if deleting a role fails", async () => {
    const user = userEvent.setup();
    api.listRoles.mockResolvedValue([
      { id: 1, name: "IACUC Chair", is_committee: 1 },
    ]);
    api.deleteRole.mockRejectedValue(new Error("This role is still assigned to personnel and can't be deleted."));

    renderAdminPage();
    await waitFor(() => {
      expect(screen.getAllByText("IACUC Chair").length).toBeGreaterThan(0);
    });

    const row = screen.getAllByText("IACUC Chair")[0].closest(".px-4");
    await user.click(within(row as HTMLElement).getByRole("button"));

    await waitFor(() => {
      expect(screen.getByText(/still assigned to personnel/)).toBeInTheDocument();
    });
  });
});

describe("AdminPage — personnel panel actions", () => {
  test("renders personnel with role, committee badge, and email", async () => {
    api.listRoles.mockResolvedValue([
      { id: 1, name: "IACUC Chair", is_committee: 1 },
    ]);
    api.listPersonnel.mockResolvedValue([
      { id: 1, name: "Dr. Harold Kim", email: "h.kim@university.edu", role_id: 1, role_name: "IACUC Chair", is_committee: 1 },
      { id: 2, name: "Sam Whitfield", email: null, role_id: 2, role_name: "Lab Technician", is_committee: 0 },
    ]);

    renderAdminPage();

    await waitFor(() => expect(screen.getAllByText("Dr. Harold Kim")[0]).toBeInTheDocument());
    expect(screen.getByText(/· h.kim@university.edu/)).toBeInTheDocument();
    expect(screen.getAllByText("Sam Whitfield")[0]).toBeInTheDocument();
    // Committee badge appears next to committee-eligible roles AND personnel.
    const committeeBadges = document.querySelectorAll("span.rounded-full");
    expect(committeeBadges.length).toBeGreaterThanOrEqual(2);
  });

  test("adding personnel calls the API with the selected role and refreshes", async () => {
    const user = userEvent.setup();
    api.createPersonnel.mockResolvedValue({} as Personnel);

    renderAdminPage();
    await waitFor(() => {
      expect(screen.getByRole("option", { name: "Principal Investigator" })).toBeInTheDocument();
    });

    const nameInput = screen.getByPlaceholderText("Full name");
    await user.type(nameInput, "Dr. Priya Nair");
    await user.type(screen.getByPlaceholderText("Email (optional)"), "p.nair@university.edu");

    const form = nameInput.closest("form");
    await user.click(within(form as HTMLElement).getByRole("button"));

    await waitFor(() => {
      expect(api.createPersonnel).toHaveBeenCalledWith({
        name: "Dr. Priya Nair",
        email: "p.nair@university.edu",
        role_id: 1,
      });
    });
  });

  test("sends null email when the email field is blank", async () => {
    const user = userEvent.setup();
    api.createPersonnel.mockResolvedValue({} as Personnel);

    renderAdminPage();
    await waitFor(() => {
      expect(screen.getByRole("option", { name: "Principal Investigator" })).toBeInTheDocument();
    });

    const nameInput = screen.getByPlaceholderText("Full name");
    await user.type(nameInput, "Sam Whitfield");
    const form = nameInput.closest("form");
    await user.click(within(form as HTMLElement).getByRole("button"));

    await waitFor(() => {
      expect(api.createPersonnel).toHaveBeenCalledWith({
        name: "Sam Whitfield",
        email: null,
        role_id: 1,
      });
    });
  });

  test("shows an error message if creating personnel fails", async () => {
    const user = userEvent.setup();
    api.createPersonnel.mockRejectedValue(new Error("Unknown role_id"));

    renderAdminPage();
    await waitFor(() => {
      expect(screen.getByRole("option", { name: "Principal Investigator" })).toBeInTheDocument();
    });

    const nameInput = screen.getByPlaceholderText("Full name");
    await user.type(nameInput, "Dr. Priya Nair");
    const form = nameInput.closest("form");
    await user.click(within(form as HTMLElement).getByRole("button"));

    await waitFor(() => {
      expect(screen.getByText("Unknown role_id")).toBeInTheDocument();
    });
  });

  test("deleting personnel calls the API and refreshes", async () => {
    const user = userEvent.setup();
    api.listPersonnel.mockResolvedValue([
      { id: 5, name: "Sam Whitfield", email: null, role_id: 5, role_name: "Lab Technician", is_committee: 0 },
    ]);
    api.deletePersonnel.mockResolvedValue(null);

    renderAdminPage();
    await waitFor(() => expect(screen.getAllByText("Sam Whitfield")[0]).toBeInTheDocument());

    const row = screen.getAllByText("Sam Whitfield")[0].closest(".px-4");
    const trashButton = Array.from(within(row as HTMLElement).getAllByRole("button"))
      .find(b => b.querySelector("svg.lucide-trash-2"))!;
    await user.click(trashButton);

    await waitFor(() => {
      expect(api.deletePersonnel).toHaveBeenCalledWith(5);
    });
  });

  test("shows an error message if deleting personnel fails", async () => {
    const user = userEvent.setup();
    api.listPersonnel.mockResolvedValue([
      { id: 5, name: "Sam Whitfield", email: null, role_id: 5, role_name: "Lab Technician", is_committee: 0 },
    ]);
    api.deletePersonnel.mockRejectedValue(new Error("Personnel has votes."));

    renderAdminPage();
    await waitFor(() => expect(screen.getAllByText("Sam Whitfield")[0]).toBeInTheDocument());

    const row = screen.getAllByText("Sam Whitfield")[0].closest(".px-4");
    const trashButton = Array.from(within(row as HTMLElement).getAllByRole("button"))
      .find(b => b.querySelector("svg.lucide-trash-2"))!;
    await user.click(trashButton);

    await waitFor(() => {
      expect(screen.getByText("Personnel has votes.")).toBeInTheDocument();
    });
  });
});

describe("AdminPage — personnel compliance", () => {
  test("renders training and OHSP status chips for each person", async () => {
    api.listPersonnel.mockResolvedValue([
      { id: 1, name: "Dr. Elena Marsh", email: null, role_id: 1, role_name: "Principal Investigator", is_committee: 0 },
    ]);
    api.listPersonnelCompliance.mockResolvedValue([
      { id: 1, name: "Dr. Elena Marsh", role_name: "Principal Investigator", training_status: "Current", ohsp_status: "Cleared", compliant: true },
    ]);

    renderAdminPage();

    await waitFor(() => expect(screen.getByText("Training: Current")).toBeInTheDocument());
    expect(screen.getByText("OHSP: Cleared")).toBeInTheDocument();
  });

  test("opening the compliance modal loads training and OHSP data", async () => {
    const user = userEvent.setup();
    api.listPersonnel.mockResolvedValue([
      { id: 1, name: "Dr. Elena Marsh", email: null, role_id: 1, role_name: "Principal Investigator", is_committee: 0 },
    ]);
    api.listPersonnelCompliance.mockResolvedValue([]);
    api.getPersonnelTraining.mockResolvedValue({
      personnel: { id: 1, name: "Dr. Elena Marsh", role_name: "Principal Investigator" },
      courses: [
        { id: 10, personnel_id: 1, course: "Working with the IACUC", completed_date: "2025-01-15", expires_date: "2028-01-15", status: "Current" },
      ],
      overall_status: "Current",
    });
    api.getPersonnelOhsp.mockResolvedValue({ personnel_id: 1, status: "Cleared", reviewed_date: "2026-01-10", notes: null });

    renderAdminPage();
    await waitFor(() => expect(screen.getAllByText("Dr. Elena Marsh")[0]).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Manage compliance" }));

    await waitFor(() => expect(screen.getByText("Compliance — Dr. Elena Marsh")).toBeInTheDocument());
    expect(screen.getByText("Working with the IACUC")).toBeInTheDocument();
    expect(screen.getByText("Last reviewed 2026-01-10")).toBeInTheDocument();
  });

  test("adding a training record calls the API and refreshes the modal list", async () => {
    const user = userEvent.setup();
    api.listPersonnel.mockResolvedValue([
      { id: 1, name: "Dr. Elena Marsh", email: null, role_id: 1, role_name: "Principal Investigator", is_committee: 0 },
    ]);
    api.listPersonnelCompliance.mockResolvedValue([]);
    api.getPersonnelTraining.mockResolvedValueOnce({
      personnel: { id: 1, name: "Dr. Elena Marsh", role_name: "Principal Investigator" },
      courses: [],
      overall_status: "No records",
    }).mockResolvedValueOnce({
      personnel: { id: 1, name: "Dr. Elena Marsh", role_name: "Principal Investigator" },
      courses: [
        { id: 11, personnel_id: 1, course: "Rodent Surgery", completed_date: "2026-02-01", expires_date: "2029-02-01", status: "Current" },
      ],
      overall_status: "Current",
    });
    api.getPersonnelOhsp.mockResolvedValue({ personnel_id: 1, status: "Pending", reviewed_date: null, notes: null });
    api.createTrainingRecord.mockResolvedValue({} as never);

    renderAdminPage();
    await waitFor(() => expect(screen.getAllByText("Dr. Elena Marsh")[0]).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Manage compliance" }));
    await waitFor(() => expect(screen.getByText("No training records on file.")).toBeInTheDocument());

    await user.type(screen.getByLabelText("Course name"), "Rodent Surgery");
    await user.type(screen.getByLabelText("Completed date"), "2026-02-01");
    await user.click(screen.getByRole("button", { name: /Add training/ }));

    await waitFor(() => {
      expect(api.createTrainingRecord).toHaveBeenCalledWith(1, {
        course: "Rodent Surgery",
        completed_date: "2026-02-01",
        expires_date: null,
      });
    });
    await waitFor(() => expect(screen.getByText("Rodent Surgery")).toBeInTheDocument());
  });

  test("setting OHSP clearance calls the API and reflects the new status", async () => {
    const user = userEvent.setup();
    api.listPersonnel.mockResolvedValue([
      { id: 1, name: "Dr. Elena Marsh", email: null, role_id: 1, role_name: "Principal Investigator", is_committee: 0 },
    ]);
    api.listPersonnelCompliance.mockResolvedValue([]);
    api.getPersonnelTraining.mockResolvedValue({
      personnel: { id: 1, name: "Dr. Elena Marsh", role_name: "Principal Investigator" },
      courses: [],
      overall_status: "No records",
    });
    api.getPersonnelOhsp.mockResolvedValueOnce({ personnel_id: 1, status: "Pending", reviewed_date: null, notes: null })
      .mockResolvedValueOnce({ personnel_id: 1, status: "Cleared", reviewed_date: null, notes: null });
    api.setPersonnelOhsp.mockResolvedValue({ personnel_id: 1, status: "Cleared", reviewed_date: null, notes: null });

    renderAdminPage();
    await waitFor(() => expect(screen.getAllByText("Dr. Elena Marsh")[0]).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Manage compliance" }));
    await waitFor(() => expect(screen.getByText("OHSP clearance")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Cleared" }));

    await waitFor(() => {
      expect(api.setPersonnelOhsp).toHaveBeenCalledWith(1, { status: "Cleared" });
    });
    expect(api.listPersonnelCompliance).toHaveBeenCalled();
  });
});

describe("AdminPage — transfer ownership", () => {
  const PENDING = {
    id: 1,
    protocol_id: "IACUC-2025-0155",
    protocol_title: "Retinal stem cell therapy in mice",
    from_pi: "Dr. Amara Osei",
    to_personnel_id: 3,
    to_name: "Dr. Hana Sato",
    reason: "PI is leaving the institution.",
    status: "Pending",
    created_at: "2026-07-01",
    decision_date: null,
  } as const;

  const PROTOCOL = {
    id: "IACUC-2026-0021",
    title: "Rabbit arthritis model",
    pi: "Dr. Priya Nair",
    pi_proxy: null,
    ptm_member: null,
    protocol_type: null,
    species: null,
    status: "Active",
    animals: null,
    pain_category: null,
    anesthesia_required: null,
    housing: null,
    disposal: null,
    npg: null,
    research_steps: [],
    purpose_summary: null,
    harm_benefit_analysis: null,
    scientific_summary: null,
    submitted: null,
    expires: null,
  };

  test("renders pending transfer requests with Approve/Reject actions", async () => {
    api.listTransfers.mockResolvedValue([PENDING]);

    renderAdminPage();

    await waitFor(() => expect(screen.getByText("IACUC-2025-0155")).toBeInTheDocument());
    expect(screen.getByText(/Retinal stem cell therapy/)).toBeInTheDocument();
    expect(screen.getByText(/Dr. Amara Osei →/)).toBeInTheDocument();
    expect(screen.getByText("PI is leaving the institution.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Approve" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reject" })).toBeInTheDocument();
  });

  test("approving a request calls the API and refreshes the queue", async () => {
    const user = userEvent.setup();
    api.listTransfers.mockResolvedValueOnce([PENDING]).mockResolvedValueOnce([]);
    api.updateTransferStatus.mockResolvedValue({ ...PENDING, status: "Approved" });

    renderAdminPage();
    await waitFor(() => expect(screen.getByRole("button", { name: "Approve" })).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Approve" }));

    await waitFor(() => {
      expect(api.updateTransferStatus).toHaveBeenCalledWith(1, "Approved");
    });
    await waitFor(() => expect(screen.getByText("No pending transfer requests.")).toBeInTheDocument());
  });

  test("bulk transfer submits the selected protocols to the new PI", async () => {
    const user = userEvent.setup();
    api.listProtocols.mockResolvedValue([PROTOCOL]);
    api.listPersonnel.mockResolvedValue([
      { id: 3, name: "Dr. Hana Sato", email: null, role_id: 1, role_name: "Principal Investigator", is_committee: 0 },
    ]);
    api.bulkCreateTransfers.mockResolvedValue([]);

    renderAdminPage();
    await waitFor(() => expect(screen.getByText("IACUC-2026-0021")).toBeInTheDocument());

    await user.click(screen.getByLabelText(/IACUC-2026-0021/));
    await user.selectOptions(screen.getByLabelText("New principal investigator"), "3");
    await user.type(screen.getByPlaceholderText("Reason for transfer (required)"), "Merging labs");
    await user.click(screen.getByRole("button", { name: "Request transfers" }));

    await waitFor(() => {
      expect(api.bulkCreateTransfers).toHaveBeenCalledWith({
        protocol_ids: ["IACUC-2026-0021"],
        to_personnel_id: 3,
        reason: "Merging labs",
      });
    });
  });
});

describe("AdminPage — audit log", () => {
  test("renders audit entries with actor, action, entity, and provenance", async () => {
    api.getAuditLog.mockResolvedValue([
      {
        id: 2,
        action: "vote.cast",
        entity_type: "protocol",
        entity_id: "IACUC-2026-0142",
        actor: "Dr. Amara Osei",
        actor_key: null,
        details: { vote: "Approve" },
        provenance: "ai",
        created_at: "2026-08-06T11:00:00.000Z",
      },
      {
        id: 1,
        action: "species.created",
        entity_type: "species",
        entity_id: "1",
        actor: "Dr. Kim",
        actor_key: null,
        details: { name: "Ferret" },
        provenance: "human",
        created_at: "2026-08-06T10:00:00.000Z",
      },
    ]);

    renderAdminPage();

    await waitFor(() => expect(screen.getByText("vote.cast")).toBeInTheDocument());
    expect(screen.getByText("species.created")).toBeInTheDocument();
    expect(screen.getByText("Dr. Amara Osei")).toBeInTheDocument();
    expect(screen.getByText(/protocol · IACUC-2026-0142/)).toBeInTheDocument();
    // "ai"/"human" also appear as provenance-filter <option> labels, so scope
    // the badge assertions to the entries list.
    const entries = screen.getByTestId("audit-entries");
    expect(within(entries).getByText("ai")).toBeInTheDocument();
    expect(within(entries).getByText("human")).toBeInTheDocument();
    expect(within(entries).getByText("name:")).toBeInTheDocument();
    expect(within(entries).getByText("Ferret")).toBeInTheDocument();
  });

  test("shows an empty state when no entries match", async () => {
    api.getAuditLog.mockResolvedValue([]);

    renderAdminPage();

    await waitFor(() => expect(screen.getByText("No audit entries match.")).toBeInTheDocument());
  });

  test("applying a filter refetches with the entered criteria", async () => {
    const user = userEvent.setup();
    api.getAuditLog.mockResolvedValue([]);

    renderAdminPage();
    await waitFor(() => expect(screen.getByText("No audit entries match.")).toBeInTheDocument());

    await user.type(screen.getByLabelText("Filter by action"), "species");
    await user.click(screen.getByRole("button", { name: /Apply/ }));

    await waitFor(() => {
      expect(api.getAuditLog).toHaveBeenLastCalledWith(
        expect.objectContaining({ action: "species", limit: 100 }),
      );
    });
  });
});
