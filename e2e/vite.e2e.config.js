import { defineConfig } from "vite";
import baseConfig from "../client/vite.config.js";

// Dedicated dev server for Playwright e2e tests. Runs on a separate port and
// proxies /api to the e2e API server (4100) instead of the normal dev API
// (4000), so e2e runs never touch the developer's own database.
export default defineConfig({
  ...baseConfig,
  server: {
    ...baseConfig.server,
    port: 4173,
    proxy: {
      "/api": {
        target: "http://localhost:4100",
        changeOrigin: true,
      },
    },
  },
});
