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

export interface CommitteeProtocol extends CommitteeTally {
  id: string;
  title: string;
  pi: string;
  species: string | null;
  status: string;
}

export interface ProtocolVotesResponse extends Protocol, CommitteeTally {}

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

// ---- Appendix A application content ----

export interface Procedure {
  procedure_key: string;
  label: string;
  checked: boolean;
  description: string;
}

export interface ProcedureInput {
  procedure_key: string;
  checked: boolean;
  description: string;
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

export interface Alternatives {
  protocol_id: string;
  replacement_text: string | null;
  refinement_text: string | null;
  reduction_text: string | null;
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

// ---- constants shared across the UI ----

export const PAIN_CATEGORIES = ["Category A", "Category B", "Category C", "Category D", "Category E"];

export const PROTOCOL_TYPES = ["Research", "Teaching", "Breeding", "Animal care / maintenance", "Other"];

export const STAGES = ["Draft", "Submitted", "Veterinary Review", "IACUC Review", "Approved", "Active"];
