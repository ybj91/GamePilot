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
import { coreReference, capability, CAPABILITIES } from "../src/dsl/reference";
import { saveGame, updateGame, getGame, listGames, deleteGame, InvalidSpecError } from "./store";

/** How to drive game design as a conversation, surfaced via get_dsl_reference. */
const WORKFLOW = `Designing a game is ITERATIVE — don't try to nail it in one spec. Work in a loop:
1. Start small: create_game with a minimal but PLAYABLE skeleton (a player, one goal, a win/lose). Give the user the play_url.
2. The user plays and gives feedback ("too hard", "add a dash", "enemies should flee").
3. Refine: get_game(id) to read the current spec, change ONE thing, then update_game(id, newSpec). The id and play_url stay the same and the open browser tab hot-reloads automatically — so the user sees each change live.
4. Repeat. Tune specific numbers (speed, count, size, win threshold) rather than rewriting the whole game.`;

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
        "Returns the CORE GameSpec DSL + a worked example + the iterative design workflow, plus a menu of extension capabilities. Call again with a `capability` id to load just that slice (e.g. \"obstacles\", \"shooting\", \"variables\", \"spawn-areas\") when your game needs it. Read this before authoring or editing.",
      inputSchema: {
        capability: z
          .string()
          .optional()
          .describe("load one capability slice instead of the core (e.g. 'obstacles', 'shooting')"),
      },
    },
    async ({ capability: capId }) => {
      if (capId) {
        const cap = capability(capId);
        if (!cap) {
          return errorText(`Unknown capability "${capId}". Available: ${CAPABILITIES.map((c) => c.id).join(", ")}.`);
        }
        return text(`--- ${cap.title} (${cap.id}) ---\n${cap.doc}`);
      }
      return text(`${coreReference()}\n\n--- WORKFLOW ---\n${WORKFLOW}`);
    },
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
      title: "Create a NEW playable game",
      description:
        "Validate and save a NEW GameSpec, returning its id and play_url. Use this once to start a game (a minimal, playable skeleton), then refine it with update_game — do NOT call create_game again for tweaks, or you'll make duplicates. Fails (isError) with validation errors if the spec is invalid.",
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
    "update_game",
    {
      title: "Refine an existing game",
      description:
        "Overwrite an existing game's spec in place to refine it (this is how you iterate). Typically: get_game(id) to read the current spec, change what the user asked for, then update_game(id, newSpec). The id and play_url stay the same and any open browser tab hot-reloads, so the user sees the change live. Fails (isError) if the id is unknown or the new spec is invalid.",
      inputSchema: {
        id: z.string(),
        spec: specSchema,
        idea: z.string().optional(),
      },
    },
    async ({ id, spec, idea }) => {
      try {
        const game = await updateGame(id, spec as unknown as GameSpec, { idea });
        if (!game) return errorText(`No game with id "${id}". Use create_game for a new game.`);
        return text({ id: game.id, title: game.title, play_url: `${BASE_URL}/play/${game.id}`, updated: true });
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
