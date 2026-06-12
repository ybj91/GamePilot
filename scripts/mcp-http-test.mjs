// Probe the MCP-over-HTTP endpoint (Streamable HTTP) on the running backend.
//   URL=http://localhost:4322/mcp node scripts/mcp-http-test.mjs
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const url = new URL(process.env.URL || "http://localhost:4322/mcp");
const transport = new StreamableHTTPClientTransport(url);
const client = new Client({ name: "gamepilot-http-test", version: "0.0.0" });
await client.connect(transport);

const tools = await client.listTools();
console.log("HTTP TOOLS:", tools.tools.map((t) => t.name).join(", "));

const r = await client.callTool({ name: "list_games", arguments: {} });
const games = JSON.parse(r.content.map((c) => c.text).join("")).games || [];
console.log("HTTP list_games count:", games.length);

await client.close();
console.log("OK");
