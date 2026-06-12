/**
 * Entry point for the GamePilot management backend.
 *   npm run serve   (or: PORT=4321 tsx server/index.ts)
 *
 * Serves the REST API + the playable runtime. Build the client first
 * (`npm run build`) so dist/ exists.
 */

import { buildServer } from "./http";

const port = Number(process.env.PORT ?? 4321);
const host = process.env.HOST ?? "127.0.0.1";

const app = buildServer();
app
  .listen({ port, host })
  .then(() => {
    console.log(`GamePilot backend listening on http://${host}:${port}`);
    console.log(`  Sample:   http://localhost:${port}/`);
    console.log(`  API:      http://localhost:${port}/api/games`);
    console.log(`  Play:     http://localhost:${port}/play/<id>`);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
