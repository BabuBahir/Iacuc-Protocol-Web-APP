import { defineConfig } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  fullyParallel: false,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:4173",
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: "node seed-and-server.mjs",
      cwd: __dirname,
      url: "http://localhost:4100/api/health",
      timeout: 30_000,
      reuseExistingServer: false,
    },
    {
      command: "npm run dev:e2e --workspace=client",
      cwd: path.join(__dirname, ".."),
      url: "http://localhost:4173",
      timeout: 30_000,
      reuseExistingServer: false,
    },
  ],
});
