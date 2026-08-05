import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // process.env.* is not available in the browser; esbuild replaces these
  // exact expressions with the literal value at build time so client code
  // can read the API base URL that was present during `vite build`.
  define: {
    "process.env.API_BASE_URL": JSON.stringify(process.env.API_BASE_URL || process.env.api_base_url || ""),
    "process.env.api_base_url": JSON.stringify(process.env.API_BASE_URL || process.env.api_base_url || ""),
  },
  server: {
    port: 5173,
    proxy: {
      // lets the client call fetch('/api/...') without hardcoding a host
      "/api": {
        target: process.env.API_BASE_URL || "http://localhost:4000",
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: "./src/test-setup.ts",
    globals: true,
    // ApplicationPage's heavy RTL tests (full renders + userEvent.type) can
    // exceed the 5s default under parallel-file CPU contention; 15s gives
    // headroom while still failing genuinely hung tests.
    testTimeout: 15000,
    coverage: {
      exclude: [
        "*.config.js",
        "src/main.tsx", // pure bootstrapping, no logic to test
        "node_modules/**",
        "dist/**",
      ],
    },
  },
});
