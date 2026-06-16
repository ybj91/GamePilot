// A game with a global `lives` var: each enemy hit costs a life and removes that
// enemy; the HUD shows Lives; game over at zero.
const BASE = process.env.BASE || "http://localhost:4321";
const spec = {
  meta: { title: "Three Lives", idea: "eat dots; each chaser hit costs a life; survive with 3 lives" },
  world: { width: 800, height: 600, background: "#0b0b12", edges: "wall" },
  vars: { lives: 3 },
  entities: [
    { id: "player", kind: "player", shape: "circle", color: "#4aa3ff", size: 14,
      control: "follow-pointer", spawn: { x: 400, y: 300 }, props: { speed: 250 } },
    { id: "food", kind: "food", shape: "dot", color: "#ffd23f", size: 5,
      spawn: { random: true, count: 12, maintain: 12 } },
    { id: "enemy", kind: "enemy", shape: "square", color: "#ff4d4d", size: 13,
      behavior: "chase:player", spawn: { random: true, count: 3, maintain: 3 }, props: { speed: 70 } },
  ],
  rules: [
    { id: "eat", on: "collision", between: ["player", "food"],
      effects: [{ op: "score", value: 1 }, { op: "destroy", target: "other" }] },
    { on: "collision", between: ["player", "enemy"], when: "lives > 1",
      effects: [{ op: "add", target: "lives", value: -1 }, { op: "destroy", target: "other" }] },
    { on: "collision", between: ["player", "enemy"], when: "lives <= 1",
      effects: [{ op: "gameover" }] },
  ],
  win: { when: "score >= 20" },
  lose: { when: "lives <= 0" },
};
const res = await fetch(`${BASE}/api/games`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ spec, idea: spec.meta.idea }) });
const body = await res.json();
console.log("POST", res.status, res.ok ? `\nPLAY: ${BASE}${body.url}\nid: ${body.id}` : JSON.stringify(body));
