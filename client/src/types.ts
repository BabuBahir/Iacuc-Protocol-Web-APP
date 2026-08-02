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

// ---- constants shared across the UI ----

export const PAIN_CATEGORIES = ["Category A", "Category B", "Category C", "Category D", "Category E"];

export const PROTOCOL_TYPES = ["Research", "Teaching", "Breeding", "Animal care / maintenance", "Other"];

export const STAGES = ["Draft", "Submitted", "Veterinary Review", "IACUC Review", "Approved", "Active"];
