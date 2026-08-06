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

export async function resetTables(db) {
  // Postgres: one round trip instead of 26 sequential DELETEs — each round
  // trip to a remote DB costs ~150ms of latency, and resetTables runs on
  // every test, so the loop version made the PG suite take ~15 minutes.
  // TRUNCATE ... RESTART IDENTITY resets serials; CASCADE clears any table
  // that references the listed ones (all tables are listed, so it's just
  // insurance against ordering mistakes).
  if (db.dialect === "postgres") {
    await db.run(`TRUNCATE TABLE ${TABLES_IN_DELETE_ORDER.join(", ")} RESTART IDENTITY CASCADE`);
    return;
  }
  for (const table of TABLES_IN_DELETE_ORDER) {
    await db.run(`DELETE FROM ${table}`);
  }
}
