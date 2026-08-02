// Playwright webServer entrypoint for the API.
//
// Seeds a throwaway database (deleted on every run) and then serves the API
// on port 4100. The normal dev servers run on 4000/5173 against the
// developer's real DB; e2e uses its own ports and its own DB so tests never
// pollute real data and are idempotent.
//
// This process must not exit — Playwright kills it when the run finishes.

import fs from "node:fs";
import { fileURLToPath } from "node:url";

const e2eDbPath = fileURLToPath(new URL("./e2e.db", import.meta.url));

process.env.DB_PATH = e2eDbPath;
process.env.PORT = "4100";

for (const file of [e2eDbPath, `${e2eDbPath}-wal`, `${e2eDbPath}-shm`]) {
  fs.rmSync(file, { force: true });
}

await import("../server/src/seed.js");
await import("../server/src/index.js");
