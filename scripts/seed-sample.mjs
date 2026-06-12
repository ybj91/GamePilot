// Dev helper: POST the canonical sample to the running backend, then list.
import { growAndSlow } from "../src/dsl/samples/growAndSlow.ts";

const base = process.env.BASE || "http://localhost:4321";

const res = await fetch(`${base}/api/games`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ spec: growAndSlow, idea: growAndSlow.meta?.idea }),
});
console.log("POST /api/games ->", res.status);
const game = await res.json();
console.log("id:", game.id);
console.log("url:", game.url);

const list = await (await fetch(`${base}/api/games`)).json();
console.log("LIST count:", list.games.length, "->", list.games.map((g) => g.id).join(", "));

// Validate-only probe with a deliberately broken spec.
const bad = await fetch(`${base}/api/validate`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ spec: { world: {}, entities: [], rules: [] } }),
});
console.log("POST /api/validate (bad spec) ->", (await bad.json()).ok === false ? "ok=false (rejected)" : "UNEXPECTED");
