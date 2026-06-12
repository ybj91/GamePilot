/**
 * GamePilot management backend (stage 1).
 *
 * A standalone Fastify server that:
 *   - exposes a REST API to validate, create, list, fetch, and delete games
 *     (the GameSpec store is the source of truth), and
 *   - serves the built browser runtime so a saved game is playable at
 *     /play/:id.
 *
 * It runs independently of Vite so the MCP server (stage 2) and an agent
 * (stage 4) can drive it as a separate process. The API key is irrelevant here
 * — the intelligence lives in whatever agent calls these endpoints; this server
 * just validates, stores, and hosts the data.
 */

import Fastify, { type FastifyInstance } from "fastify";
import fastifyStatic from "@fastify/static";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import path from "node:path";
import { readFileSync } from "node:fs";
import type { GameSpec } from "../src/dsl/types";
import { validateGameSpec } from "../src/dsl/validate";
import { buildMcpServer } from "./mcp";
import {
  saveGame,
  getGame,
  listGames,
  deleteGame,
  InvalidSpecError,
} from "./store";

const DIST = path.resolve(process.cwd(), "dist");

export function buildServer(): FastifyInstance {
  const app = Fastify({ logger: { transport: undefined } });

  // --- REST API -----------------------------------------------------------

  // Validate a spec without saving (handy for an agent to check its work).
  app.post<{ Body: { spec?: GameSpec } }>("/api/validate", async (req, reply) => {
    const spec = req.body?.spec;
    if (!spec) return reply.code(400).send({ error: "body.spec is required" });
    return validateGameSpec(spec);
  });

  // Create (validate + persist) a game. Returns id + playable url.
  app.post<{ Body: { spec?: GameSpec; idea?: string } }>(
    "/api/games",
    async (req, reply) => {
      const spec = req.body?.spec;
      if (!spec) return reply.code(400).send({ error: "body.spec is required" });
      try {
        const game = await saveGame(spec, { idea: req.body?.idea });
        return reply.code(201).send({ ...game, url: `/play/${game.id}` });
      } catch (err) {
        if (err instanceof InvalidSpecError) {
          return reply.code(422).send({ error: err.message, errors: err.errors });
        }
        throw err;
      }
    },
  );

  app.get("/api/games", async () => ({ games: await listGames() }));

  app.get<{ Params: { id: string } }>("/api/games/:id", async (req, reply) => {
    const game = await getGame(req.params.id);
    if (!game) return reply.code(404).send({ error: "not found" });
    return game;
  });

  app.delete<{ Params: { id: string } }>("/api/games/:id", async (req, reply) => {
    const ok = await deleteGame(req.params.id);
    return reply.code(ok ? 200 : 404).send({ ok });
  });

  // --- MCP over Streamable HTTP -------------------------------------------

  // Stateless: a fresh McpServer + transport per request (no session id).
  // We hijack the reply so the transport owns the raw Node response, and pass
  // Fastify's already-parsed JSON body as parsedBody.
  app.post("/mcp", async (req, reply) => {
    reply.hijack();
    const mcp = buildMcpServer();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    reply.raw.on("close", () => {
      void transport.close();
      void mcp.close();
    });
    try {
      await mcp.connect(transport);
      await transport.handleRequest(req.raw, reply.raw, req.body);
    } catch (err) {
      app.log.error(err);
      if (!reply.raw.headersSent) {
        reply.raw.writeHead(500, { "content-type": "application/json" });
        reply.raw.end(JSON.stringify({ error: "MCP request failed" }));
      }
    }
  });

  // Stateless mode has no server-initiated streams or sessions to resume.
  const noStream = (_req: unknown, reply: { code: (n: number) => { send: (b: unknown) => unknown } }) =>
    reply.code(405).send({ error: "Method Not Allowed (stateless MCP: use POST)" });
  app.get("/mcp", noStream);
  app.delete("/mcp", noStream);

  // --- Playable runtime ----------------------------------------------------

  // Serve a saved game's playable page. The client reads the id from the path
  // and fetches /api/games/:id. We hand back the built index.html for any
  // /play/:id so deep links work.
  app.get("/play/:id", async (_req, reply) => {
    try {
      const html = readFileSync(path.join(DIST, "index.html"), "utf8");
      return reply.type("text/html").send(html);
    } catch {
      return reply
        .code(503)
        .type("text/plain")
        .send("Client not built. Run `npm run build` first.");
    }
  });

  // Static assets + the landing page (the sample) at /.
  app.register(fastifyStatic, { root: DIST, prefix: "/" });

  return app;
}
