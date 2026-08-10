// Shared client-side types mirroring the Express API response shapes
// (server/src/routes/protocols.js, admin.js, committee.js).

// A single step of the research procedure plan. The server normalizes legacy
// free-text steps (stored as plain strings in old databases) into this shape on
// read, so the client can always treat steps as structured objects.
export interface ResearchStep {
  description: string;
  duration: string;
  frequency: string;
  species: string;
  pain_category: string;
  anesthesia: "Yes" | "No";
  location: string;
  personnel: string;
  notes: string;
}

export const STEP_FREQUENCIES = [
  "Once",
  "Daily",
  "Weekly",
  "Monthly",
  "As needed",
  "Continuous",
] as const;

export interface Protocol {
  id: string;
  title: string;
  pi: string;
  pi_proxy: string | null;
  ptm_member: string | null;
  protocol_type: string | null;
  species: string | null;
  status: string;
  animals: number | null;
  pain_category: string | null;
  anesthesia_required: number | null;
  housing: string | null;
  disposal: string | null;
  npg: string | null;
  research_steps: ResearchStep[];
  purpose_summary: string | null;
  harm_benefit_analysis: string | null;
  scientific_summary: string | null;
  submitted: string | null;
  expires: string | null;
}

export interface ProtocolDetail extends Protocol {
  stages: string[];
  related: Record<string, string[]>;
}

export interface Summary {
  active: number;
  pendingReview: number;
  expiringSoon: number;
  approvedThisQuarter: number;
}

export interface Species {
  id: number;
  name: string;
}

export interface Role {
  id: number;
  name: string;
  is_committee: 0 | 1;
}

export interface Personnel {
  id: number;
  name: string;
  email: string | null;
  role_id: number;
  role_name?: string;
  is_committee?: 0 | 1;
}

export interface ProtocolVote {
  voter_name: string;
  role_name: string;
  vote: string;
  comment: string | null;
}

export interface Voter {
  id: number;
  name: string;
  role_name: string;
}

export interface CommitteeTally {
  votes: ProtocolVote[];
  counts: Record<string, number>;
  totalVotes: number;
}

export type ReviewMethod = "FCR" | "DMR";

export const REVIEW_METHODS: ReviewMethod[] = ["FCR", "DMR"];

export type AssignmentRole =
  | "Primary Reviewer"
  | "Secondary Reviewer"
  | "Designated Member";

export const ASSIGNMENT_ROLES: AssignmentRole[] = [
  "Primary Reviewer",
  "Secondary Reviewer",
  "Designated Member",
];

export type ReviewSection =
  | "overall"
  | "summaries"
  | "procedures"
  | "drugs"
  | "animal_use"
  | "experiments"
  | "alternatives";

export const REVIEW_SECTIONS: ReviewSection[] = [
  "overall",
  "summaries",
  "procedures",
  "drugs",
  "animal_use",
  "experiments",
  "alternatives",
];

export const REVIEW_SECTION_LABELS: Record<ReviewSection, string> = {
  overall: "Overall",
  summaries: "Summaries",
  procedures: "Procedures",
  drugs: "Drugs",
  animal_use: "Animal Use",
  experiments: "Experiments",
  alternatives: "Alternatives",
};

export interface ReviewerAssignment {
  personnel_id: number;
  reviewer_name: string;
  role: AssignmentRole;
  assigned_at: string;
}

export interface ReviewComment {
  id: number;
  personnel_id: number;
  commenter_name: string;
  section: ReviewSection;
  comment: string;
  created_at: string;
}

export interface CommitteeProtocol extends CommitteeTally {
  id: string;
  title: string;
  pi: string;
  species: string | null;
  status: string;
  review_method: ReviewMethod | null;
  assignments: ReviewerAssignment[];
  comments: ReviewComment[];
}

export interface ProtocolVotesResponse extends Protocol, CommitteeTally {
  assignments: ReviewerAssignment[];
  comments: ReviewComment[];
}

export interface CommitteeReview extends Protocol, CommitteeTally {
  assignments: ReviewerAssignment[];
  comments: ReviewComment[];
}

// ---- payloads the client sends ----

