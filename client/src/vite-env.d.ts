/// <reference types="vite/client" />

// The Vite `define` block in vite.config.js statically replaces
// process.env.API_BASE_URL / process.env.api_base_url at build time, so
// browser code can reference them without a Node runtime. This declaration
// keeps `tsc --noEmit` happy in the strict-mode client.
declare const process: {
  env: Record<string, string | undefined>;
};
