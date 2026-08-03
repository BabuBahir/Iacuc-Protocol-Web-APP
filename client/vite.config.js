import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // lets the client call fetch('/api/...') without hardcoding a host
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: "./src/test-setup.ts",
    globals: true,
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
