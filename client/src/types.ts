// Shared client-side types mirroring the Express API response shapes
// (server/src/routes/protocols.js, admin.js, committee.js).

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
  research_steps: string[];
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
  research_steps: string[];
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
  research_steps: string[];
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

// Full procedure checklist keys (mirrors server PROCEDURE_KEYS), used to label
// usage-register transactions.
export const PROCEDURE_KEYS = [
  "breeding",
  "animal_id_methods",
  "anesthesia",
  "blood_collection",
  "injections",
  "experimental_substance_exposure",
  "non_pharma_grade_compounds",
  "prolonged_restraint_devices",
  "animal_pain_distress",
  "non_survival_surgery",
  "tissue_collection_after_euthanasia",
  "survival_surgery",
  "illness_disease_endpoint",
  "special_diets_food_water_restriction",
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

// ---- constants shared across the UI ----

export const PAIN_CATEGORIES = ["Category A", "Category B", "Category C", "Category D", "Category E"];

export const PROTOCOL_TYPES = ["Research", "Teaching", "Breeding", "Animal care / maintenance", "Other"];

export const STAGES = ["Draft", "Submitted", "Veterinary Review", "IACUC Review", "Approved", "Active"];
