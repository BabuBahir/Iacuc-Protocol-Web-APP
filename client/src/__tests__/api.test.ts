import { describe, test, expect, vi, beforeEach } from "vitest";
import { api } from "../api";
import { setActingAs } from "../identity";

function mockFetchOnce(status: number, body: unknown, { json = true }: { json?: boolean } = {}) {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => (json ? body : undefined),
  });
}

describe("api.ts request wrapper", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  test("omits X-Actor header when no identity is set (anonymous stays anonymous)", async () => {
    mockFetchOnce(200, [{ id: "A" }]);
    await api.listProtocols();

    const [, options] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(options.headers).not.toHaveProperty("X-Actor");
  });

  test("attaches X-Actor header once an identity is set", async () => {
    setActingAs({ personnelId: 7, name: "Dr. Committee", roleName: "Committee Member" });
    mockFetchOnce(200, [{ id: "A" }]);
    await api.listProtocols();

    const [, options] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(options.headers["X-Actor"]).toBe("Dr. Committee");
  });

  test("X-Actor header updates on the next request after switching identity", async () => {
    setActingAs({ personnelId: 7, name: "Dr. First", roleName: "PI" });
    mockFetchOnce(200, []);
    await api.listProtocols();
    let [, options] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(options.headers["X-Actor"]).toBe("Dr. First");

    setActingAs({ personnelId: 8, name: "Dr. Second", roleName: "Committee Member" });
    mockFetchOnce(200, []); // mockFetchOnce reassigns fetch to a fresh mock each call
    await api.listProtocols();
    [, options] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(options.headers["X-Actor"]).toBe("Dr. Second");
  });

  test("clearing identity (going anonymous again) removes X-Actor from subsequent requests", async () => {
    setActingAs({ personnelId: 7, name: "Dr. Temp", roleName: "PI" });
    setActingAs(null);
    mockFetchOnce(200, []);
    await api.listProtocols();

    const [, options] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(options.headers).not.toHaveProperty("X-Actor");
  });

  test("Content-Type header is preserved alongside X-Actor, not replaced by it", async () => {
    setActingAs({ personnelId: 7, name: "Dr. Both", roleName: "PI" });
    mockFetchOnce(200, []);
    await api.listProtocols();

    const [, options] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(options.headers["Content-Type"]).toBe("application/json");
    expect(options.headers["X-Actor"]).toBe("Dr. Both");
  });
});

