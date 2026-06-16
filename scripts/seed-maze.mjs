// Walled Arena — demonstrates the `solid` obstacle primitive. Navigate around
// gray walls (you can't pass through them) to collect dots; chasers are blocked
// by the walls too. Move with the mouse.
const BASE = process.env.BASE || "http://localhost:4321";

// gray solid wall blocks at fixed spots
const wall = (id, x, y) => ({
  id, kind: "obstacle", shape: "square", color: "#6b7280", size: 42,
  control: "none", solid: true, spawn: { x, y, count: 1 }, props: { speed: 0 },
});

const spec = {
  meta: { title: "Walled Arena", idea: "navigate around solid walls to collect dots while chasers hunt you" },
  world: { width: 800, height: 600, background: "#0b0b12", edges: "wall" },
  entities: [
    { id: "player", kind: "player", shape: "circle", color: "#4aa3ff", size: 12,
      control: "follow-pointer", spawn: { x: 80, y: 300 }, props: { speed: 230 } },
    wall("w1", 300, 300), wall("w2", 300, 200), wall("w3", 300, 400),
    wall("w4", 520, 230), wall("w5", 520, 370),
    { id: "food", kind: "food", shape: "dot", color: "#ffd23f", size: 5,
      spawn: { random: true, count: 14, maintain: 14 } },
    { id: "enemy", kind: "enemy", shape: "square", color: "#ff4d4d", size: 13,
      behavior: "chase:player", spawn: { area: "right", count: 2, maintain: 2 }, props: { speed: 85 } },
  ],
  rules: [
    { on: "collision", between: ["player", "food"], effects: [{ op: "score", value: 1 }, { op: "destroy", target: "other" }] },
    { on: "collision", between: ["player", "enemy"], effects: [{ op: "gameover" }] },
  ],
  win: { when: "score >= 15" },
};

const v = await (await fetch(`${BASE}/api/validate`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ spec }) })).json();
console.log("validate:", v.ok ? "ok" : JSON.stringify(v.errors));
if (!v.ok) process.exit(1);
const res = await fetch(`${BASE}/api/games`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ spec, idea: spec.meta.idea }) });
const body = await res.json();
console.log("POST", res.status, res.ok ? `\nPLAY: ${BASE}${body.url}\nid: ${body.id}` : JSON.stringify(body));
