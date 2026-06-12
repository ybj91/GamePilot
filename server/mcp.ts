/**
 * GamePilot MCP server (stage 2).
 *
 * Exposes game authoring as MCP tools so any MCP-capable agent (the user's own
 * Claude Code / Desktop / etc. — no API key needed) can turn an idea into a
 * playable game. The agent emits a GameSpec (data, never code); these tools
 * validate it (the same validateGameSpec guard), persist it via the shared
 * store, and hand back a play URL served by the HTTP backend.
 *
 * Transports live in mcp-stdio.ts (stdio) and server/http.ts (Streamable HTTP).
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { GameSpec } from "../src/dsl/types";
import { validateGameSpec } from "../src/dsl/validate";
import { dslReferenceWithExample } from "../src/dsl/reference";
import { saveGame, getGame, listGames, deleteGame, InvalidSpecError } from "./store";

/** Where the HTTP backend serves playable games (for building play URLs). */
const BASE_URL = (process.env.GAMEPILOT_BASE_URL ?? "http://localhost:4321").replace(/\/$/, "");

// A GameSpec is a nested object; validateGameSpec does the real checking, so we
// accept any object here and report precise errors back to the agent as text.
const specSchema = z.record(z.string(), z.unknown());

function text(obj: unknown) {
  return { content: [{ type: "text" as const, text: typeof obj === "string" ? obj : JSON.stringify(obj, null, 2) }] };
}
function errorText(message: string) {
  return { content: [{ type: "text" as const, text: message }], isError: true };
}

export function buildMcpServer(): McpServer {
  const server = new McpServer({ name: "gamepilot", version: "0.1.0" });

  server.registerTool(
    "get_dsl_reference",
    {
      title: "GamePilot DSL reference",
      description:
        "Returns the GameSpec DSL contract plus a complete worked example. Read this first, then construct a GameSpec and pass it to validate_game / create_game.",
      inputSchema: {},
    },
    async () => text(dslReferenceWithExample()),
  );

  server.registerTool(
    "validate_game",
    {
      title: "Validate a GameSpec",
      description:
        "Check a GameSpec against the DSL without saving it. Returns { ok, errors }. Use this to verify your spec before create_game.",
      inputSchema: { spec: specSchema },
    },
    async ({ spec }) => text(validateGameSpec(spec as unknown as GameSpec)),
  );

  server.registerTool(
    "create_game",
    {
      title: "Create a playable game",
      description:
        "Validate and save a GameSpec, returning its id and a play_url you can give the user to play it in a browser. Fails (isError) with the validation errors if the spec is invalid.",
      inputSchema: {
        spec: specSchema,
        idea: z.string().optional().describe("the natural-language idea this game came from"),
      },
    },
    async ({ spec, idea }) => {
      try {
        const game = await saveGame(spec as unknown as GameSpec, { idea });
        return text({ id: game.id, title: game.title, play_url: `${BASE_URL}/play/${game.id}` });
      } catch (err) {
        if (err instanceof InvalidSpecError) return errorText(err.message);
        throw err;
      }
    },
  );

  server.registerTool(
    "list_games",
    {
      title: "List saved games",
      description: "List all saved games (id, title, idea, createdAt), newest first.",
      inputSchema: {},
    },
    async () => text({ games: await listGames() }),
  );

  server.registerTool(
    "get_game",
    {
      title: "Get a saved game",
      description: "Fetch a saved game by id, including its full GameSpec.",
      inputSchema: { id: z.string() },
    },
    async ({ id }) => {
      const game = await getGame(id);
      return game ? text(game) : errorText(`No game with id "${id}".`);
    },
  );

  server.registerTool(
    "delete_game",
    {
      title: "Delete a saved game",
      description: "Delete a saved game by id.",
      inputSchema: { id: z.string() },
    },
    async ({ id }) => {
      const ok = await deleteGame(id);
      return ok ? text({ deleted: id }) : errorText(`No game with id "${id}".`);
    },
  );

  return server;
}
