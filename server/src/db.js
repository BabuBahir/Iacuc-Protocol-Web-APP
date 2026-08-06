import { DatabaseSync } from "node:sqlite";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

// Uses Node's built-in SQLite module (stable/experimental in Node 22.5+,
// no native compilation required — this avoids the better-sqlite3 build
// issues that show up on Windows with newer Node versions or missing
// build tools). Requires Node 22.5 or newer.
//
// Swap this file for a Postgres client (e.g. `pg`) if you outgrow SQLite —
// the routes/ files only call the exported `db` helpers below, so the
// rest of the app doesn't need to change.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "..", "data");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const dbPath =
  process.env.DB_PATH === ":memory:"
    ? ":memory:"
    : process.env.DB_PATH
    ? path.resolve(process.cwd(), process.env.DB_PATH)
    : path.join(dataDir, "iacuc.db");

export const db = new DatabaseSync(dbPath);
db.exec("PRAGMA foreign_keys = ON;");

// Explicitly close the connection. Needed by tests that create a temp-file
// database and want to delete it afterwards (Windows keeps the file locked
// until the connection is closed).
export function closeDb() {
  db.close();
}

db.exec(`
CREATE TABLE IF NOT EXISTS protocols (
  id                    TEXT PRIMARY KEY,
  title                 TEXT NOT NULL,
  pi                    TEXT NOT NULL,
  species               TEXT,
  status                TEXT NOT NULL DEFAULT 'Draft',
  animals               INTEGER,
  pain_category         TEXT,
  submitted             TEXT,
  expires               TEXT,
  purpose_summary       TEXT, -- lay-language purpose / intent of the study
  harm_benefit_analysis TEXT, -- 2-3 sentence harm vs. benefit comparison
  scientific_summary    TEXT, -- scientific-language project summary + aims
  created_at            TEXT DEFAULT (datetime('now')),
  updated_at            TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS related_items (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  protocol_id TEXT NOT NULL REFERENCES protocols(id) ON DELETE CASCADE,
  list_name   TEXT NOT NULL,   -- 'Personnel' | 'Amendments' | 'Approval history' | 'Attachments'
  label       TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_related_items_protocol ON related_items(protocol_id);

-- ---- admin: lookup lists ----

CREATE TABLE IF NOT EXISTS species (
  id   INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS roles (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL UNIQUE,
  is_committee  INTEGER NOT NULL DEFAULT 0  -- 1 if this role can cast FCR votes
);

-- ---- personnel: the actual people/personas (a vet, a committee member, etc) ----

CREATE TABLE IF NOT EXISTS personnel (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  email      TEXT,
  role_id    INTEGER NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Personnel compliance (Domain C): CITI-style training records and OHSP
-- (Occupational Health & Safety Program) clearance per person. personnel_ohsp
-- is one row per person (upserted); personnel_training is a 1:N list.
CREATE TABLE IF NOT EXISTS personnel_training (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  personnel_id   INTEGER NOT NULL REFERENCES personnel(id) ON DELETE CASCADE,
  course         TEXT NOT NULL,
  completed_date TEXT NOT NULL,
  expires_date   TEXT,
  created_at     TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS personnel_ohsp (
  personnel_id  INTEGER PRIMARY KEY REFERENCES personnel(id) ON DELETE CASCADE,
  status        TEXT NOT NULL DEFAULT 'Pending', -- 'Pending' | 'Cleared' | 'Denied'
  reviewed_date TEXT,
  notes         TEXT,
  updated_at    TEXT DEFAULT (datetime('now'))
);

-- ---- committee: Full Committee Review (FCR) votes on a protocol ----

CREATE TABLE IF NOT EXISTS protocol_votes (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  protocol_id  TEXT NOT NULL REFERENCES protocols(id) ON DELETE CASCADE,
  personnel_id INTEGER NOT NULL REFERENCES personnel(id) ON DELETE CASCADE,
  vote         TEXT NOT NULL, -- 'Approve' | 'Request Modifications' | 'Table' | 'Withhold Approval'
  comment      TEXT,
  voted_at     TEXT DEFAULT (datetime('now')),
  UNIQUE(protocol_id, personnel_id) -- one vote per person per protocol; re-voting updates it
);

-- Reviewer assignments: who is assigned to review a protocol (a designated
-- member for DMR, or primary/secondary reviewers for FCR). Distinct from
-- votes — an assigned reviewer may or may not have voted yet.
CREATE TABLE IF NOT EXISTS protocol_review_assignments (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  protocol_id  TEXT NOT NULL REFERENCES protocols(id) ON DELETE CASCADE,
  personnel_id INTEGER NOT NULL REFERENCES personnel(id) ON DELETE CASCADE,
  role         TEXT NOT NULL, -- 'Primary Reviewer' | 'Secondary Reviewer' | 'Designated Member'
  assigned_at  TEXT DEFAULT (datetime('now')),
  UNIQUE(protocol_id, personnel_id)
);

-- Section-specific review comments (inline feedback on a protocol section,
-- distinct from the single free-text comment attached to a vote).
CREATE TABLE IF NOT EXISTS protocol_review_comments (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  protocol_id  TEXT NOT NULL REFERENCES protocols(id) ON DELETE CASCADE,
  personnel_id INTEGER NOT NULL REFERENCES personnel(id) ON DELETE CASCADE,
  section      TEXT NOT NULL, -- 'overall' | 'summaries' | 'procedures' | 'drugs' | 'animal_use' | 'experiments' | 'alternatives'
  comment      TEXT NOT NULL,
  created_at   TEXT DEFAULT (datetime('now'))
);
-- ---- protocol application content (mirrors Appendix A research form) ----

-- Procedures checklist: each protocol gets one row per PROCEDURE_KEYS entry
-- (see routes/protocol-form.js), created on first access.
CREATE TABLE IF NOT EXISTS protocol_procedures (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  protocol_id   TEXT NOT NULL REFERENCES protocols(id) ON DELETE CASCADE,
  procedure_key TEXT NOT NULL,
  checked       INTEGER NOT NULL DEFAULT 0,
  description   TEXT,
  UNIQUE(protocol_id, procedure_key)
);

-- Drug / dosing table: anesthesia, analgesia, euthanasia agents
CREATE TABLE IF NOT EXISTS protocol_drugs (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  protocol_id    TEXT NOT NULL REFERENCES protocols(id) ON DELETE CASCADE,
  reason_for_use TEXT,
  drug           TEXT NOT NULL,
  dose           TEXT,
  route          TEXT,
  duration       TEXT
);

-- Animal use table: species/strain, sex, age, max count used
CREATE TABLE IF NOT EXISTS protocol_animal_use (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  protocol_id   TEXT NOT NULL REFERENCES protocols(id) ON DELETE CASCADE,
  species_strain TEXT NOT NULL,
  sex           TEXT,
  approx_age    TEXT,
  max_count     INTEGER
);

-- Experiments: each protocol can describe multiple distinct experiments
-- (per the RAP cheat-sheet's Experiments tab / Appendix A narrative).
CREATE TABLE IF NOT EXISTS protocol_experiments (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  protocol_id   TEXT NOT NULL REFERENCES protocols(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  description   TEXT,                       -- detailed description of the experiment
  multiple_surgical_events INTEGER NOT NULL DEFAULT 0, -- surgery performed more than once on one animal
  humane_endpoints TEXT,                    -- endpoint criteria, incl. signs triggering euthanasia
  persistent_clinical_signs_justification TEXT, -- required when clinical signs are allowed to persist (Cat E)
  monitoring_plan TEXT,                     -- adverse effects expected, how/when monitored, when to call LAMS
  husbandry_exceptions TEXT                 -- deviations from standard practices (single housing, medicated water, etc.)
);

-- 3 Rs / alternatives search: one row per protocol
CREATE TABLE IF NOT EXISTS protocol_alternatives (
  protocol_id      TEXT PRIMARY KEY REFERENCES protocols(id) ON DELETE CASCADE,
  replacement_text TEXT,
  refinement_text  TEXT,
  reduction_text   TEXT,
  lit_databases    TEXT, -- e.g. "PubMed, AGRICOLA"
  lit_years_from   TEXT,
  lit_years_to     TEXT,
  lit_search_date  TEXT,
  lit_keywords     TEXT,
  lit_summary      TEXT,
  colleague_name   TEXT,
  colleague_date   TEXT,
  colleague_notes  TEXT,
  av_consult_date  TEXT -- Attending Veterinarian consultation date (required for Category D/E)
);

-- Structured 3 Rs justifications: one or more per type per protocol
-- (method + explanation) instead of one free-text blob per R. The
-- replacement/refinement/reduction_text columns above are retained for
-- backward compatibility but are no longer read or written by the API.
CREATE TABLE IF NOT EXISTS protocol_rrr_entries (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  protocol_id TEXT NOT NULL REFERENCES protocols(id) ON DELETE CASCADE,
  rrr_type    TEXT NOT NULL CHECK (rrr_type IN ('replacement', 'refinement', 'reduction')),
  method      TEXT NOT NULL, -- the strategy/approach taken
  explanation TEXT           -- why it applies to this protocol
);

-- Animal usage register (AGENTS.md §1.4): a ledger of *actual* ordering/usage
-- transactions against a protocol's approved allowance. The approved allowance
-- is the sum of protocol_animal_use.max_count per species; these rows are the
-- actual orders/uses (the two stay distinct by design).
CREATE TABLE IF NOT EXISTS animal_usage_transactions (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  protocol_id      TEXT NOT NULL REFERENCES protocols(id) ON DELETE CASCADE,
  transaction_date TEXT NOT NULL,
  species_strain   TEXT NOT NULL,
  pain_level       TEXT,             -- USDA pain category: B, C, D, E
  quantity         INTEGER NOT NULL CHECK (quantity > 0),
  type             TEXT NOT NULL DEFAULT 'use', -- 'order' | 'use'
  procedure_key    TEXT,             -- optional PROCEDURE_KEYS entry
  notes            TEXT,
  created_at       TEXT DEFAULT (datetime('now'))
);

-- ---- Domain F: facilities & semi-annual inspections ----
--
-- Three standalone tables with no protocol dependency. Facilities are the
-- physical spaces (housing rooms / labs / surgical suites) inspected every
-- six months; the semi-annual cadence is a computation, not stored state.

CREATE TABLE IF NOT EXISTS facilities (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  type       TEXT NOT NULL, -- 'Housing Room' | 'Lab' | 'Surgical Suite'
  species    TEXT,          -- species housed/used there (comma-separated)
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS inspections (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  facility_id     INTEGER NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  inspection_date TEXT NOT NULL,
  report          TEXT,
  result          TEXT NOT NULL DEFAULT 'Pending', -- 'Pending' | 'Pass' | 'Fail' | 'Re-inspection required'
  created_at      TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS inspection_deficiencies (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  inspection_id        INTEGER NOT NULL REFERENCES inspections(id) ON DELETE CASCADE,
  severity             TEXT NOT NULL, -- 'Minor' | 'Major'
  description          TEXT NOT NULL,
  remediation_deadline TEXT,
  remediated_at        TEXT
);

-- ---- Domain E: Post-Approval Monitoring (PAM) & incident reporting ----
--
-- Incidents: adverse events / deviations with an Open → CAPA → Closed
-- lifecycle. reported_by/assigned_to are personnel FKs so RBAC can be
-- layered on later without a migration (AGENTS.md §1.5).

CREATE TABLE IF NOT EXISTS incidents (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  protocol_id       TEXT REFERENCES protocols(id) ON DELETE CASCADE,
  type              TEXT NOT NULL, -- 'Adverse Event' | 'Deviation' | 'Noncompliance' | 'Unanticipated Problem'
  description       TEXT NOT NULL,
  severity          TEXT NOT NULL DEFAULT 'Minor', -- 'Minor' | 'Major' | 'Immediate'
  status            TEXT NOT NULL DEFAULT 'Open',  -- 'Open' | 'CAPA' | 'Closed'
  corrective_action TEXT, -- the CAPA plan
  closed_at         TEXT,
  reported_by       INTEGER REFERENCES personnel(id) ON DELETE SET NULL,
  assigned_to       INTEGER REFERENCES personnel(id) ON DELETE SET NULL,
  created_at        TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS pam_audits (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  protocol_id TEXT NOT NULL REFERENCES protocols(id) ON DELETE CASCADE,
  audit_date  TEXT NOT NULL,
  auditor_id  INTEGER REFERENCES personnel(id) ON DELETE SET NULL,
  site_visits TEXT,
  findings    TEXT,
  report      TEXT,
  created_at  TEXT DEFAULT (datetime('now'))
);

-- ---- Domain B: amendments & annual renewals ----
--
-- Amendments are versioned documents (AGENTS.md §1.1): one in-flight per
-- protocol, requires a "Reason for Change", and approved amendments produce
-- a new protocol version with its own approval/expiration dates. Continuing
-- Review (lightweight annual check-in) ≠ De Novo Review (full 3-year
-- resubmission referencing the prior protocol number).

CREATE TABLE IF NOT EXISTS amendments (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  protocol_id TEXT NOT NULL REFERENCES protocols(id) ON DELETE CASCADE,
  reason      TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'Pending', -- 'Pending' | 'Approved' | 'Rejected'
  created_at  TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS amendment_changes (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  amendment_id   INTEGER NOT NULL REFERENCES amendments(id) ON DELETE CASCADE,
  section        TEXT NOT NULL, -- 'summaries' | 'procedures' | 'drugs' | 'animal_use' | 'experiments' | 'alternatives' | 'research_plan'
  field          TEXT NOT NULL,
  previous_value TEXT,
  new_value      TEXT,
  created_at     TEXT DEFAULT (datetime('now'))
);

-- Version lineage (0001, 0002, ...), each with its own approval/expiration
-- dates. Source: New Document / Amendment Document / De Novo Document.
CREATE TABLE IF NOT EXISTS protocol_versions (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  protocol_id     TEXT NOT NULL REFERENCES protocols(id) ON DELETE CASCADE,
  version_number  TEXT NOT NULL, -- '0001', '0002', ...
  source          TEXT NOT NULL, -- 'New Document' | 'Amendment Document' | 'De Novo Document'
  approved_date   TEXT,
  expiration_date TEXT,
  version_date    TEXT DEFAULT (datetime('now')),
  UNIQUE(protocol_id, version_number)
);

CREATE TABLE IF NOT EXISTS renewals (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  protocol_id    TEXT NOT NULL REFERENCES protocols(id) ON DELETE CASCADE,
  type           TEXT NOT NULL, -- 'Continuing Review' | 'De Novo Review'
  status         TEXT NOT NULL DEFAULT 'Pending', -- 'Pending' | 'Approved' | 'Rejected'
  submitted_date TEXT DEFAULT (datetime('now')),
  decision_date  TEXT,
  approved_until TEXT, -- new expiration date when approved
  created_at     TEXT DEFAULT (datetime('now'))
);

-- Transfer Ownership (AGENTS.md §1.1): its own approval workflow. A request
-- sits Pending in the transfer queue until the IACUC office approves it, and
-- requires a reason. Approval reassigns the protocol's PI (protocols.pi + the
-- related_items 'Personnel' label). from_pi is a snapshot of protocols.pi at
-- request time. One pending request per protocol at a time (query-enforced).
CREATE TABLE IF NOT EXISTS protocol_transfers (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  protocol_id     TEXT NOT NULL REFERENCES protocols(id) ON DELETE CASCADE,
  from_pi         TEXT NOT NULL,
  to_personnel_id INTEGER NOT NULL REFERENCES personnel(id) ON DELETE RESTRICT,
  reason          TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'Pending', -- 'Pending' | 'Approved' | 'Rejected'
  created_at      TEXT DEFAULT (datetime('now')),
  decision_date   TEXT
);

CREATE INDEX IF NOT EXISTS idx_protocol_transfers_protocol ON protocol_transfers(protocol_id);

-- ---- audit trail (Roadmap item 11) ----
--
-- Append-only log of every successful mutation across the app: what changed,
-- when, and a best-effort "who". actor is a human-readable name; actor_key is
-- reserved for the auth identity that Roadmap item 4 will slot in without a
-- migration (deliberately NOT an FK to personnel, so audit rows survive the
-- person being deleted). provenance marks AI-generated changes (AGENTS.md
-- §3.2) so they can't be confused with human-entered data. details is a JSON
-- snapshot (e.g. { status: ["IACUC Review", "Approved"] }).
CREATE TABLE IF NOT EXISTS audit_log (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  action       TEXT NOT NULL,               -- 'protocol.created' | 'vote.cast' | 'transfer.approved' ...
  entity_type  TEXT NOT NULL,               -- 'protocol' | 'vote' | 'transfer' | 'species' | ...
  entity_id    TEXT,                        -- protocol id (TEXT) or numeric row id
  actor        TEXT NOT NULL DEFAULT 'system', -- best-effort human-readable name
  actor_key    TEXT,                        -- reserved: auth identity (Roadmap item 4)
  details      TEXT,                        -- JSON snapshot of what changed
  provenance   TEXT NOT NULL DEFAULT 'human' CHECK (provenance IN ('human', 'ai', 'system')),
  created_at   TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_audit_log_entity  ON audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor   ON audit_log(actor);
`);

