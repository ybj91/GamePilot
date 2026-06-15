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
const client = new Client({ name: "iterate-test", version: "0.0.0" });
await client.connect(transport);

const call = async (name, args = {}) => {
  const r = await client.callTool({ name, arguments: args });
  return { isError: !!r.isError, text: r.content.map((c) => c.text).join("") };
};

console.log("tools:", (await client.listTools()).tools.map((t) => t.name).join(", "));

// 1. create a NEW game
const created = JSON.parse((await call("create_game", { spec: growAndSlow, idea: growAndSlow.meta?.idea })).text);
console.log("create_game ->", created.id);

// 2. get it back
const got = JSON.parse((await call("get_game", { id: created.id })).text);
console.log("get_game: enemy speed before =", got.spec.entities.find((e) => e.id === "enemy").props.speed);

// 3. edit ONE thing (make enemies faster) and update in place
const edited = structuredClone(got.spec);
edited.entities.find((e) => e.id === "enemy").props.speed = 150;
edited.meta.title = "Grow & Slow (harder)";
const upd = await call("update_game", { id: created.id, spec: edited });
console.log("update_game ->", upd.isError ? "ERROR " + upd.text : JSON.parse(upd.text).updated, "(same id:", JSON.parse(upd.text).id === created.id, ")");

// 4. confirm the change persisted under the SAME id
const got2 = JSON.parse((await call("get_game", { id: created.id })).text);
console.log("get_game: enemy speed after =", got2.spec.entities.find((e) => e.id === "enemy").props.speed, "| title:", got2.title, "| updatedAt changed:", got2.updatedAt !== got.updatedAt);

// 5. update with an invalid spec is rejected
const bad = await call("update_game", { id: created.id, spec: { world: {}, entities: [], rules: [] } });
console.log("update_game (bad) -> isError:", bad.isError);

await client.close();
console.log("ITERATE OK");
