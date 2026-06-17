// Frogger — a lane-crosser archetype built from EXISTING features only (no new
// engine code), showing the DSL already spans another genre:
//  - the frog is an arrows-controlled player that respawns at the start on a hit
//    (spawn.maintain) and loses a life (vars), game over at zero;
//  - each road lane is a car type streamed across by an `interval` spawner using
//    `spawn` + `aim` (left/right) — the same projectile mechanic shooters use;
//  - the safe goal band at the top is a `tilemap` row; touch it to win.
const BASE = process.env.BASE || "http://127.0.0.1:4321";

const TILE = 40, COLS = 15, ROWS = 15;          // 600 x 600 world
const W = COLS * TILE, H = ROWS * TILE;
const laneY = (row) => row * TILE + TILE / 2;
const SIZE = 16, M = SIZE;

// road lanes: alternating directions, varied speed/colour/spacing
const lanes = [
  { row: 3, dir: 1, speed: 90, color: "#e0564b", every: 2.2 },
  { row: 5, dir: -1, speed: 135, color: "#e0a14b", every: 1.7 },
  { row: 7, dir: 1, speed: 70, color: "#48c66a", every: 2.6 },
  { row: 9, dir: -1, speed: 165, color: "#4ba6e0", every: 1.5 },
  { row: 11, dir: 1, speed: 110, color: "#b66be0", every: 2.0 },
];

// map: top row is the goal band; the rest is open road (cars are dynamic)
const rows = [];
for (let r = 0; r < ROWS; r++) rows.push(r === 0 ? "G".repeat(COLS) : ".".repeat(COLS));

const entities = [
  { id: "goal", kind: "goal", shape: "square", color: "#2e7d32", size: 20, control: "none", spawn: { count: 0 } },
  { id: "frog", kind: "player", shape: "square", color: "#6fcf52", size: SIZE, control: "arrows",
    glyph: [".X.X.", "XXXXX", "XXXXX", "X.X.X", "X...X"],
    spawn: { x: W / 2, y: H - TILE / 2, count: 1, maintain: 1 }, props: { speed: 150 } },
];
const rules = [
  { on: "collision", between: ["frog", "goal"], effects: [{ op: "score", value: 1 }, { op: "win" }] },
];

for (const [i, ln] of lanes.entries()) {
  const id = `car${i}`;
  const ttl = Math.round(((W) / ln.speed + 0.6) * 10) / 10;
  entities.push({
    id, kind: "enemy", shape: "square", color: ln.color, size: SIZE, control: "none",
    spawn: { x: ln.dir > 0 ? M : W - M, y: laneY(ln.row), count: 0 }, props: { speed: ln.speed, ttl },
  });
  rules.push({ on: "interval", every: ln.every, effects: [{ op: "spawn", target: id, aim: ln.dir > 0 ? "right" : "left" }] });
  // a hit costs a life and resets the frog to the start (destroy -> maintain respawns it)
  rules.push({ on: "collision", between: ["frog", id], when: "lives > 1", effects: [{ op: "add", target: "lives", value: -1 }, { op: "destroy", target: "self" }] });
  rules.push({ on: "collision", between: ["frog", id], when: "lives <= 1", effects: [{ op: "gameover" }] });
}

const spec = {
  meta: { title: "Frogger", idea: "hop across lanes of traffic to reach the safe zone; 3 lives" },
  world: { background: "#0b0b12", edges: "wall" },
  vars: { lives: 3 },
  map: { tile: TILE, legend: { G: "goal" }, rows },
  entities,
  rules,
  lose: { when: "lives <= 0" },
};

const v = await (await fetch(`${BASE}/api/validate`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ spec }) })).json();
console.log("validate:", v.ok ? "ok" : JSON.stringify(v.errors));
if (!v.ok) process.exit(1);
const res = await fetch(`${BASE}/api/games`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ spec, idea: spec.meta.idea }) });
const body = await res.json();
console.log("POST", res.status, res.ok ? `\nPLAY: ${BASE}${body.url}\nid: ${body.id}` : JSON.stringify(body));