export interface ProtocolInput {
  id: string;
  title: string;
  pi: string;
  pi_proxy: string | null;
  ptm_member: string | null;
  protocol_type: string | null;
  species: string | null;
  animals: number | null;
  pain_category: string | null;
  anesthesia_required: number | null;
  housing: string | null;
  disposal: string | null;
  npg: string | null;
  research_steps: ResearchStep[];
  purpose_summary: string | null;
  harm_benefit_analysis: string | null;
  scientific_summary: string | null;
}

export interface ProtocolUpdateInput {
  title: string;
  pi: string;
  pi_proxy: string | null;
  ptm_member: string | null;
  protocol_type: string | null;
  species: string | null;
  animals: number | null;
  pain_category: string | null;
  anesthesia_required: number | null;
  housing: string | null;
  disposal: string | null;
  npg: string | null;
  research_steps: ResearchStep[];
  purpose_summary: string | null;
  harm_benefit_analysis: string | null;
  scientific_summary: string | null;
  status: string | null;
  submitted: string | null;
  expires: string | null;
}

export interface ProtocolFormValues extends ProtocolUpdateInput {
  id: string;
}

export interface PersonnelInput {
  name: string;
  email: string | null;
  role_id: number;
}

// ---- personnel compliance (Domain C): CITI-style training + OHSP clearance ----

export type TrainingStatus = "Current" | "Expired";
export type OverallTrainingStatus = TrainingStatus | "No records";
export type OhspStatus = "Pending" | "Cleared" | "Denied";

export const OHSP_STATUSES: OhspStatus[] = ["Pending", "Cleared", "Denied"];

export interface TrainingRecord {
  id: number;
  personnel_id: number;
  course: string;
  completed_date: string;
  expires_date: string | null;
  status: TrainingStatus;
}

export interface TrainingRecordInput {
  course: string;
  completed_date: string;
  expires_date?: string | null;
}

export interface PersonnelOhsp {
  personnel_id: number;
  status: OhspStatus;
  reviewed_date: string | null;
  notes: string | null;
}

export interface PersonnelOhspInput {
  status: OhspStatus;
  reviewed_date?: string | null;
  notes?: string | null;
}

export interface PersonnelTrainingResponse {
  personnel: { id: number; name: string; role_name: string };
  courses: TrainingRecord[];
  overall_status: OverallTrainingStatus;
}

export interface PersonnelCompliance {
  id: number;
  name: string;
  role_name: string;
  training_status: OverallTrainingStatus;
  ohsp_status: OhspStatus;
  compliant: boolean;
}

export interface ProtocolPersonnelEntry {
  label: string;
  name: string;
  role: string | null;
  personnel_id: number | null;
  compliance: {
    training_status: OverallTrainingStatus | "No profile";
    ohsp_status: OhspStatus | "No profile";
    compliant: boolean;
  };
}

export interface ProtocolPersonnelResponse {
  protocol_id: string;
  personnel: ProtocolPersonnelEntry[];
  all_compliant: boolean;
}

export interface VoteInput {
  personnel_id: number;
  vote: string;
  comment: string | null;
}

export interface ReviewCommentInput {
  personnel_id: number;
  section: ReviewSection;
  comment: string;
}

export interface ReviewAssignmentInput {
  personnel_id: number;
  role: AssignmentRole;
}

// ---- Appendix A application content ----

export interface Procedure {
  procedure_key: string;
  label: string;
  checked: boolean;
  description: string;
  surgical_description: string;
  aseptic_preparation: string;
  analgesia_level: string;
  postop_care: string;
}

export interface ProcedureInput {
  procedure_key: string;
  checked: boolean;
  description: string;
  surgical_description?: string;
  aseptic_preparation?: string;
  analgesia_level?: string;
  postop_care?: string;
}

export interface DrugRow {
  id: number;
  protocol_id: string;
  reason_for_use: string | null;
  drug: string;
  dose: string | null;
  route: string | null;
  duration: string | null;
}

export interface DrugInput {
  reason_for_use?: string | null;
  drug: string;
  dose?: string | null;
  route?: string | null;
  duration?: string | null;
}

export interface AnimalUseRow {
  id: number;
  protocol_id: string;
  species_strain: string;
  sex: string | null;
  approx_age: string | null;
  max_count: number | null;
}

