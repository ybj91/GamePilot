// Big Maze — demonstrates the camera + tilemap capabilities together. The world
// (24x18 tiles = 960x720) is bigger than the 640x480 viewport, so the camera
// scrolls to follow the player. The whole level is authored as ASCII art: '#'
// is a solid wall, 'P' the player start. Drive with the arrow keys, collect the
// gold dots; a red roamer wanders the corridors. Move past the screen edge and
// the view scrolls with you.
const BASE = process.env.BASE || "http://localhost:4321";

// 24 wide x 18 tall, 40px tiles -> 960 x 720 world, seen through a 640x480 window.
// Built programmatically so every row is exactly W chars: a solid border, a grid
// of single-cell pillars inside (open '.' rows alternate with pillar rows), and
// the player start 'P' in the top-left corridor. The open rows keep every
// corridor connected, so the whole maze is walkable.
const W = 24;
const H = 18;
const rows = [];
for (let r = 0; r < H; r++) {
  let row = "";
  for (let c = 0; c < W; c++) {
    const border = r === 0 || r === H - 1 || c === 0 || c === W - 1;
    // Pillars on even/even interior cells -> a lattice with open lanes between.
    const pillar = r % 2 === 0 && c % 2 === 0;
    row += border || pillar ? "#" : ".";
  }
  rows.push(row);
}
// Carve the player's start cell (1,1) and make sure it's open.
rows[1] = "#P" + rows[1].slice(2);

const spec = {
  meta: {
    title: "Big Maze",
    idea: "a maze bigger than the screen — the camera scrolls to follow you as you collect dots",
  },
  world: { background: "#0b0b12", edges: "wall", viewport: { width: 640, height: 480 } },
  map: {
    tile: 40,
    legend: { "#": "wall", P: "player" },
    rows,
  },
  entities: [
    { id: "wall", kind: "obstacle", shape: "square", color: "#5b6472", size: 20,
      control: "none", solid: true, spawn: { count: 0 } },
    { id: "player", kind: "player", shape: "square", color: "#8cb33a", size: 13,
      control: "arrows", glyph: ["..X..", ".XXX.", "XXXXX", "XXXXX", "X.X.X"], rotate: true,
      spawn: { count: 0 }, props: { speed: 200 } },
    { id: "food", kind: "food", shape: "dot", color: "#ffd23f", size: 6,
      spawn: { random: true, count: 12, maintain: 12 } },
    { id: "roamer", kind: "enemy", shape: "square", color: "#d24b4b", size: 12,
      behavior: "wander", solid: true, spawn: { random: true, count: 2, maintain: 2 }, props: { speed: 110 } },
  ],
  rules: [
    { on: "collision", between: ["player", "food"], effects: [{ op: "score", value: 1 }, { op: "destroy", target: "other" }] },
    { on: "collision", between: ["player", "roamer"], effects: [{ op: "gameover" }] },
  ],
  win: { when: "score >= 20" },
};

const v = await (await fetch(`${BASE}/api/validate`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ spec }) })).json();
console.log("validate:", v.ok ? "ok" : JSON.stringify(v.errors));
if (!v.ok) process.exit(1);
const res = await fetch(`${BASE}/api/games`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ spec, idea: spec.meta.idea }) });
const body = await res.json();
console.log("POST", res.status, res.ok ? `\nPLAY: ${BASE}${body.url}\nid: ${body.id}` : JSON.stringify(body));