describe("api.ts request wrapper — original behavior", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  test("GET requests hit the correct path with JSON content-type header", async () => {
    mockFetchOnce(200, [{ id: "A" }]);
    await api.listProtocols();

    expect(fetch).toHaveBeenCalledWith(
      "/api/protocols",
      expect.objectContaining({ headers: { "Content-Type": "application/json" } })
    );
  });

  test("search query is URL-encoded and appended as ?q=", async () => {
    mockFetchOnce(200, []);
    await api.listProtocols("mouse study");

    expect(fetch).toHaveBeenCalledWith(
      "/api/protocols?q=mouse%20study",
      expect.anything()
    );
  });

  test("empty search query omits the ?q= param entirely", async () => {
    mockFetchOnce(200, []);
    await api.listProtocols("");

    expect(fetch).toHaveBeenCalledWith("/api/protocols", expect.anything());
  });

  test("POST requests send method and JSON-stringified body", async () => {
    mockFetchOnce(201, { id: "NEW-1" });
    await api.createSpecies("Ferret");

    expect(fetch).toHaveBeenCalledWith(
      "/api/admin/species",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ name: "Ferret" }),
      })
    );
  });

  test("a non-ok response throws using the server's error message", async () => {
    mockFetchOnce(409, { error: "That species already exists." });

    await expect(api.createSpecies("Mouse")).rejects.toThrow(
      "That species already exists."
    );
  });

  test("a non-ok response with no parseable JSON body falls back to a generic error", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => {
        throw new Error("not json");
      },
    });

    await expect(api.deleteSpecies(1)).rejects.toThrow("Request failed: 500");
  });

  test("a 204 No Content response resolves to null instead of trying to parse a body", async () => {
    mockFetchOnce(204, undefined, { json: false });
    const result = await api.deleteSpecies(1);
    expect(result).toBeNull();
  });

  test("castVote posts to the correct nested committee endpoint", async () => {
    mockFetchOnce(201, { totalVotes: 1 });
    await api.castVote("IACUC-2026-0001", { personnel_id: 5, vote: "Approve", comment: null });

    expect(fetch).toHaveBeenCalledWith(
      "/api/committee/protocols/IACUC-2026-0001/votes",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ personnel_id: 5, vote: "Approve", comment: null }),
      })
    );
  });

  test("review workflow endpoints hit the correct committee paths", async () => {
    mockFetchOnce(200, { protocol: { id: "P-1" }, assignments: [], comments: [] });
    await api.getReviews("P-1");
    expect(fetch).toHaveBeenCalledWith("/api/committee/protocols/P-1/reviews", expect.anything());

    mockFetchOnce(201, { protocol: { id: "P-1" }, totalVotes: 1 });
    await api.postReview("P-1", { personnel_id: 5, vote: "Approve", comment: "ok" });
    expect(fetch).toHaveBeenCalledWith(
      "/api/committee/protocols/P-1/reviews",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ personnel_id: 5, vote: "Approve", comment: "ok" }),
      })
    );

    mockFetchOnce(201, { id: 7, section: "procedures", comment: "Add details" });
    await api.postComment("P-1", { personnel_id: 5, section: "procedures", comment: "Add details" });
    expect(fetch).toHaveBeenCalledWith(
      "/api/committee/protocols/P-1/comments",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ personnel_id: 5, section: "procedures", comment: "Add details" }),
      })
    );

    mockFetchOnce(200, { personnel_id: 5, role: "Primary Reviewer" });
    await api.assignReviewer("P-1", { personnel_id: 5, role: "Primary Reviewer" });
    expect(fetch).toHaveBeenCalledWith(
      "/api/committee/protocols/P-1/assign",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ personnel_id: 5, role: "Primary Reviewer" }),
      })
    );

    mockFetchOnce(200, { id: "P-1", review_method: "DMR" });
    await api.setReviewMethod("P-1", "DMR");
    expect(fetch).toHaveBeenCalledWith(
      "/api/committee/protocols/P-1/review-method",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ review_method: "DMR" }),
      })
    );
  });

  test("Appendix A endpoints hit the correct nested protocol paths", async () => {
    mockFetchOnce(200, []);
    await api.listProcedures("P-1");
    expect(fetch).toHaveBeenCalledWith("/api/protocols/P-1/procedures", expect.anything());

    mockFetchOnce(200, { ok: true });
    await api.updateProcedures("P-1", [{ procedure_key: "anesthesia", checked: true, description: "Isoflurane" }]);
    expect(fetch).toHaveBeenCalledWith(
      "/api/protocols/P-1/procedures",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({ procedures: [{ procedure_key: "anesthesia", checked: true, description: "Isoflurane" }] }),
      })
    );

    mockFetchOnce(200, []);
    await api.listDrugs("P-1");
    expect(fetch).toHaveBeenCalledWith("/api/protocols/P-1/drugs", expect.anything());

    mockFetchOnce(201, { id: 1 });
    await api.createDrug("P-1", { drug: "Ketamine" });
    expect(fetch).toHaveBeenCalledWith(
      "/api/protocols/P-1/drugs",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ drug: "Ketamine" }) })
    );

    mockFetchOnce(200, { id: 1 });
    await api.updateDrug("P-1", 1, { dose: "80 mg/kg" });
    expect(fetch).toHaveBeenCalledWith(
      "/api/protocols/P-1/drugs/1",
      expect.objectContaining({ method: "PATCH", body: JSON.stringify({ dose: "80 mg/kg" }) })
    );

    mockFetchOnce(204, undefined, { json: false });
    await api.deleteDrug("P-1", 1);
    expect(fetch).toHaveBeenCalledWith(
      "/api/protocols/P-1/drugs/1",
      expect.objectContaining({ method: "DELETE" })
    );

    mockFetchOnce(200, []);
    await api.listAnimalUse("P-1");
    expect(fetch).toHaveBeenCalledWith("/api/protocols/P-1/animal-use", expect.anything());

    mockFetchOnce(201, { id: 1 });
    await api.createAnimalUse("P-1", { species_strain: "C57BL/6 mouse", max_count: 10 });
    expect(fetch).toHaveBeenCalledWith(
      "/api/protocols/P-1/animal-use",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ species_strain: "C57BL/6 mouse", max_count: 10 }) })
    );

    mockFetchOnce(200, { id: 1 });
    await api.updateAnimalUse("P-1", 1, { sex: "Female" });
    expect(fetch).toHaveBeenCalledWith(
      "/api/protocols/P-1/animal-use/1",
      expect.objectContaining({ method: "PATCH", body: JSON.stringify({ sex: "Female" }) })
    );

    mockFetchOnce(204, undefined, { json: false });
    await api.deleteAnimalUse("P-1", 1);
    expect(fetch).toHaveBeenCalledWith(
      "/api/protocols/P-1/animal-use/1",
      expect.objectContaining({ method: "DELETE" })
    );

    mockFetchOnce(200, []);
    await api.listExperiments("P-1");
    expect(fetch).toHaveBeenCalledWith("/api/protocols/P-1/experiments", expect.anything());

    mockFetchOnce(201, { id: 1 });
    await api.createExperiment("P-1", { name: "Chronic restraint", multiple_surgical_events: 1 });
    expect(fetch).toHaveBeenCalledWith(
      "/api/protocols/P-1/experiments",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ name: "Chronic restraint", multiple_surgical_events: 1 }) })
    );

    mockFetchOnce(200, { id: 1 });
    await api.updateExperiment("P-1", 1, { monitoring_plan: "Daily scoring" });
    expect(fetch).toHaveBeenCalledWith(
      "/api/protocols/P-1/experiments/1",
      expect.objectContaining({ method: "PATCH", body: JSON.stringify({ monitoring_plan: "Daily scoring" }) })
    );

    mockFetchOnce(204, undefined, { json: false });
    await api.deleteExperiment("P-1", 1);
    expect(fetch).toHaveBeenCalledWith(
      "/api/protocols/P-1/experiments/1",
      expect.objectContaining({ method: "DELETE" })
    );

    mockFetchOnce(200, { av_consultation_required: true });
    await api.getAlternatives("P-1");
    expect(fetch).toHaveBeenCalledWith("/api/protocols/P-1/alternatives", expect.anything());

    mockFetchOnce(200, { av_consult_date: "2026-07-01" });
    await api.updateAlternatives("P-1", { av_consult_date: "2026-07-01" });
    expect(fetch).toHaveBeenCalledWith(
      "/api/protocols/P-1/alternatives",
      expect.objectContaining({ method: "PATCH", body: JSON.stringify({ av_consult_date: "2026-07-01" }) })
    );

    mockFetchOnce(200, [{ id: 1, rrr_type: "replacement", method: "Cell models" }]);
    await api.listRrrEntries("P-1");
    expect(fetch).toHaveBeenCalledWith("/api/protocols/P-1/rrr", expect.anything());

    mockFetchOnce(200, { id: 2, rrr_type: "reduction", method: "Power analysis" });
    await api.createRrrEntry("P-1", { rrr_type: "reduction", method: "Power analysis" });
    expect(fetch).toHaveBeenCalledWith(
      "/api/protocols/P-1/rrr",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ rrr_type: "reduction", method: "Power analysis" }) })
    );

    mockFetchOnce(200, { id: 2, rrr_type: "reduction", method: "Power analysis v2" });
    await api.updateRrrEntry("P-1", 2, { method: "Power analysis v2" });
    expect(fetch).toHaveBeenCalledWith(
      "/api/protocols/P-1/rrr/2",
      expect.objectContaining({ method: "PATCH", body: JSON.stringify({ method: "Power analysis v2" }) })
    );

    mockFetchOnce(204, null);
    await api.deleteRrrEntry("P-1", 2);
    expect(fetch).toHaveBeenCalledWith(
      "/api/protocols/P-1/rrr/2",
      expect.objectContaining({ method: "DELETE" })
    );

    mockFetchOnce(200, { overall: false, sections: {} });
    await api.getValidation("P-1");
    expect(fetch).toHaveBeenCalledWith("/api/protocols/P-1/validation", expect.anything());

    mockFetchOnce(200, { transactions: [], by_species: [], by_pain_category: [], by_procedure: [] });
    await api.listAnimalUsage("P-1");
    expect(fetch).toHaveBeenCalledWith("/api/protocols/P-1/animal-usage", expect.anything());

    mockFetchOnce(200, { id: 1, quantity: 20, type: "use" });
    await api.createAnimalUsage("P-1", { transaction_date: "2026-07-10", species_strain: "Wistar rat", quantity: 20, type: "use" });
    expect(fetch).toHaveBeenCalledWith(
      "/api/protocols/P-1/animal-usage",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ transaction_date: "2026-07-10", species_strain: "Wistar rat", quantity: 20, type: "use" }),
      })
    );
  });

  test("personnel compliance endpoints hit the correct paths", async () => {
    mockFetchOnce(200, []);
    await api.listPersonnelCompliance();
    expect(fetch).toHaveBeenCalledWith("/api/personnel/compliance", expect.anything());

    mockFetchOnce(200, { personnel: {}, courses: [], overall_status: "Current" });
    await api.getPersonnelTraining(5);
    expect(fetch).toHaveBeenCalledWith("/api/personnel/5/training", expect.anything());

    mockFetchOnce(201, { id: 7, course: "Rodent Surgery" });
    await api.createTrainingRecord(5, { course: "Rodent Surgery", completed_date: "2026-02-01" });
    expect(fetch).toHaveBeenCalledWith(
      "/api/personnel/5/training",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ course: "Rodent Surgery", completed_date: "2026-02-01" }),
      })
    );

    mockFetchOnce(200, { id: 7, expires_date: "2029-01-01" });
    await api.updateTrainingRecord(5, 7, { expires_date: "2029-01-01" });
    expect(fetch).toHaveBeenCalledWith(
      "/api/personnel/5/training/7",
      expect.objectContaining({ method: "PATCH", body: JSON.stringify({ expires_date: "2029-01-01" }) })
    );

    mockFetchOnce(204, null);
    await api.deleteTrainingRecord(5, 7);
    expect(fetch).toHaveBeenCalledWith(
      "/api/personnel/5/training/7",
      expect.objectContaining({ method: "DELETE" })
    );

    mockFetchOnce(200, { personnel_id: 5, status: "Pending" });
    await api.getPersonnelOhsp(5);
    expect(fetch).toHaveBeenCalledWith("/api/personnel/5/ohsp", expect.anything());

    mockFetchOnce(200, { personnel_id: 5, status: "Cleared" });
    await api.setPersonnelOhsp(5, { status: "Cleared" });
    expect(fetch).toHaveBeenCalledWith(
      "/api/personnel/5/ohsp",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ status: "Cleared" }) })
    );

    mockFetchOnce(200, { protocol_id: "P-1", personnel: [], all_compliant: false });
    await api.getProtocolPersonnel("P-1");
    expect(fetch).toHaveBeenCalledWith("/api/protocols/P-1/personnel", expect.anything());
  });

  test("facility & inspection endpoints hit the correct paths", async () => {
    mockFetchOnce(200, []);
    await api.listFacilities();
    expect(fetch).toHaveBeenCalledWith("/api/facilities", expect.anything());

    mockFetchOnce(201, { id: 1, name: "Rodent Housing" });
    await api.createFacility({ name: "Rodent Housing", type: "Housing Room", species: "Mouse" });
    expect(fetch).toHaveBeenCalledWith(
      "/api/facilities",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ name: "Rodent Housing", type: "Housing Room", species: "Mouse" }) })
    );

    mockFetchOnce(204, null);
    await api.deleteFacility(1);
    expect(fetch).toHaveBeenCalledWith("/api/facilities/1", expect.objectContaining({ method: "DELETE" }));

    mockFetchOnce(200, []);
    await api.listInspections();
    expect(fetch).toHaveBeenCalledWith("/api/inspections", expect.anything());

    mockFetchOnce(201, { id: 1, deficiencies: [] });
    await api.createInspection({ facility_id: 1, inspection_date: "2026-07-01", result: "Pass" });
    expect(fetch).toHaveBeenCalledWith(
      "/api/inspections",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ facility_id: 1, inspection_date: "2026-07-01", result: "Pass" }) })
    );

    mockFetchOnce(200, { id: 1, deficiencies: [] });
    await api.getInspection(1);
    expect(fetch).toHaveBeenCalledWith("/api/inspections/1", expect.anything());

    mockFetchOnce(200, []);
    await api.listDeficiencies(1);
    expect(fetch).toHaveBeenCalledWith("/api/inspections/1/deficiencies", expect.anything());

    mockFetchOnce(201, { id: 1, severity: "Major" });
    await api.createDeficiency(1, { severity: "Major", description: "Cage flood." });
    expect(fetch).toHaveBeenCalledWith(
      "/api/inspections/1/deficiencies",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ severity: "Major", description: "Cage flood." }) })
    );

    mockFetchOnce(200, { id: 1, remediated_at: "2026-07-02" });
    await api.remediateDeficiency(1, 1);
    expect(fetch).toHaveBeenCalledWith(
      "/api/inspections/1/deficiencies/1",
      expect.objectContaining({ method: "PATCH" })
    );
  });

  test("PAM & incident endpoints hit the correct paths", async () => {
    mockFetchOnce(200, []);
    await api.listIncidents();
    expect(fetch).toHaveBeenCalledWith("/api/incidents", expect.anything());

    mockFetchOnce(201, { id: 1 });
    await api.createIncident({ protocol_id: "P-1", type: "Adverse Event", description: "A" });
    expect(fetch).toHaveBeenCalledWith(
      "/api/incidents",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ protocol_id: "P-1", type: "Adverse Event", description: "A" }) })
    );

    mockFetchOnce(200, { id: 1 });
    await api.getIncident(1);
    expect(fetch).toHaveBeenCalledWith("/api/incidents/1", expect.anything());

    mockFetchOnce(200, { id: 1, status: "CAPA" });
    await api.updateIncident(1, { corrective_action: "Fix." });
    expect(fetch).toHaveBeenCalledWith(
      "/api/incidents/1",
      expect.objectContaining({ method: "PATCH", body: JSON.stringify({ corrective_action: "Fix." }) })
    );

    mockFetchOnce(200, []);
    await api.listPamAudits("P-1");
    expect(fetch).toHaveBeenCalledWith("/api/protocols/P-1/pam-audits", expect.anything());

    mockFetchOnce(201, { id: 1 });
    await api.createPamAudit("P-1", { audit_date: "2026-07-01" });
    expect(fetch).toHaveBeenCalledWith(
      "/api/protocols/P-1/pam-audits",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ audit_date: "2026-07-01" }) })
    );

    mockFetchOnce(200, []);
    await api.listPamAuditsForAll();
    expect(fetch).toHaveBeenCalledWith("/api/pam-audits", expect.anything());
  });

  test("amendment & renewal endpoints hit the correct nested paths", async () => {
    mockFetchOnce(200, []);
    await api.listAmendments("P-1");
    expect(fetch).toHaveBeenCalledWith("/api/protocols/P-1/amendments", expect.anything());

    mockFetchOnce(201, { id: 1, reason: "Add strain" });
    await api.createAmendment("P-1", { reason: "Add strain" });
    expect(fetch).toHaveBeenCalledWith(
      "/api/protocols/P-1/amendments",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ reason: "Add strain" }) })
    );

    mockFetchOnce(200, { id: 1, changes: [] });
    await api.getAmendment("P-1", 1);
    expect(fetch).toHaveBeenCalledWith("/api/protocols/P-1/amendments/1", expect.anything());

    mockFetchOnce(200, { id: 1, status: "Approved" });
    await api.updateAmendmentStatus("P-1", 1, "Approved", "2027-01-01");
    expect(fetch).toHaveBeenCalledWith(
      "/api/protocols/P-1/amendments/1",
      expect.objectContaining({ method: "PATCH", body: JSON.stringify({ status: "Approved", expiration_date: "2027-01-01" }) })
    );

    mockFetchOnce(200, { id: 1, status: "Rejected" });
    await api.updateAmendmentStatus("P-1", 1, "Rejected");
    expect(fetch).toHaveBeenCalledWith(
      "/api/protocols/P-1/amendments/1",
      expect.objectContaining({ method: "PATCH", body: JSON.stringify({ status: "Rejected" }) })
    );

    mockFetchOnce(201, { id: 1 });
    await api.addAmendmentChange("P-1", 1, { section: "drugs", field: "dose", previous_value: "10", new_value: "5" });
    expect(fetch).toHaveBeenCalledWith(
      "/api/protocols/P-1/amendments/1/changes",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ section: "drugs", field: "dose", previous_value: "10", new_value: "5" }) })
    );

    mockFetchOnce(200, []);
    await api.listProtocolVersions("P-1");
    expect(fetch).toHaveBeenCalledWith("/api/protocols/P-1/versions", expect.anything());

    mockFetchOnce(200, []);
    await api.listRenewals("P-1");
    expect(fetch).toHaveBeenCalledWith("/api/protocols/P-1/renewals", expect.anything());

    mockFetchOnce(201, { id: 1, type: "Continuing Review" });
    await api.createRenewal("P-1", { type: "Continuing Review" });
    expect(fetch).toHaveBeenCalledWith(
      "/api/protocols/P-1/renewals",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ type: "Continuing Review" }) })
    );

    mockFetchOnce(200, { id: 1, status: "Approved" });
    await api.updateRenewalStatus("P-1", 1, "Approved", "2029-01-01");
    expect(fetch).toHaveBeenCalledWith(
      "/api/protocols/P-1/renewals/1",
      expect.objectContaining({ method: "PATCH", body: JSON.stringify({ status: "Approved", approved_until: "2029-01-01" }) })
    );

    mockFetchOnce(200, { id: 1, status: "Rejected" });
    await api.updateRenewalStatus("P-1", 1, "Rejected");
    expect(fetch).toHaveBeenCalledWith(
      "/api/protocols/P-1/renewals/1",
      expect.objectContaining({ method: "PATCH", body: JSON.stringify({ status: "Rejected" }) })
    );
  });

  test("audit log endpoint omits empty filters and URL-encodes values", async () => {
    mockFetchOnce(200, []);
    await api.getAuditLog();
    expect(fetch).toHaveBeenCalledWith("/api/audit", expect.anything());

    mockFetchOnce(200, []);
    await api.getAuditLog({ action: "species.created", provenance: "human", limit: 50 });
    expect(fetch).toHaveBeenCalledWith(
      "/api/audit?action=species.created&provenance=human&limit=50",
      expect.anything()
    );

    mockFetchOnce(200, []);
    await api.getAuditLog({ entity_type: "species", entity_id: "0142", actor: "", from: "2026-01-01", to: "2026-12-31" });
    expect(fetch).toHaveBeenCalledWith(
      "/api/audit?entity_type=species&entity_id=0142&from=2026-01-01&to=2026-12-31",
      expect.anything()
    );
  });
});
