// End-to-end MCP test over stdio: spawn the GamePilot MCP server, list tools,
// read the DSL reference, validate a bad + good spec, create a game, list.
//   node scripts/mcp-test.mjs
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { growAndSlow } from "../src/dsl/samples/growAndSlow.ts";

const transport = new StdioClientTransport({
  command: process.platform === "win32" ? "npx.cmd" : "npx",
  args: ["tsx", "server/mcp-stdio.ts"],
  env: { ...process.env, GAMEPILOT_BASE_URL: "http://localhost:4321" },
  cwd: process.cwd(),
  stderr: "inherit",
});

const client = new Client({ name: "gamepilot-test", version: "0.0.0" });
await client.connect(transport);

const tools = await client.listTools();
console.log("TOOLS:", tools.tools.map((t) => t.name).join(", "));

const callText = async (name, args = {}) => {
  const r = await client.callTool({ name, arguments: args });
  return { isError: !!r.isError, text: r.content.map((c) => c.text).join("") };
};

const ref = await callText("get_dsl_reference");
console.log("get_dsl_reference:", ref.text.length, "chars, mentions GameSpec:", ref.text.includes("GameSpec"));

const bad = await callText("validate_game", { spec: { world: {}, entities: [], rules: [] } });
console.log("validate_game (bad): ok=false?", bad.text.includes('"ok": false'));

const good = await callText("validate_game", { spec: growAndSlow });
console.log("validate_game (good): ok=true?", good.text.includes('"ok": true'));

const created = await callText("create_game", { spec: growAndSlow, idea: growAndSlow.meta?.idea });
console.log("create_game:", created.isError ? "ERROR " + created.text : created.text.replace(/\s+/g, " "));

const list = await callText("list_games");
const count = (JSON.parse(list.text).games || []).length;
console.log("list_games: count =", count);

await client.close();
console.log("OK");
