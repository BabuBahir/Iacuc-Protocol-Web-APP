// Table reset helper for isolation BETWEEN tests within the same file.
//
// Route test files get exactly one fresh app+db per file (Node's test
// runner isolates each test file into its own process by default, so a
// single top-level import per file is already isolated from other files).
// Within a file, call resetTables(db) in a beforeEach so individual
// test() blocks don't see each other's inserted rows.
//
// FK-safe order: children before parents.
const TABLES_IN_DELETE_ORDER = [
  "audit_log",
  "saved_filters",
  "protocol_votes",
  "protocol_review_comments",
  "protocol_review_assignments",
  "protocol_procedures",
  "protocol_drugs",
  "protocol_animal_use",
  "protocol_experiments",
  "protocol_rrr_entries",
  "protocol_alternatives",
  "animal_usage_transactions",
  "amendment_changes",
  "amendments",
  "protocol_versions",
  "renewals",
  "protocol_transfers",
  "incidents",
  "pam_audits",
  "inspection_deficiencies",
  "inspections",
  "facilities",
  "personnel_training",
  "personnel_ohsp",
  "related_items",
  "personnel",
  "roles",
  "species",
  "protocols",
];

export function resetTables(db) {
  for (const table of TABLES_IN_DELETE_ORDER) {
    db.exec(`DELETE FROM ${table}`);
  }
}

// Graduated access control (Roadmap item 4): privileged routes authorize the
// acting persona by name (X-Actor header / body.actor / body.personnel_id)
// against the personnel table. Test setup that seeds roles/personnel must do
// so directly via the DB — going through the HTTP API would itself require an
// office persona, which is exactly the chicken-and-egg the gate introduces.
//
// The conventional fixture is the IACUC Coordinator "Maya Patel" (also seeded
// in server/src/seed.js and baked into e2e storageState.json), so the same
// name works across unit and end-to-end suites.
export const OFFICE_ACTOR = "Maya Patel";
export const OFFICE_ROLE_NAME = "IACUC Coordinator";

// Insert a persona (role + personnel row) directly via the DB. Returns the
// personnel id. Reuses an existing role by name when one is present.
export function insertPersonnelDirect(db, { name, roleName, isCommittee = 0, email = null }) {
  let role = db.prepare("SELECT id FROM roles WHERE name = ?").get(roleName);
  if (!role) {
    db.prepare("INSERT INTO roles (name, is_committee) VALUES (?, ?)").run(roleName, isCommittee ? 1 : 0);
    role = db.prepare("SELECT id FROM roles WHERE name = ?").get(roleName);
  }
  const run = db.prepare("INSERT INTO personnel (name, email, role_id) VALUES (?, ?, ?)").run(name, email, role.id);
  return Number(run.lastInsertRowid);
}

// Seed the office persona used by privileged-route writes. Call after
// resetTables(db) so the persona survives for the whole test body.
export function seedOfficeActor(db) {
  return insertPersonnelDirect(db, { name: OFFICE_ACTOR, roleName: OFFICE_ROLE_NAME });
}
