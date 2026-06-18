// Super Mario (richer) — a wide scrolling platformer dressed with the new glyph
// lib: a colour `hero2` Mario, `coin2` coins, composed `pinetree`/`bush`/`cloud`/
// `sun` scenery, green pipes, waddling goombas (stomp them!), and a big TILE-GRID
// castle as the goal. Arrows/WASD to run, ↑/W/Space to jump. 3 lives.
const BASE = process.env.BASE || "http://127.0.0.1:4321";

const COLS = 52, ROWS = 16, TILE = 32;       // 1664 x 512 world
const GROUND = 13, DEAD = 15;
const g = Array.from({ length: ROWS }, () => Array(COLS).fill("."));

// ground (two rows) with pit gaps to jump
const pits = new Set([11, 12, 13, 24, 25, 37, 38, 39]);
for (let c = 0; c < COLS; c++) if (!pits.has(c)) { g[GROUND][c] = "#"; g[GROUND + 1][c] = "#"; }
for (let c = 0; c < COLS; c++) g[DEAD][c] = "D";                // bottom deadzone

const put = (c, r, ch) => { if (r >= 0 && r < ROWS && c >= 0 && c < COLS) g[r][c] = ch; };
// floating block clusters
for (const c of [6, 7, 8]) put(c, 9, "B");
for (const c of [20, 21]) put(c, 8, "B");
for (const c of [29, 30, 31]) put(c, 7, "B");
// a staircase up to the castle
for (let i = 0; i < 4; i++) for (let r = GROUND - 1 - i; r <= GROUND - 1; r++) put(43 + i, r, "B");
// coins: above blocks, in arcs, over pits
for (const c of [6, 7, 8]) put(c, 8, "C");
for (const [c, r] of [[12, 11], [25, 10], [38, 11], [20, 6], [21, 6], [30, 6], [16, 10], [33, 9]]) put(c, r, "C");
// pipes (green, solid)
put(16, GROUND - 1, "P"); put(34, GROUND - 1, "P");
// goombas on solid ground
for (const c of [5, 9, 19, 27, 33, 41]) put(c, GROUND - 1, "E");
// scenery
for (const [c, r] of [[2, 1], [15, 2], [28, 1], [46, 2]]) put(c, r, "o");  // clouds
put(48, 1, "*");                                                          // sun
for (const c of [3, 35]) put(c, GROUND - 1, "T");                         // pinetrees
for (const c of [10, 23]) put(c, GROUND - 1, "b");                        // bushes
// the castle goal (big tile-grid, sits at the far right)
put(49, 10, "K");

const rows = g.map((r) => r.join(""));
const B = "brick", _ = ".";
const castle = [
  [_, _, { glyph: "flag", color: "#e23d3d" }, _, _],  // flag on TOP
  [B, _, B, _, B],
  [B, B, B, B, B],
  [B, B, B, B, B],
  [B, B, _, B, B],
];

const spec = {
  meta: { title: "Super Mario", idea: "a wide scrolling Mario level with pipes, goombas, coins, a castle — dressed in the new glyph lib" },
  world: { background: "#7ec0ee", edges: "wall", gravity: 1700, viewport: { width: 640, height: 512 } },
  vars: { lives: 3 },
  map: { tile: TILE, legend: { "#": "ground", B: "block", C: "coin", E: "goomba", P: "pipe", K: "castle", D: "deadzone", o: "cloud", "*": "sun", T: "tree", b: "bush" }, rows },
  entities: [
    { id: "ground", kind: "obstacle", shape: "square", color: "#7a4a23", size: 16, control: "none", solid: true, glyph: "brick", spawn: { count: 0 } },
    { id: "block", kind: "obstacle", shape: "square", color: "#d98a4a", size: 16, control: "none", solid: true, glyph: "brick", spawn: { count: 0 } },
    { id: "pipe", kind: "obstacle", shape: "square", color: "#2ec16e", size: 26, control: "none", solid: true, glyph: "pipe", spawn: { count: 0 } },
    { id: "coin", kind: "food", shape: "dot", color: "#ffd23f", size: 9, control: "none", glyph: "coin2", spawn: { count: 0 } },
    { id: "goomba", kind: "enemy", shape: "square", color: "#9a6324", size: 13, behavior: "walker", glyph: "goomba", spawn: { count: 0 }, props: { speed: 55 } },
    { id: "cloud", kind: "obstacle", shape: "square", color: "#f4f8ff", size: 20, control: "none", glyph: "cloud", spawn: { count: 0 } },
    { id: "sun", kind: "obstacle", shape: "square", color: "#ffd23f", size: 26, control: "none", glyph: "sun", spawn: { count: 0 } },
    { id: "tree", kind: "obstacle", shape: "square", color: "#2e8b3d", size: 26, control: "none", glyph: "pinetree", spawn: { count: 0 } },
    { id: "bush", kind: "obstacle", shape: "square", color: "#3aa54a", size: 16, control: "none", glyph: "bush", spawn: { count: 0 } },
    { id: "deadzone", kind: "obstacle", shape: "square", color: "#7ec0ee", size: 16, control: "none", spawn: { count: 0 } },
    { id: "castle", kind: "goal", shape: "square", color: "#9a9aa2", size: 70, control: "none", tiles: castle, spawn: { count: 0 } },
    { id: "player", kind: "player", shape: "square", color: "#e23d3d", size: 13, control: "platformer", glyph: "hero2",
      spawn: { x: 48, y: GROUND * TILE - 24, count: 1, maintain: 1 }, props: { speed: 175, jump: 660 } },
  ],
  rules: [
    { on: "collision", between: ["player", "coin"], effects: [{ op: "score", value: 1 }, { op: "destroy", target: "other" }] },
    { on: "collision", between: ["player", "castle"], effects: [{ op: "win" }] },
    // stomp a goomba from above; a side bump costs a life (respawn) or ends it
    { on: "collision", between: ["player", "goomba"], when: "self.vy > 40", effects: [{ op: "bounce" }, { op: "destroy", target: "other" }, { op: "score", value: 1 }] },
    { on: "collision", between: ["player", "goomba"], when: "lives > 1", effects: [{ op: "add", target: "lives", value: -1 }, { op: "destroy", target: "self" }] },
    { on: "collision", between: ["player", "goomba"], when: "lives <= 1", effects: [{ op: "gameover" }] },
    // fall in a pit
    { on: "collision", between: ["player", "deadzone"], when: "lives > 1", effects: [{ op: "add", target: "lives", value: -1 }, { op: "destroy", target: "self" }] },
    { on: "collision", between: ["player", "deadzone"], when: "lives <= 1", effects: [{ op: "gameover" }] },
  ],
  lose: { when: "lives <= 0" },
};

const v = await (await fetch(`${BASE}/api/validate`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ spec }) })).json();
console.log("validate:", v.ok ? "ok" : JSON.stringify(v.errors));
if (!v.ok) process.exit(1);
const res = await fetch(`${BASE}/api/games`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ spec, idea: spec.meta.idea }) });
const body = await res.json();
console.log("POST", res.status, res.ok ? `\nPLAY: ${BASE}${body.url}\nid: ${body.id}` : JSON.stringify(body));
