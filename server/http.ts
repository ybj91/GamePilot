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
import type { GameplayCompiler } from "../src/ai/compiler";
import { MockCompiler } from "../src/ai/mockCompiler";
import { createAnthropicCompiler } from "../src/ai/anthropicCompiler";
import { buildMcpServer } from "./mcp";
import {
  saveGame,
  updateGame,
  getGame,
  listGames,
  deleteGame,
  InvalidSpecError,
} from "./store";

// The chat compiler: the real Claude compiler when a key is configured,
// otherwise the offline keyword mock. Same GameplayCompiler seam either way.
const apiKey = process.env.ANTHROPIC_API_KEY ?? "";
const compiler: GameplayCompiler = apiKey ? createAnthropicCompiler(apiKey) : new MockCompiler();

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

  // Update (validate + overwrite) an existing game in place. Same id/url.
  app.put<{ Params: { id: string }; Body: { spec?: GameSpec; idea?: string } }>(
    "/api/games/:id",
    async (req, reply) => {
      const spec = req.body?.spec;
      if (!spec) return reply.code(400).send({ error: "body.spec is required" });
      try {
        const game = await updateGame(req.params.id, spec, { idea: req.body?.idea });
        if (!game) return reply.code(404).send({ error: "not found" });
        return { ...game, url: `/play/${game.id}` };
      } catch (err) {
        if (err instanceof InvalidSpecError) {
          return reply.code(422).send({ error: err.message, errors: err.errors });
        }
        throw err;
      }
    },
  );

  // Conversational create/adjust: one chat turn -> a new or updated game.
  // No gameId -> create from the message; with a gameId -> adjust that game
  // (the current spec is passed as `base` so the compiler edits in place).
  app.post<{ Body: { message?: string; gameId?: string } }>("/api/chat", async (req, reply) => {
    const message = (req.body?.message ?? "").trim();
    if (!message) return reply.code(400).send({ error: "body.message is required" });
    const existing = req.body?.gameId ? await getGame(req.body.gameId) : null;
    try {
      const spec = await compiler.compile({ idea: message, base: existing?.spec });
      // On adjust, keep the original title stable across turns.
      if (existing) spec.meta = { ...spec.meta, title: existing.title };
      const game = existing
        ? await updateGame(existing.id, spec, { idea: message })
        : await saveGame(spec, { idea: message });
      if (!game) return reply.code(404).send({ reply: "That game no longer exists.", error: true });
      const verb = existing ? "Updated" : "Created";
      const offline = compiler.name === "mock" ? "  ·  offline assistant" : "";
      return {
        reply: `${verb} "${game.title}".${offline}`,
        game: { ...game, url: `/play/${game.id}` },
        offline: compiler.name === "mock",
      };
    } catch (err) {
      const msg = err instanceof InvalidSpecError ? err.message : (err as Error).message;
      return reply.code(200).send({ reply: `I couldn't do that — ${msg}`, error: true });
    }
  });

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
