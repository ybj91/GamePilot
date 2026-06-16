import { defineConfig } from "vite";

/**
 * Client build + dev server. The full app (REST API, /api/chat, MCP, the
 * playable host) runs from the standalone Fastify backend (`npm start`).
 *
 * For client iteration, `npm run dev` serves the UI with HMR and proxies API
 * calls to the backend — so run `npm run serve` alongside it. The canonical
 * "everything in one process" command is still `npm start`.
 */
export default defineConfig({
  root: ".",
  server: {
    proxy: {
      "/api": "http://localhost:4321",
    },
  },
  build: {
    target: "es2022",
    outDir: "dist",
  },
});
