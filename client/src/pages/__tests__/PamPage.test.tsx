import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import PamPage from "../PamPage";
import { api as realApi } from "../../api";
import type { Incident, PamAudit, Personnel } from "../../types";

vi.mock("../../api", () => ({
  api: {
    listIncidents: vi.fn(),
    createIncident: vi.fn(),
    updateIncident: vi.fn(),
    listPersonnel: vi.fn(),
    listPamAuditsForAll: vi.fn(),
    createPamAudit: vi.fn(),
  },
}));

const api = vi.mocked(realApi);

const PERSONNEL: Personnel[] = [
  { id: 1, name: "Dr. Elena Marsh", email: null, role_id: 1, role_name: "Principal Investigator", is_committee: 0 },
  { id: 2, name: "Dr. Hana Sato", email: null, role_id: 2, role_name: "Attending Veterinarian", is_committee: 1 },
];

const INCIDENTS: Incident[] = [
  {
    id: 1,
    protocol_id: "IACUC-2026-0142",
    type: "Adverse Event",
    description: "Animal found unresponsive during routine observation.",
    severity: "Major",
    status: "Open",
    corrective_action: null,
    closed_at: null,
    reported_by: 1,
    reported_by_name: "Dr. Elena Marsh",
    assigned_to: null,
    assigned_to_name: null,
    created_at: "2026-07-10T09:00:00.000Z",
  },
  {
    id: 2,
    protocol_id: null,
    type: "Noncompliance",
    description: "Signage missing in procedure room.",
    severity: "Minor",
    status: "Closed",
    corrective_action: "Posted updated signage.",
    closed_at: "2026-06-20T00:00:00.000Z",
    reported_by: null,
    reported_by_name: null,
    assigned_to: 2,
    assigned_to_name: "Dr. Hana Sato",
    created_at: "2026-06-10T09:00:00.000Z",
  },
];

const AUDITS: PamAudit[] = [
  {
    id: 1,
    protocol_id: "IACUC-2026-0142",
    audit_date: "2026-07-15",
    auditor_id: 2,
    auditor_name: "Dr. Hana Sato",
    site_visits: "Central vivarium, surgical suite",
    findings: "None",
    report: "All in order.",
    created_at: null,
  },
];

function renderPage() {
  return render(
    <MemoryRouter>
      <PamPage />
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  api.listIncidents.mockResolvedValue(INCIDENTS);
  api.listPersonnel.mockResolvedValue(PERSONNEL);
  api.listPamAuditsForAll.mockResolvedValue(AUDITS);
});

describe("PamPage — rendering", () => {
  test("renders incidents with type, severity, status, and reporter", async () => {
    renderPage();

    await waitFor(() => expect(screen.getByText("Animal found unresponsive during routine observation.")).toBeInTheDocument());
    // "Adverse Event"/"Major" also appear as form options
    expect(screen.getAllByText("Adverse Event").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Major").length).toBeGreaterThan(0);
    expect(screen.getByText("Open")).toBeInTheDocument();
    expect(screen.getByText(/Reported 2026-07-10 by Dr. Elena Marsh/)).toBeInTheDocument();
    // The protocol link also appears on the seeded PAM audit
    expect(screen.getAllByText("IACUC-2026-0142").length).toBeGreaterThan(0);
  });

  test("renders closed incidents with their CAPA and assigned-to", async () => {
    renderPage();

    await waitFor(() => expect(screen.getByText("Animal found unresponsive during routine observation.")).toBeInTheDocument());
    expect(screen.getByText(/Posted updated signage/)).toBeInTheDocument();
    expect(screen.getByText(/closed 2026-06-20/)).toBeInTheDocument();
    expect(screen.getByText(/assigned to Dr. Hana Sato/)).toBeInTheDocument();
  });

  test("loads PAM site-visit audits on mount", async () => {
    renderPage();

    await waitFor(() => expect(screen.getByText("Visited: Central vivarium, surgical suite")).toBeInTheDocument());
    expect(screen.getByText("All in order.")).toBeInTheDocument();
    expect(screen.getByText("2026-07-15")).toBeInTheDocument();
    expect(screen.getByText(/· Dr. Hana Sato/)).toBeInTheDocument();
    expect(api.listPamAuditsForAll).toHaveBeenCalled();
  });

  test("shows empty states when there is no data", async () => {
    api.listIncidents.mockResolvedValue([]);
    api.listPamAuditsForAll.mockResolvedValue([]);
    renderPage();

    await waitFor(() => expect(screen.getByText("No incidents yet.")).toBeInTheDocument());
    expect(screen.getByText("No audits logged yet.")).toBeInTheDocument();
  });
});

describe("PamPage — reporting incidents", () => {
  test("reporting an incident calls the API and refreshes", async () => {
    const user = userEvent.setup();
    api.createIncident.mockResolvedValue(INCIDENTS[0]);

    renderPage();
    await waitFor(() => expect(screen.getByText("Animal found unresponsive during routine observation.")).toBeInTheDocument());

    await user.type(screen.getByPlaceholderText(/Protocol id \(optional\)/), "IACUC-2026-0142");
    await user.selectOptions(screen.getAllByRole("combobox")[0], "Adverse Event");
    await user.selectOptions(screen.getAllByRole("combobox")[1], "Major");
    await user.selectOptions(screen.getAllByRole("combobox")[2], "1");
    await user.type(screen.getByPlaceholderText(/Describe the adverse event/), "Animal found unresponsive during routine observation.");

    await user.click(screen.getByRole("button", { name: /Report incident/ }));

    await waitFor(() => {
      expect(api.createIncident).toHaveBeenCalledWith({
        protocol_id: "IACUC-2026-0142",
        type: "Adverse Event",
        severity: "Major",
        description: "Animal found unresponsive during routine observation.",
        reported_by: 1,
      });
    });
  });

  test("does not report an incident with a blank description", async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(screen.getByText("Animal found unresponsive during routine observation.")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /Report incident/ }));
    expect(api.createIncident).not.toHaveBeenCalled();
  });

  test("shows an error when reporting fails", async () => {
    const user = userEvent.setup();
    api.createIncident.mockRejectedValue(new Error("Unknown protocol_id"));

    renderPage();
    await waitFor(() => expect(screen.getByText("Animal found unresponsive during routine observation.")).toBeInTheDocument());

    await user.type(screen.getByPlaceholderText(/Protocol id \(optional\)/), "NOPE-0000");
    await user.type(screen.getByPlaceholderText(/Describe the adverse event/), "Something went wrong.");
    await user.click(screen.getByRole("button", { name: /Report incident/ }));

    await waitFor(() => expect(screen.getByText("Unknown protocol_id")).toBeInTheDocument());
  });
});