export interface AnimalUseInput {
  species_strain: string;
  sex?: string | null;
  approx_age?: string | null;
  max_count?: number | null;
}

// ---- animal usage register (actual orders/uses against the approved allowance) ----

export type UsageType = "order" | "use";

export const USDA_PAIN_LEVELS = ["B", "C", "D", "E"];

export interface AnimalUsageTransaction {
  id: number;
  protocol_id: string;
  protocol_title?: string | null;
  transaction_date: string;
  species_strain: string;
  pain_level: string | null;
  quantity: number;
  type: UsageType;
  procedure_key: string | null;
  notes: string | null;
  created_at: string | null;
}

export interface AnimalUsageInput {
  transaction_date: string;
  species_strain: string;
  pain_level?: string | null;
  quantity: number;
  type?: UsageType;
  procedure_key?: string | null;
  notes?: string | null;
}

export interface AnimalUsageSpeciesSummary {
  species_strain: string;
  allowance: number;
  ordered: number;
  used: number;
  remaining: number;
  over_allowance: boolean;
}

export interface AnimalUsageLedger {
  transactions: AnimalUsageTransaction[];
  by_species: AnimalUsageSpeciesSummary[];
  by_pain_category: { pain_level: string; count: number }[];
  by_procedure: { procedure_key: string; count: number }[];
}

export interface ExperimentRow {
  id: number;
  protocol_id: string;
  name: string;
  description: string | null;
  multiple_surgical_events: number;
  humane_endpoints: string | null;
  persistent_clinical_signs_justification: string | null;
  monitoring_plan: string | null;
  husbandry_exceptions: string | null;
}

export interface ExperimentInput {
  name: string;
  description?: string | null;
  multiple_surgical_events?: boolean | number;
  humane_endpoints?: string | null;
  persistent_clinical_signs_justification?: string | null;
  monitoring_plan?: string | null;
  husbandry_exceptions?: string | null;
}

export interface Alternatives {
  protocol_id: string;
  lit_databases: string | null;
  lit_years_from: string | null;
  lit_years_to: string | null;
  lit_search_date: string | null;
  lit_keywords: string | null;
  lit_summary: string | null;
  colleague_name: string | null;
  colleague_date: string | null;
  colleague_notes: string | null;
  av_consult_date: string | null;
  av_consultation_required: boolean;
}

export type AlternativesInput = Partial<
  Omit<Alternatives, "protocol_id" | "av_consultation_required">
>;

export const RRR_TYPES = ["replacement", "refinement", "reduction"] as const;
export type RrrType = (typeof RRR_TYPES)[number];

export const RRR_LABELS: Record<RrrType, string> = {
  replacement: "Replacement",
  refinement: "Refinement",
  reduction: "Reduction",
};

// Surgery procedures get an expanded detail block on the application page.
export const SURGERY_PROCEDURE_KEYS = ["survival_surgery", "non_survival_surgery"];

// Full procedure checklist keys (mirrors server PROCEDURE_KEYS in
// protocol-form.js), used to label usage-register transactions.
export const PROCEDURE_KEYS = [
  "breeding",
  "animal_id",
  "anesthesia",
  "blood_collection",
  "injections",
  "exposure_substance",
  "non_pharma_compounds",
  "prolonged_restraint",
  "pain_distress",
  "non_survival_surgery",
  "tissue_collection",
  "survival_surgery",
  "illness_endpoint",
  "special_diets",
  "offsite_work",
];

export const ANALGESIA_LEVELS = ["None", "Mild", "Moderate", "Profound"];

export interface RrrEntry {
  id: number;
  protocol_id: string;
  rrr_type: RrrType;
  method: string;
  explanation: string | null;
}

export interface RrrInput {
  rrr_type: RrrType;
  method: string;
  explanation?: string | null;
}

export interface ValidationSection {
  complete: boolean;
  missing: string[];
}

export interface ValidationResult {
  overall: boolean;
  avRequired: boolean;
  sections: {
    summaries: ValidationSection;
    procedures: ValidationSection;
    drugs: ValidationSection;
    animal_use: ValidationSection;
    experiments: ValidationSection;
    alternatives: ValidationSection;
  };
}

