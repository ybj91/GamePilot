// Scenery showcase — demonstrates two things with NO new engine code:
//  1. SIZE: the same kind of glyph renders at different sizes by setting each
//     entity's `size` (flower 9 < bush 14 < tree 28 < house 36 < mountain 48).
//  2. COMBINING: a big "castle" built by tiling many small stone glyphs together
//     via the tilemap — small items composed into one big structure.
// Walk the little hero around with the arrow keys.
const BASE = process.env.BASE || "http://127.0.0.1:4321";

const COLS = 24, ROWS = 16, TILE = 32; // 768 x 512
const GROUND = 13;
const g = Array.from({ length: ROWS }, () => Array(COLS).fill("."));

// ground band (solid green tiles) along the bottom
for (let r = GROUND; r < ROWS; r++) for (let c = 0; c < COLS; c++) g[r][c] = "g";
// a size progression, left to right, all sitting on the ground (row GROUND-1)
g[GROUND - 1][2] = "f";   // flower  (size 9)
g[GROUND - 1][4] = "b";   // bush    (size 14)
g[GROUND - 1][6] = "T";   // tree    (size 28)
g[GROUND - 1][9] = "H";   // house   (size 36)
g[GROUND - 1][12] = "M";  // mountain(size 48)
// sky decoration
g[1][21] = "S";           // sun
g[2][4] = "c"; g[1][13] = "c"; // clouds
// a COMPOSITE castle: a block of stone tiles forms one big structure
for (let r = 9; r <= 12; r++) for (let c = 16; c <= 20; c++) {
  if (r === 12 && c === 18) continue;      // door gap
  if (r === 9 && (c === 17 || c === 19)) continue; // crenellation notches
  g[r][c] = "#";
}
g[8][18] = "F";           // flag on top of the castle
// the player
g[GROUND - 1][0] = "P";
const rows = g.map((r) => r.join(""));

const scenery = (id, glyph, size, color, kind = "obstacle") =>
  ({ id, kind, shape: "square", color, size, control: "none", glyph, spawn: { count: 0 } });

const spec = {
  meta: { title: "Scenery", idea: "a landscape showing glyphs at different sizes and small tiles combined into a big castle" },
  world: { background: "#7ec0ee", edges: "wall" },
  map: {
    tile: TILE,
    legend: { g: "ground", f: "flower", b: "bush", T: "tree", H: "house", M: "mountain", S: "sun", c: "cloud", "#": "stone", F: "flag", P: "player" },
    rows,
  },
  entities: [
    { id: "ground", kind: "obstacle", shape: "square", color: "#4a9d4a", size: 16, control: "none", spawn: { count: 0 } }, // plain green ground
    scenery("flower", "flower", 9, "#ff7eb6"),
    scenery("bush", "bush", 14, "#5fae5f"),
    scenery("tree", "tree", 28, "#2e8b3d"),
    scenery("house", "house", 36, "#d98a4a"),
    scenery("mountain", "mountain", 48, "#9aa0aa"),
    scenery("sun", "sun", 30, "#ffd23f"),
    scenery("cloud", "cloud", 22, "#eef3fa"),
    scenery("stone", "brick", 16, "#9a9aa2"),  // size 16 == one tile -> solid castle wall
    scenery("flag", "flag", 13, "#e23d3d"),
    { id: "player", kind: "player", shape: "square", color: "#e23d3d", size: 12, control: "arrows", glyph: "hero", spawn: { count: 0 }, props: { speed: 180 } },
  ],
  rules: [],
};

const v = await (await fetch(`${BASE}/api/validate`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ spec }) })).json();
console.log("validate:", v.ok ? "ok" : JSON.stringify(v.errors));
if (!v.ok) process.exit(1);
const res = await fetch(`${BASE}/api/games`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ spec, idea: spec.meta.idea }) });
const body = await res.json();
console.log("POST", res.status, res.ok ? `\nPLAY: ${BASE}${body.url}\nid: ${body.id}` : JSON.stringify(body));
