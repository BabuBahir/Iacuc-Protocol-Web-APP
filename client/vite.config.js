import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // lets the client call fetch('/api/...') without hardcoding a host
      "/api": {
        target: "https://iacuc-protocol-web-app.onrender.com",
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