// ---- Domain F: facilities & semi-annual inspections ----

export const FACILITY_TYPES = ["Housing Room", "Lab", "Surgical Suite"] as const;
export type FacilityType = (typeof FACILITY_TYPES)[number];

export const INSPECTION_RESULTS = ["Pending", "Pass", "Fail", "Re-inspection required"] as const;
export type InspectionResult = (typeof INSPECTION_RESULTS)[number];

export const DEFICIENCY_SEVERITIES = ["Minor", "Major"] as const;
export type DeficiencySeverity = (typeof DEFICIENCY_SEVERITIES)[number];

export interface Facility {
  id: number;
  name: string;
  type: FacilityType;
  species: string | null;
}

export interface FacilityInput {
  name: string;
  type: FacilityType;
  species?: string | null;
}

export interface Inspection {
  id: number;
  facility_id: number;
  facility_name: string;
  inspection_date: string;
  report: string | null;
  result: InspectionResult;
  created_at: string | null;
}

export interface InspectionInput {
  facility_id: number;
  inspection_date: string;
  report?: string | null;
  result?: InspectionResult;
}

export interface InspectionDeficiency {
  id: number;
  inspection_id: number;
  severity: DeficiencySeverity;
  description: string;
  remediation_deadline: string | null;
  remediated_at: string | null;
}

export interface InspectionDetail extends Inspection {
  deficiencies: InspectionDeficiency[];
}

export interface DeficiencyInput {
  severity: DeficiencySeverity;
  description: string;
  remediation_deadline?: string | null;
}

// ---- Domain E: PAM & incident reporting ----

export const INCIDENT_TYPES = [
  "Adverse Event",
  "Deviation",
  "Noncompliance",
  "Unanticipated Problem",
] as const;
export type IncidentType = (typeof INCIDENT_TYPES)[number];

export const INCIDENT_SEVERITIES = ["Minor", "Major", "Immediate"] as const;
export type IncidentSeverity = (typeof INCIDENT_SEVERITIES)[number];

export const INCIDENT_STATUSES = ["Open", "CAPA", "Closed"] as const;
export type IncidentStatus = (typeof INCIDENT_STATUSES)[number];

export interface Incident {
  id: number;
  protocol_id: string | null;
  type: IncidentType;
  description: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  corrective_action: string | null;
  closed_at: string | null;
  reported_by: number | null;
  reported_by_name: string | null;
  assigned_to: number | null;
  assigned_to_name: string | null;
  created_at: string | null;
}

export interface IncidentInput {
  protocol_id?: string | null;
  type: IncidentType;
  description: string;
  severity?: IncidentSeverity;
  reported_by?: number | null;
  assigned_to?: number | null;
}

export interface IncidentUpdateInput {
  status?: IncidentStatus;
  corrective_action?: string | null;
  assigned_to?: number | null;
}

export interface PamAudit {
  id: number;
  protocol_id: string;
  audit_date: string;
  auditor_id: number | null;
  auditor_name: string | null;
  site_visits: string | null;
  findings: string | null;
  report: string | null;
  created_at: string | null;
}

export interface PamAuditInput {
  audit_date: string;
  auditor_id?: number | null;
  site_visits?: string | null;
  findings?: string | null;
  report?: string | null;
}

// ---- Domain B: amendments & annual renewals ----

export const AMENDMENT_STATUSES = ["Pending", "Approved", "Rejected"] as const;
export type AmendmentStatus = (typeof AMENDMENT_STATUSES)[number];

export interface AmendmentChange {
  id: number;
  amendment_id: number;
  section: string;
  field: string;
  previous_value: string | null;
  new_value: string | null;
  created_at: string | null;
}

export interface Amendment {
  id: number;
  protocol_id: string;
  reason: string;
  status: AmendmentStatus;
  created_at: string | null;
  changes: AmendmentChange[];
}

export interface AmendmentInput {
  reason: string;
}

export interface AmendmentChangeInput {
  section: string;
  field: string;
  previous_value?: string | null;
  new_value?: string | null;
}

