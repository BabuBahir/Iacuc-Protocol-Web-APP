// Postgres test runner: runs the route test suite serially against a live
// Postgres/Supabase database (via DATABASE_URL). The SQLite-only tests —
// db.test.js, which exercises PRAGMA and the temp-file migration guard — are
// excluded; everything else goes through the same async db facade, so the
// same assertions validate both backends.
//
// Why serial: Node's test runner isolates each test FILE into its own process,
// and default concurrency runs those processes in parallel. Against one shared
// Postgres database the per-file resetTables() in beforeEach would race across
// files (one file's DELETE wiping rows another is asserting on). With
// --test-concurrency=1 files run back-to-back so each starts from a clean db.
//
//   usage:  set DATABASE_URL=postgres://... then:  npm run test:pg

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error("DATABASE_URL is not set. Point it at a live Supabase Postgres and retry.");
  console.error("  set DATABASE_URL=postgres://...; npm run test:pg");
  process.exit(1);
}

const serverDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const files = [
  "test/routes-admin.test.js",
  "test/routes-amendments.test.js",
  "test/routes-animal-usage.test.js",
  "test/routes-committee.test.js",
  "test/routes-compliance.test.js",
  "test/routes-docs.test.js",
  "test/routes-facilities.test.js",
  "test/routes-pam.test.js",
  "test/routes-protocol-form.test.js",
  "test/routes-protocols.test.js",
];

// --test-force-exit: each test file's process opens a pg Pool that is never
// closed, so idle keep-alive sockets keep the event loop alive and the file
// never exits. Without this, serial mode stalls on the first file forever.
const child = spawn(process.execPath, ["--test", "--test-concurrency=1", "--test-force-exit", ...files], {
  stdio: "inherit",
  cwd: serverDir,
});
child.on("exit", (code) => process.exit(code ?? 1));
