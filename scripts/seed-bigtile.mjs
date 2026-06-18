// Tile-grid demo: a BIG composite item built from small single-layer tiles on a
// SINGLE entity (`tiles`). The castle is one 5x5 entity assembled from "brick"
// tiles (with a flag, a door gap, crenellations); a big tree from trunk/leaf
// tiles. Each tile is a plain single-layer glyph — combined spatially, not layered.
const BASE = process.env.BASE || "http://127.0.0.1:4321";
const B = "brick", _ = ".";

const castle = [
  [B, _, B, _, B],          // crenellations (gaps between merlons)
  [B, B, B, B, B],
  [B, B, { glyph: "flag", color: "#e23d3d" }, B, B],
  [B, B, B, B, B],
  [B, B, _, B, B],          // doorway gap
];
const tree = [
  [{ glyph: "leaf", color: "#2e8b3d" }, { glyph: "leaf", color: "#3aa54a" }, { glyph: "leaf", color: "#2e8b3d" }],
  [{ glyph: "leaf", color: "#3aa54a" }, { glyph: "leaf", color: "#2e8b3d" }, { glyph: "leaf", color: "#3aa54a" }],
  [_, { glyph: "brick", color: "#7a4a23" }, _],
];

const spec = {
  meta: { title: "Big Tile (tile-grid)", idea: "big items each assembled from small tiles on one entity" },
  world: { width: 720, height: 420, background: "#7ec0ee", edges: "wall" },
  entities: [
    { id: "ground", kind: "obstacle", shape: "square", color: "#4a9d4a", size: 220, control: "none", spawn: { x: 360, y: 560, count: 1 } },
    { id: "castle", kind: "obstacle", shape: "square", color: "#9a9aa2", size: 70, control: "none", solid: true, tiles: castle, spawn: { x: 280, y: 250, count: 1 } },
    { id: "bigtree", kind: "obstacle", shape: "square", color: "#2e8b3d", size: 48, control: "none", tiles: tree, spawn: { x: 520, y: 270, count: 1 } },
    { id: "player", kind: "player", shape: "square", color: "#e23d3d", size: 12, control: "arrows", glyph: "hero", spawn: { x: 60, y: 300, count: 1 }, props: { speed: 180 } },
  ],
  rules: [],
};
const v = await (await fetch(`${BASE}/api/validate`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ spec }) })).json();
console.log("validate:", v.ok ? "ok" : JSON.stringify(v.errors));
if (!v.ok) process.exit(1);
const res = await fetch(`${BASE}/api/games`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ spec, idea: spec.meta.idea }) });
const body = await res.json();
console.log("POST", res.status, res.ok ? `\nPLAY: ${BASE}${body.url}\nid: ${body.id}` : JSON.stringify(body));