export interface ProtocolVersion {
  id: number;
  protocol_id: string;
  version_number: string;
  source: "New Document" | "Amendment Document" | "De Novo Document";
  approved_date: string | null;
  expiration_date: string | null;
  version_date: string | null;
}

export const RENEWAL_TYPES = ["Continuing Review", "De Novo Review"] as const;
export type RenewalType = (typeof RENEWAL_TYPES)[number];

export const RENEWAL_STATUSES = ["Pending", "Approved", "Rejected"] as const;
export type RenewalStatus = (typeof RENEWAL_STATUSES)[number];

export interface Renewal {
  id: number;
  protocol_id: string;
  type: RenewalType;
  status: RenewalStatus;
  submitted_date: string | null;
  decision_date: string | null;
  approved_until: string | null;
  created_at: string | null;
}

export interface RenewalInput {
  type: RenewalType;
}

// ---- Transfer ownership (its own approval workflow) ----

export const TRANSFER_STATUSES = ["Pending", "Approved", "Rejected"] as const;
export type TransferStatus = (typeof TRANSFER_STATUSES)[number];

export interface ProtocolTransfer {
  id: number;
  protocol_id: string;
  protocol_title: string | null;
  from_pi: string;
  to_personnel_id: number;
  to_name: string | null;
  reason: string;
  status: TransferStatus;
  created_at: string | null;
  decision_date: string | null;
}

export interface TransferInput {
  to_personnel_id: number;
  reason: string;
}

export interface TransferBulkInput {
  protocol_ids: string[];
  to_personnel_id: number;
  reason: string;
}

// ---- Audit log (Roadmap item 11) ----

export const AUDIT_PROVENANCES = ["human", "ai", "system"] as const;
export type AuditProvenance = (typeof AUDIT_PROVENANCES)[number];

export interface AuditEntry {
  id: number;
  action: string;
  entity_type: string;
  entity_id: string | null;
  actor: string;
  actor_key: string | null;
  details: Record<string, unknown> | null;
  provenance: AuditProvenance;
  created_at: string;
}

