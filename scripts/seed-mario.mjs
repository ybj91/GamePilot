// Mario-lite — the platformer capability cluster: gravity + a `platformer`
// control (run + grounded jump) + solid platforms, with the level authored as a
// tilemap and the camera scrolling horizontally. Run with arrows/AD, jump with
// ↑/W/space; collect coins, clear the pits, reach the green flag. Fall in a pit
// and it's over.
const BASE = process.env.BASE || "http://127.0.0.1:4321";

const COLS = 40, ROWS = 14, TILE = 32;          // 1280 x 448 world
const GROUND = 11, DEAD = 13, PLAT = 8;
const grid = Array.from({ length: ROWS }, () => Array(COLS).fill("."));

// ground row, with pit gaps to jump over
const pits = new Set();
for (let c = 13; c <= 15; c++) pits.add(c);
for (let c = 25; c <= 27; c++) pits.add(c);
for (let c = 0; c < COLS; c++) if (!pits.has(c)) grid[GROUND][c] = "#";
// a deadzone strip along the very bottom catches a missed jump
for (let c = 0; c < COLS; c++) grid[DEAD][c] = "D";
// floating platforms to hop onto
const plats = [[8, 10], [18, 20], [30, 32]];
for (const [a, b] of plats) for (let c = a; c <= b; c++) grid[PLAT][c] = "#";
// coins: a row above each platform (jump for them) + a few walkable ones
for (const [a, b] of plats) for (let c = a; c <= b; c++) grid[PLAT - 1][c] = "C";
for (const c of [6, 20, 33]) grid[GROUND - 1][c] = "C";
// player start (drops onto the ground) + the goal flag near the right
grid[GROUND - 1][2] = "P";
grid[GROUND - 1][COLS - 3] = "G";
const rows = grid.map((r) => r.join(""));

const spec = {
  meta: { title: "Mario-lite", idea: "run and jump across platforms over pits, grab coins, reach the flag" },
  world: { background: "#5c94fc", edges: "wall", gravity: 1700, viewport: { width: 640, height: 448 } },
  map: { tile: TILE, legend: { "#": "ground", C: "coin", G: "goal", D: "deadzone", P: "player" }, rows },
  entities: [
    { id: "player", kind: "player", shape: "square", color: "#e23d3d", size: 13,
      control: "platformer", spawn: { count: 0 }, props: { speed: 170, jump: 640 } },
    { id: "ground", kind: "obstacle", shape: "square", color: "#7a4a23", size: 16, control: "none", solid: true, spawn: { count: 0 } },
    { id: "coin", kind: "food", shape: "dot", color: "#ffd23f", size: 7, control: "none", spawn: { count: 0 } },
    { id: "goal", kind: "goal", shape: "square", color: "#2e7d32", size: 14, control: "none", spawn: { count: 0 } },
    { id: "deadzone", kind: "obstacle", shape: "square", color: "#5c94fc", size: 16, control: "none", spawn: { count: 0 } },
  ],
  rules: [
    { on: "collision", between: ["player", "coin"], effects: [{ op: "score", value: 1 }, { op: "destroy", target: "other" }] },
    { on: "collision", between: ["player", "goal"], effects: [{ op: "win" }] },
    { on: "collision", between: ["player", "deadzone"], effects: [{ op: "gameover" }] },
  ],
  win: { when: "score >= 999" }, // real win is reaching the flag (rule above)
};

const v = await (await fetch(`${BASE}/api/validate`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ spec }) })).json();
console.log("validate:", v.ok ? "ok" : JSON.stringify(v.errors));
if (!v.ok) process.exit(1);
const res = await fetch(`${BASE}/api/games`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ spec, idea: spec.meta.idea }) });
const body = await res.json();
console.log("POST", res.status, res.ok ? `\nPLAY: ${BASE}${body.url}\nid: ${body.id}` : JSON.stringify(body));