describe("PamPage — incident lifecycle (CAPA → close)", () => {
  test("logging a CAPA on an open incident calls the API and refreshes", async () => {
    const user = userEvent.setup();
    api.updateIncident.mockResolvedValue({ ...INCIDENTS[0], corrective_action: "Increased daily checks.", status: "CAPA" });

    renderPage();
    await waitFor(() => expect(screen.getByText("Animal found unresponsive during routine observation.")).toBeInTheDocument());

    const capaInput = screen.getByTestId("incident-capa-1");
    await user.type(capaInput, "Increased daily checks.");
    await user.click(screen.getByRole("button", { name: /Log CAPA/ }));

    await waitFor(() => {
      expect(api.updateIncident).toHaveBeenCalledWith(1, { corrective_action: "Increased daily checks." });
    });
  });

  test("closing a CAPA incident sends the corrective action with status Closed", async () => {
    const user = userEvent.setup();
    const inCapa = { ...INCIDENTS[0], corrective_action: "Increased daily checks.", status: "CAPA" as const };
    api.listIncidents.mockResolvedValue([inCapa]);
    api.updateIncident.mockResolvedValue({ ...inCapa, status: "Closed" });

    renderPage();
    await waitFor(() => expect(screen.getByText("Animal found unresponsive during routine observation.")).toBeInTheDocument());

    // The CAPA textarea is pre-filled from the incident's corrective_action
    await user.click(screen.getByRole("button", { name: /Close incident/ }));

    await waitFor(() => {
      expect(api.updateIncident).toHaveBeenCalledWith(1, { corrective_action: "Increased daily checks.", status: "Closed" });
    });
  });

  test("shows an error when closing without a CAPA", async () => {
    const user = userEvent.setup();
    const inCapa = { ...INCIDENTS[0], corrective_action: "Increased daily checks.", status: "CAPA" as const };
    api.listIncidents.mockResolvedValue([inCapa]);
    api.updateIncident.mockRejectedValue(new Error("A corrective action (CAPA) must be recorded before the incident can move to CAPA or Closed."));

    renderPage();
    await waitFor(() => expect(screen.getByText("Animal found unresponsive during routine observation.")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /Close incident/ }));

    await waitFor(() => {
      expect(screen.getByText(/must be recorded before the incident/)).toBeInTheDocument();
    });
  });
});

describe("PamPage — logging site-visit audits", () => {
  test("logging an audit calls the API and refreshes the audit list", async () => {
    const user = userEvent.setup();
    api.createPamAudit.mockResolvedValue(AUDITS[0]);

    renderPage();
    await waitFor(() => expect(screen.getByText("All in order.")).toBeInTheDocument());

    await user.type(screen.getByPlaceholderText(/Protocol id, e.g/), "IACUC-2026-0142");
    await user.type(document.querySelector('input[type="date"]') as HTMLElement, "2026-07-15");
    await user.type(screen.getByPlaceholderText(/Site visits/), "Central vivarium, surgical suite");
    await user.type(screen.getByPlaceholderText(/Findings/), "None");
    await user.type(screen.getByPlaceholderText(/Audit report/), "All in order.");
    await user.click(screen.getByRole("button", { name: /Log site-visit audit/ }));

    await waitFor(() => {
      expect(api.createPamAudit).toHaveBeenCalledWith("IACUC-2026-0142", {
        audit_date: "2026-07-15",
        auditor_id: null,
        site_visits: "Central vivarium, surgical suite",
        findings: "None",
        report: "All in order.",
      });
    });
  });

  test("does not log an audit without a protocol id", async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(screen.getByText("All in order.")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /Log site-visit audit/ }));
    expect(api.createPamAudit).not.toHaveBeenCalled();
  });

  test("shows an error when logging an audit fails", async () => {
    const user = userEvent.setup();
    api.createPamAudit.mockRejectedValue(new Error("Unknown protocol"));

    renderPage();
    await waitFor(() => expect(screen.getByText("All in order.")).toBeInTheDocument());

    await user.type(screen.getByPlaceholderText(/Protocol id, e.g/), "NOPE");
    await user.type(document.querySelector('input[type="date"]') as HTMLElement, "2026-07-15");
    await user.click(screen.getByRole("button", { name: /Log site-visit audit/ }));

    await waitFor(() => expect(screen.getByText("Unknown protocol")).toBeInTheDocument());
  });
});