export interface AuditQuery {
  entity_type?: string;
  entity_id?: string;
  actor?: string;
  action?: string;
  provenance?: AuditProvenance;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

// ---- AAALAC-style compliance reports (Roadmap item 9) ----

export interface RestraintBySpeciesRow {
  protocol_id: string;
  species: string | null;
  restraint_method: string | null;
}

export interface EuthanasiaBySpeciesRow {
  protocol_id: string;
  species: string | null;
  method: string;
  dose: string | null;
  route: string | null;
}

export interface SurgeryLocationRow {
  protocol_id: string;
  species: string | null;
  surgery_type: "Survival surgery" | "Non-survival surgery";
  location: string;
}

export interface MultipleMajorRecoverySurgeryRow {
  protocol_id: string;
  species: string | null;
  experiment: string;
  description: string | null;
}

export interface AnalgesicAnestheticDrugRow {
  protocol_id: string;
  species: string | null;
  reason_for_use: string | null;
  drug: string;
  dose: string | null;
  route: string | null;
}

export interface UseLocationBySpeciesRow {
  location: string;
  species: string | null;
  protocol_count: number;
  protocol_ids: string[];
}

export interface ReportsPayload {
  generated_at: string;
  reports: {
    restraint_by_species: RestraintBySpeciesRow[];
    euthanasia_by_species: EuthanasiaBySpeciesRow[];
    surgery_locations: SurgeryLocationRow[];
    multiple_major_recovery_surgery: MultipleMajorRecoverySurgeryRow[];
    analgesic_anesthetic_drugs: AnalgesicAnestheticDrugRow[];
    use_locations_by_species: UseLocationBySpeciesRow[];
  };
}

// ---- constants shared across the UI ----

export const PAIN_CATEGORIES = ["Category A", "Category B", "Category C", "Category D", "Category E"];

export const PROTOCOL_TYPES = ["Research", "Teaching", "Breeding", "Animal care / maintenance", "Other"];

export const STAGES = ["Draft", "Submitted", "Veterinary Review", "IACUC Review", "Approved", "Active"];

// ---- filter-builder (Roadmap item 8) ----
// Mirrors server/src/routes/filter.js: a clause is { field, op, value } and
// the allowed fields/operators are whitelisted server-side. The client keeps
// its own field-definition metadata for rendering the builder UI.

export type FilterOperator =
  | "eq"
  | "neq"
  | "contains"
  | "starts_with"
  | "ends_with"
  | "gt"
  | "gte"
  | "lt"
  | "lte";

export interface FilterClause {
  field: string;
  op: FilterOperator;
  value: string;
}

export interface SavedFilter {
  id: number;
  name: string;
  search_type: "protocol" | "register";
  filters: FilterClause[];
  created_at: string;
}

export interface FilterFieldDef {
  key: string;
  label: string;
  type: "text" | "number" | "date" | "enum";
  values?: string[];
}

// Text fields allow fuzzy operators; enums only eq/neq; numbers/dates add
// gt/gte/lt/lte — matching operatorsFor() in filter.js.
export const FILTER_OPERATORS: { key: FilterOperator; label: string }[] = [
  { key: "eq", label: "is" },
  { key: "neq", label: "is not" },
  { key: "contains", label: "contains" },
  { key: "starts_with", label: "starts with" },
  { key: "ends_with", label: "ends with" },
  { key: "gt", label: "> greater than" },
  { key: "gte", label: "≥ at least" },
  { key: "lt", label: "< less than" },
  { key: "lte", label: "≤ at most" },
];

export const TEXT_FILTER_OPERATORS: FilterOperator[] = ["eq", "neq", "contains", "starts_with", "ends_with"];
export const ENUM_FILTER_OPERATORS: FilterOperator[] = ["eq", "neq"];
export const NUMERIC_FILTER_OPERATORS: FilterOperator[] = ["eq", "neq", "gt", "gte", "lt", "lte"];

export function operatorsFor(def: FilterFieldDef): FilterOperator[] {
  if (def.type === "text") return TEXT_FILTER_OPERATORS;
  if (def.type === "enum") return ENUM_FILTER_OPERATORS;
  return NUMERIC_FILTER_OPERATORS;
}

// Client mirror of PROTOCOL_FILTER_FIELDS in server/src/routes/filter.js.
export const PROTOCOL_FILTER_FIELD_DEFS: FilterFieldDef[] = [
  { key: "id", label: "Protocol number", type: "text" },
  { key: "title", label: "Title", type: "text" },
  { key: "pi", label: "Principal investigator", type: "text" },
  { key: "species", label: "Species", type: "text" },
  { key: "status", label: "Status", type: "enum", values: STAGES },
  { key: "pain_category", label: "Pain category", type: "enum", values: PAIN_CATEGORIES },
  { key: "protocol_type", label: "Protocol type", type: "enum", values: PROTOCOL_TYPES },
  { key: "animals", label: "Animals", type: "number" },
  { key: "submitted", label: "Submitted date", type: "date" },
  { key: "expires", label: "Expiration date", type: "date" },
];

export function protocolFieldDef(key: string): FilterFieldDef | undefined {
  return PROTOCOL_FILTER_FIELD_DEFS.find(d => d.key === key);
}

// Client mirror of REGISTER_FILTER_FIELDS in server/src/routes/filter.js.
// The procedure enum mirrors the server's PROCEDURE_KEYS whitelist exactly, so
// a saved register filter can never fail server-side validation.
export const REGISTER_FILTER_FIELD_DEFS: FilterFieldDef[] = [
  { key: "protocol_id", label: "Protocol number", type: "text" },
  { key: "transaction_date", label: "Transaction date", type: "date" },
  { key: "species_strain", label: "Species / strain", type: "text" },
  { key: "pain_level", label: "Pain level", type: "enum", values: [...USDA_PAIN_LEVELS] },
  { key: "quantity", label: "Quantity", type: "number" },
  { key: "type", label: "Type", type: "enum", values: ["order", "use"] },
  { key: "procedure_key", label: "Procedure", type: "enum", values: [...PROCEDURE_KEYS] },
  { key: "notes", label: "Notes", type: "text" },
];

export function registerFieldDef(key: string): FilterFieldDef | undefined {
  return REGISTER_FILTER_FIELD_DEFS.find(d => d.key === key);
}
