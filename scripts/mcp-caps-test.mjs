import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
const transport = new StdioClientTransport({
  command: process.platform === "win32" ? "npx.cmd" : "npx",
  args: ["tsx", "server/mcp-stdio.ts"], env: { ...process.env }, cwd: process.cwd(), stderr: "inherit",
});
const client = new Client({ name: "caps-test", version: "0.0.0" });
await client.connect(transport);
const call = async (args) => {
  const r = await client.callTool({ name: "get_dsl_reference", arguments: args });
  return { isError: !!r.isError, text: r.content.map((c) => c.text).join("") };
};
const core = await call({});
console.log("core: has CORE menu?", core.text.includes("EXTENSIONS"), "| lists obstacles?", core.text.includes("obstacles —"),
  "| WITHOUT obstacles doc?", !core.text.includes('"solid": true on an entity'), "| chars:", core.text.length);
const obs = await call({ capability: "obstacles" });
console.log("obstacles slice: has solid doc?", obs.text.includes('"solid": true on an entity'), "| chars:", obs.text.length);
const shoot = await call({ capability: "shooting" });
console.log("shooting slice: has input+aim?", shoot.text.includes('"on":"input"') && shoot.text.includes('"aim"'));
const bad = await call({ capability: "nope" });
console.log("unknown capability -> isError:", bad.isError, "| lists available:", bad.text.includes("obstacles"));
await client.close();
console.log("OK");
