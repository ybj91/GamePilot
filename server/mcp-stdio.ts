/**
 * stdio entry for the GamePilot MCP server:  npm run mcp
 *
 * This is what an agent client (Claude Code / Desktop / etc.) launches. stdout
 * is the JSON-RPC channel, so NEVER write logs there — diagnostics go to stderr.
 * The play URLs point at the HTTP backend (GAMEPILOT_BASE_URL), which must be
 * running (`npm run serve`) for games to actually open, and both processes must
 * share a games dir (set GAMEPILOT_DATA_DIR if cwd differs).
 */

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { buildMcpServer } from "./mcp";

const server = buildMcpServer();
const transport = new StdioServerTransport();

server
  .connect(transport)
  .then(() => console.error("[gamepilot-mcp] stdio server ready"))
  .catch((err) => {
    console.error("[gamepilot-mcp] failed to start:", err);
    process.exit(1);
  });
