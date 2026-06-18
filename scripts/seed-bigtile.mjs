// Tile-grid demo: BIG composite items built from small tiles on a SINGLE entity
// (`tiles`). The castle + house are assembled from RECOLOURABLE "fabric" material
// tiles (stone, brickwork, shingle, window, arch) plus a recoloured material v2
// (brick2 = recolourable body + fixed mortar accent) — the same tiles, tinted to
// each structure's palette and combined spatially.
const BASE = process.env.BASE || "http://127.0.0.1:4321";
const _ = null;
const St = { glyph: "stone", color: "#9aa0aa" };     // grey stone
const Bk = { glyph: "brick2", color: "#c8743a" };    // recoloured v2 brick (body + dark mortar)
const Bw = { glyph: "brickwork", color: "#cf8a5a" }; // tan brick wall
const Sh = { glyph: "shingle", color: "#c0392b" };   // red roof shingles
const Wn = { glyph: "window", color: "#7ec0ee" };    // window
const Ar = { glyph: "arch", color: "#5a3a1a" };      // arched doorway
const F = { glyph: "flag", color: "#e23d3d" };       // flag (sits ON TOP)

const castle = [
  [_, _, F, _, _],          // flag on TOP, above the wall
  [St, _, St, _, St],       // stone crenellations
  [St, St, St, St, St],
  [Bk, Bk, Bk, Bk, Bk],     // a recoloured brick2 course (body recolours; mortar stays)
  [St, St, Ar, St, St],     // stone wall + arched doorway
];
const house = [
  [_, Sh, Sh, Sh, _],       // shingle roof
  [Sh, Sh, Sh, Sh, Sh],
  [Bw, Wn, Bw, Wn, Bw],     // brick wall + windows
  [Bw, Bw, Ar, Bw, Bw],     // brick wall + door
];

const spec = {
  meta: { title: "Big Tile (tile-grid)", idea: "big items assembled from recolourable fabric/material tiles on one entity" },
  world: { width: 720, height: 420, background: "#7ec0ee", edges: "wall" },
  entities: [
    { id: "ground", kind: "obstacle", shape: "square", color: "#4a9d4a", size: 220, control: "none", spawn: { x: 360, y: 560, count: 1 } },
    { id: "castle", kind: "obstacle", shape: "square", color: "#9a9aa2", size: 70, control: "none", solid: true, tiles: castle, spawn: { x: 250, y: 250, count: 1 } },
    { id: "house", kind: "obstacle", shape: "square", color: "#cf8a5a", size: 56, control: "none", solid: true, tiles: house, spawn: { x: 520, y: 268, count: 1 } },
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
