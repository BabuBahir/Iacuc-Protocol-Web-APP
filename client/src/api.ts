import type {
  Alternatives,
  AlternativesInput,
  Amendment,
  AmendmentChange,
  AmendmentChangeInput,
  AmendmentInput,
  AmendmentStatus,
  AnimalUsageInput,
  AnimalUsageLedger,
  AnimalUsageTransaction,
  AnimalUseInput,
  AnimalUseRow,
  AuditEntry,
  AuditQuery,
  CommitteeProtocol,
  CommitteeReview,
  CommitteeTally,
  DeficiencyInput,
  DrugInput,
  DrugRow,
  ExperimentInput,
  ExperimentRow,
  Facility,
  FacilityInput,
  Incident,
  IncidentInput,
  IncidentUpdateInput,
  Inspection,
  InspectionDetail,
  InspectionDeficiency,
  InspectionInput,
  PamAudit,
  PamAuditInput,
  Personnel,
  PersonnelCompliance,
  PersonnelInput,
  PersonnelOhsp,
  PersonnelOhspInput,
  PersonnelTrainingResponse,
  Procedure,
  ProcedureInput,
  Protocol,
  ProtocolDetail,
  ProtocolInput,
  ProtocolPersonnelResponse,
  ProtocolTransfer,
  ProtocolUpdateInput,
  ProtocolVersion,
  ProtocolVotesResponse,
  Renewal,
  RenewalInput,
  RenewalStatus,
  ReviewAssignmentInput,
  ReviewComment,
  ReviewCommentInput,
  ReviewMethod,
  ReviewerAssignment,
  Role,
  RrrInput,
  RrrEntry,
  ReportsPayload,
  Species,
  Summary,
  TrainingRecord,
  TrainingRecordInput,
  TransferBulkInput,
  TransferInput,
  TransferStatus,
  ValidationResult,
  VoteInput,
  Voter,
} from "./types";
import { getActingAs, ACTOR_HEADER_NAME } from "./identity";

// Thin wrapper around fetch calls to the Express API.
// In dev, Vite proxies /api -> http://localhost:4000 (see vite.config.js),
// so no base URL is needed here. In production the vite `define` block bakes
// process.env.API_BASE_URL into the bundle at build time, so a deployed SPA
// (e.g. Vercel) calls the API host directly instead of a same-origin /api
// path that no dev proxy exists to forward. With the env unset, API_BASE is
// "" and requests stay same-origin, preserving the dev flow.

const API_BASE = process.env.API_BASE_URL || process.env.api_base_url || "";

