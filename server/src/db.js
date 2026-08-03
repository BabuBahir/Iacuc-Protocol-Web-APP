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
]) {
  if (!protocolColumns.has(col)) {
    db.exec(`ALTER TABLE protocols ADD COLUMN ${col} ${type}`);
  }
}

