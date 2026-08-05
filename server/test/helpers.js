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