interface ErrorBody {
  error?: string;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };

  // Attach the self-declared "acting as" identity (see identity.ts) to every
  // request, if one is set. This is what makes the audit trail show a real
  // name instead of "system" — it costs nothing extra at each call site
  // since it's centralized here, and it's a no-op (header simply omitted)
  // for anyone who hasn't picked an identity, so anonymous use is unaffected.
  const actingAs = getActingAs();
  if (actingAs) headers[ACTOR_HEADER_NAME] = actingAs.name;

  const res = await fetch(`${API_BASE}/api${path}`, {
    ...options,
    headers: { ...headers, ...(options.headers as Record<string, string> | undefined) },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as ErrorBody;
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  if (res.status === 204) return null as T;
  return res.json() as Promise<T>;
}

export const api = {
  listProtocols: (query = ""): Promise<Protocol[]> =>
    request(`/protocols${query ? `?q=${encodeURIComponent(query)}` : ""}`),
  getSummary: (): Promise<Summary> => request("/protocols/summary"),
  getProtocol: (id: string): Promise<ProtocolDetail> => request(`/protocols/${id}`),
  createProtocol: (data: ProtocolInput): Promise<Protocol> =>
    request("/protocols", { method: "POST", body: JSON.stringify(data) }),
  updateProtocol: (id: string, data: Partial<ProtocolUpdateInput>): Promise<Protocol> =>
    request(`/protocols/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteProtocol: (id: string): Promise<null> => request(`/protocols/${id}`, { method: "DELETE" }),

  // admin: species
  listSpecies: (): Promise<Species[]> => request("/admin/species"),
  createSpecies: (name: string): Promise<Species> =>
    request("/admin/species", { method: "POST", body: JSON.stringify({ name }) }),
  deleteSpecies: (id: number): Promise<null> => request(`/admin/species/${id}`, { method: "DELETE" }),

  // admin: roles
  listRoles: (): Promise<Role[]> => request("/admin/roles"),
  createRole: (name: string, isCommittee: boolean): Promise<Role> =>
    request("/admin/roles", { method: "POST", body: JSON.stringify({ name, is_committee: isCommittee }) }),
  deleteRole: (id: number): Promise<null> => request(`/admin/roles/${id}`, { method: "DELETE" }),

  // admin: personnel (personas)
  listPersonnel: (): Promise<Personnel[]> => request("/admin/personnel"),
  createPersonnel: (data: PersonnelInput): Promise<Personnel> =>
    request("/admin/personnel", { method: "POST", body: JSON.stringify(data) }),
  deletePersonnel: (id: number): Promise<null> => request(`/admin/personnel/${id}`, { method: "DELETE" }),

  // personnel compliance (Domain C): CITI training + OHSP clearance
  listPersonnelCompliance: (): Promise<PersonnelCompliance[]> => request("/personnel/compliance"),
  getPersonnelTraining: (id: number): Promise<PersonnelTrainingResponse> =>
    request(`/personnel/${id}/training`),
  createTrainingRecord: (id: number, data: TrainingRecordInput): Promise<TrainingRecord> =>
    request(`/personnel/${id}/training`, { method: "POST", body: JSON.stringify(data) }),
  updateTrainingRecord: (
    id: number,
    trainingId: number,
    data: Partial<TrainingRecordInput>,
  ): Promise<TrainingRecord> =>
    request(`/personnel/${id}/training/${trainingId}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteTrainingRecord: (id: number, trainingId: number): Promise<null> =>
    request(`/personnel/${id}/training/${trainingId}`, { method: "DELETE" }),
  getPersonnelOhsp: (id: number): Promise<PersonnelOhsp> => request(`/personnel/${id}/ohsp`),
  setPersonnelOhsp: (id: number, data: PersonnelOhspInput): Promise<PersonnelOhsp> =>
    request(`/personnel/${id}/ohsp`, { method: "POST", body: JSON.stringify(data) }),
  getProtocolPersonnel: (id: string): Promise<ProtocolPersonnelResponse> =>
    request(`/protocols/${id}/personnel`),

  // committee: FCR voting + review workflow
  listCommitteeProtocols: (): Promise<CommitteeProtocol[]> => request("/committee/protocols"),
  listVoters: (): Promise<Voter[]> => request("/committee/voters"),
  getProtocolVotes: (id: string): Promise<ProtocolVotesResponse> =>
    request(`/committee/protocols/${id}/votes`),
  castVote: (id: string, data: VoteInput): Promise<CommitteeTally> =>
    request(`/committee/protocols/${id}/votes`, { method: "POST", body: JSON.stringify(data) }),
  getReviews: (id: string): Promise<CommitteeReview> =>
    request(`/committee/protocols/${id}/reviews`),
  postReview: (id: string, data: VoteInput): Promise<CommitteeReview> =>
    request(`/committee/protocols/${id}/reviews`, { method: "POST", body: JSON.stringify(data) }),
  postComment: (id: string, data: ReviewCommentInput): Promise<ReviewComment> =>
    request(`/committee/protocols/${id}/comments`, { method: "POST", body: JSON.stringify(data) }),
  assignReviewer: (id: string, data: ReviewAssignmentInput): Promise<ReviewerAssignment> =>
    request(`/committee/protocols/${id}/assign`, { method: "PATCH", body: JSON.stringify(data) }),
  setReviewMethod: (id: string, review_method: ReviewMethod): Promise<Protocol> =>
    request(`/committee/protocols/${id}/review-method`, {
      method: "PATCH",
      body: JSON.stringify({ review_method }),
    }),

  // Appendix A application content
  listProcedures: (id: string): Promise<Procedure[]> => request(`/protocols/${id}/procedures`),
  updateProcedures: (id: string, procedures: ProcedureInput[]): Promise<{ ok: boolean }> =>
    request(`/protocols/${id}/procedures`, { method: "PUT", body: JSON.stringify({ procedures }) }),
  listDrugs: (id: string): Promise<DrugRow[]> => request(`/protocols/${id}/drugs`),
  createDrug: (id: string, data: DrugInput): Promise<DrugRow> =>
    request(`/protocols/${id}/drugs`, { method: "POST", body: JSON.stringify(data) }),
  updateDrug: (id: string, drugId: number, data: Partial<DrugInput>): Promise<DrugRow> =>
    request(`/protocols/${id}/drugs/${drugId}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteDrug: (id: string, drugId: number): Promise<null> =>
    request(`/protocols/${id}/drugs/${drugId}`, { method: "DELETE" }),
  listAnimalUse: (id: string): Promise<AnimalUseRow[]> => request(`/protocols/${id}/animal-use`),
  createAnimalUse: (id: string, data: AnimalUseInput): Promise<AnimalUseRow> =>
    request(`/protocols/${id}/animal-use`, { method: "POST", body: JSON.stringify(data) }),
  updateAnimalUse: (id: string, rowId: number, data: Partial<AnimalUseInput>): Promise<AnimalUseRow> =>
    request(`/protocols/${id}/animal-use/${rowId}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteAnimalUse: (id: string, rowId: number): Promise<null> =>
    request(`/protocols/${id}/animal-use/${rowId}`, { method: "DELETE" }),
  listAnimalUsage: (id: string): Promise<AnimalUsageLedger> => request(`/protocols/${id}/animal-usage`),
  createAnimalUsage: (id: string, data: AnimalUsageInput): Promise<AnimalUsageTransaction> =>
    request(`/protocols/${id}/animal-usage`, { method: "POST", body: JSON.stringify(data) }),
  listExperiments: (id: string): Promise<ExperimentRow[]> => request(`/protocols/${id}/experiments`),
  createExperiment: (id: string, data: ExperimentInput): Promise<ExperimentRow> =>
    request(`/protocols/${id}/experiments`, { method: "POST", body: JSON.stringify(data) }),
  updateExperiment: (id: string, expId: number, data: Partial<ExperimentInput>): Promise<ExperimentRow> =>
    request(`/protocols/${id}/experiments/${expId}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteExperiment: (id: string, expId: number): Promise<null> =>
    request(`/protocols/${id}/experiments/${expId}`, { method: "DELETE" }),
  getAlternatives: (id: string): Promise<Alternatives> => request(`/protocols/${id}/alternatives`),
  updateAlternatives: (id: string, data: AlternativesInput): Promise<Alternatives> =>
    request(`/protocols/${id}/alternatives`, { method: "PATCH", body: JSON.stringify(data) }),
  listRrrEntries: (id: string): Promise<RrrEntry[]> => request(`/protocols/${id}/rrr`),
  createRrrEntry: (id: string, data: RrrInput): Promise<RrrEntry> =>
    request(`/protocols/${id}/rrr`, { method: "POST", body: JSON.stringify(data) }),
  updateRrrEntry: (id: string, entryId: number, data: Partial<RrrInput>): Promise<RrrEntry> =>
    request(`/protocols/${id}/rrr/${entryId}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteRrrEntry: (id: string, entryId: number): Promise<null> =>
    request(`/protocols/${id}/rrr/${entryId}`, { method: "DELETE" }),
  getValidation: (id: string): Promise<ValidationResult> => request(`/protocols/${id}/validation`),

  // ---- Domain F: facilities & semi-annual inspections ----
  listFacilities: (): Promise<Facility[]> => request("/facilities"),
  createFacility: (data: FacilityInput): Promise<Facility> =>
    request("/facilities", { method: "POST", body: JSON.stringify(data) }),
  deleteFacility: (id: number): Promise<null> => request(`/facilities/${id}`, { method: "DELETE" }),
  listInspections: (): Promise<Inspection[]> => request("/inspections"),
  createInspection: (data: InspectionInput): Promise<InspectionDetail> =>
    request("/inspections", { method: "POST", body: JSON.stringify(data) }),
  getInspection: (id: number): Promise<InspectionDetail> => request(`/inspections/${id}`),
  listDeficiencies: (id: number): Promise<InspectionDeficiency[]> =>
    request(`/inspections/${id}/deficiencies`),
  createDeficiency: (id: number, data: DeficiencyInput): Promise<InspectionDeficiency> =>
    request(`/inspections/${id}/deficiencies`, { method: "POST", body: JSON.stringify(data) }),
  remediateDeficiency: (id: number, defId: number): Promise<InspectionDeficiency> =>
    request(`/inspections/${id}/deficiencies/${defId}`, { method: "PATCH", body: JSON.stringify({}) }),

  // ---- Domain E: PAM & incident reporting ----
  listIncidents: (): Promise<Incident[]> => request("/incidents"),
  createIncident: (data: IncidentInput): Promise<Incident> =>
    request("/incidents", { method: "POST", body: JSON.stringify(data) }),
  getIncident: (id: number): Promise<Incident> => request(`/incidents/${id}`),
  updateIncident: (id: number, data: IncidentUpdateInput): Promise<Incident> =>
    request(`/incidents/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  listPamAudits: (id: string): Promise<PamAudit[]> => request(`/protocols/${id}/pam-audits`),
  createPamAudit: (id: string, data: PamAuditInput): Promise<PamAudit> =>
    request(`/protocols/${id}/pam-audits`, { method: "POST", body: JSON.stringify(data) }),
  listPamAuditsForAll: (): Promise<PamAudit[]> => request("/pam-audits"),

  // ---- Domain B: amendments & annual renewals ----
  listAmendments: (id: string): Promise<Amendment[]> => request(`/protocols/${id}/amendments`),
  createAmendment: (id: string, data: AmendmentInput): Promise<Amendment> =>
    request(`/protocols/${id}/amendments`, { method: "POST", body: JSON.stringify(data) }),
  getAmendment: (id: string, amendmentId: number): Promise<Amendment> =>
    request(`/protocols/${id}/amendments/${amendmentId}`),
  updateAmendmentStatus: (
    id: string,
    amendmentId: number,
    status: AmendmentStatus,
    expirationDate?: string,
  ): Promise<Amendment> =>
    request(`/protocols/${id}/amendments/${amendmentId}`, {
      method: "PATCH",
      body: JSON.stringify({ status, ...(expirationDate ? { expiration_date: expirationDate } : {}) }),
    }),
  addAmendmentChange: (
    id: string,
    amendmentId: number,
    data: AmendmentChangeInput,
  ): Promise<AmendmentChange> =>
    request(`/protocols/${id}/amendments/${amendmentId}/changes`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  listProtocolVersions: (id: string): Promise<ProtocolVersion[]> => request(`/protocols/${id}/versions`),
  listRenewals: (id: string): Promise<Renewal[]> => request(`/protocols/${id}/renewals`),
  createRenewal: (id: string, data: RenewalInput): Promise<Renewal> =>
    request(`/protocols/${id}/renewals`, { method: "POST", body: JSON.stringify(data) }),
  updateRenewalStatus: (
    id: string,
    renewalId: number,
    status: RenewalStatus,
    approvedUntil?: string,
  ): Promise<Renewal> =>
    request(`/protocols/${id}/renewals/${renewalId}`, {
      method: "PATCH",
      body: JSON.stringify({ status, ...(approvedUntil ? { approved_until: approvedUntil } : {}) }),
    }),

  // ---- Transfer ownership ----
  listTransfers: (status?: TransferStatus): Promise<ProtocolTransfer[]> =>
    request(`/transfers${status ? `?status=${status}` : ""}`),
  createTransfer: (id: string, data: TransferInput): Promise<ProtocolTransfer> =>
    request(`/protocols/${id}/transfers`, { method: "POST", body: JSON.stringify(data) }),
  bulkCreateTransfers: (data: TransferBulkInput): Promise<ProtocolTransfer[]> =>
    request("/transfers", { method: "POST", body: JSON.stringify(data) }),
  updateTransferStatus: (transferId: number, status: "Approved" | "Rejected"): Promise<ProtocolTransfer> =>
    request(`/transfers/${transferId}`, { method: "PATCH", body: JSON.stringify({ status }) }),

  // ---- Audit log ----
  getAuditLog: (params: AuditQuery = {}): Promise<AuditEntry[]> => {
    const qs = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== "") {
        qs.set(key, String(value));
      }
    }
    const query = qs.toString();
    return request(`/audit${query ? `?${query}` : ""}`);
  },

  // ---- AAALAC-style compliance reports (Roadmap item 9) ----
  getReports: (): Promise<ReportsPayload> => request("/reports"),
};