// ---- lightweight migration for databases created before these columns existed ----
const protocolColumns = new Set(
  db.prepare("PRAGMA table_info(protocols)").all().map(c => c.name)
);
for (const [col, type] of [
  ["purpose_summary", "TEXT"],
  ["harm_benefit_analysis", "TEXT"],
  ["scientific_summary", "TEXT"],
  ["pi_proxy", "TEXT"],
  ["ptm_member", "TEXT"],
  ["protocol_type", "TEXT"],
  ["anesthesia_required", "INTEGER"],
  ["housing", "TEXT"],
  ["disposal", "TEXT"],
  ["npg", "TEXT"],
  ["research_steps", "TEXT"],
  ["review_method", "TEXT"], // 'FCR' (full committee) | 'DMR' (designated member)
]) {
  if (!protocolColumns.has(col)) {
    db.exec(`ALTER TABLE protocols ADD COLUMN ${col} ${type}`);
  }
}

// ---- migration for databases created before the procedure surgery-detail columns existed ----
const procedureColumns = new Set(
  db.prepare("PRAGMA table_info(protocol_procedures)").all().map(c => c.name)
);
for (const [col, type] of [
  ["surgical_description", "TEXT"],
  ["aseptic_preparation", "TEXT"],
  ["analgesia_level", "TEXT"],
  ["postop_care", "TEXT"],
]) {
  if (!procedureColumns.has(col)) {
    db.exec(`ALTER TABLE protocol_procedures ADD COLUMN ${col} ${type}`);
  }
}

