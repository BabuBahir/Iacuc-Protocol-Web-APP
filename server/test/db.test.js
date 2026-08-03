import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

describe("db.js schema", () => {
  test("creates all expected tables on a fresh in-memory database", async () => {
    process.env.DB_PATH = ":memory:";
    const { db } = await import(`../src/db.js?fresh=${Date.now()}-${Math.random()}`);

    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .all()
      .map((t) => t.name);

    for (const expected of [
      "protocols",
      "related_items",
      "species",
      "roles",
      "personnel",
      "protocol_votes",
      "protocol_review_assignments",
      "protocol_review_comments",
      "protocol_procedures",
      "protocol_drugs",
      "protocol_animal_use",
      "protocol_experiments",
      "protocol_rrr_entries",
      "protocol_alternatives",
      "animal_usage_transactions",
    ]) {
      assert.ok(tables.includes(expected), `expected table "${expected}" to exist`);
    }
  });

  test("PRAGMA foreign_keys is enabled", async () => {
    process.env.DB_PATH = ":memory:";
    const { db } = await import(`../src/db.js?fresh=${Date.now()}-${Math.random()}`);
    const result = db.prepare("PRAGMA foreign_keys").get();
    assert.equal(result.foreign_keys, 1);
  });

  test("migration guard adds new protocol columns to a pre-existing database without touching data", async () => {
    // Simulate a database created before purpose_summary / harm_benefit_analysis /
    // scientific_summary existed, the same scenario hand-verified during development.
    const tmpFile = path.join(os.tmpdir(), `iacuc-migration-test-${Date.now()}.db`);

    const legacyDb = new DatabaseSync(tmpFile);
    legacyDb.exec(`
      CREATE TABLE protocols (
        id TEXT PRIMARY KEY, title TEXT NOT NULL, pi TEXT NOT NULL, species TEXT,
        status TEXT NOT NULL DEFAULT 'Draft', animals INTEGER, pain_category TEXT,
        submitted TEXT, expires TEXT, created_at TEXT, updated_at TEXT
      )
    `);
    legacyDb.prepare(
      "INSERT INTO protocols (id, title, pi) VALUES ('LEGACY-1', 'legacy protocol', 'Dr. Legacy')"
    ).run();
    legacyDb.close();

    process.env.DB_PATH = tmpFile;
    const { db, closeDb } = await import(`../src/db.js?fresh=${Date.now()}-${Math.random()}`);

    const columns = db.prepare("PRAGMA table_info(protocols)").all().map((c) => c.name);
    for (const col of ["purpose_summary", "harm_benefit_analysis", "scientific_summary", "review_method"]) {
      assert.ok(columns.includes(col), `expected migrated column "${col}"`);
    }

    const row = db.prepare("SELECT * FROM protocols WHERE id = ?").get("LEGACY-1");
    assert.equal(row.title, "legacy protocol");
    assert.equal(row.purpose_summary, null);

    // Release the file handle before deletion — on Windows the open SQLite
    // connection keeps the temp db locked, so rmSync fails with EPERM.
    closeDb();
    for (const file of [tmpFile, `${tmpFile}-wal`, `${tmpFile}-shm`]) {
      // Retry briefly: the OS may not release the lock instantly.
      for (let attempt = 0; attempt < 10; attempt++) {
        try {
          fs.rmSync(file, { force: true });
          break;
        } catch (err) {
          if (attempt === 9) throw err;
          Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 20);
        }
      }
    }
  });
});
