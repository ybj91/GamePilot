// Painted-glyph showcase (glyph lib v2): multi-COLOUR sprites from one grid + a
// `palette`, and built-in painted presets — a tree with a brown trunk + green
// canopy, a cottage with a red roof, etc. Walk the hero around with the arrows.
const BASE = process.env.BASE || "http://127.0.0.1:4321";
const ground = (id, x, y) => ({ id, kind: "obstacle", shape: "square", color: "#4a9d4a", size: 16, control: "none", spawn: { x, y, count: 1 } });
const at = (id, glyph, size, x, y, color = "#888") => ({ id, kind: "obstacle", shape: "square", color, size, control: "none", glyph, spawn: { x, y, count: 1 } });

const spec = {
  meta: { title: "Village (painted glyphs)", idea: "a little village of multi-colour painted glyph sprites" },
  world: { width: 720, height: 400, background: "#7ec0ee", edges: "wall" },
  entities: [
    // a custom painted tree: one grid + palette (X = canopy in the entity colour, T = trunk)
    { id: "tree", kind: "obstacle", shape: "square", color: "#2e8b3d", size: 34, control: "none",
      glyph: ["...XX...", "..XXXX..", ".XXXXXX.", "XXXXXXXX", ".XXXXXX.", "..XXXX..", "...TT...", "...TT..."],
      palette: { T: "#7a4a23" }, spawn: { x: 140, y: 300, count: 1 } },
    // built-in composed presets
    at("cottage", "cottage", 40, 320, 296, "#c0392b"),
    at("pine", "pinetree", 30, 470, 306, "#2e8b3d"),
    at("daisy1", "daisy", 12, 250, 350, "#ff7eb6"),
    at("daisy2", "daisy", 12, 560, 352, "#ff7eb6"),
    at("shroom", "toadstool", 14, 600, 350, "#d23b3b"),
    // some ground + a hero
    ...Array.from({ length: 23 }, (_, i) => ground(`g${i}`, i * 32 + 16, 384)),
    { id: "player", kind: "player", shape: "square", color: "#e23d3d", size: 12, control: "arrows", glyph: "hero", spawn: { x: 40, y: 350, count: 1 }, props: { speed: 180 } },
  ],
  rules: [],
};
const v = await (await fetch(`${BASE}/api/validate`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ spec }) })).json();
console.log("validate:", v.ok ? "ok" : JSON.stringify(v.errors));
if (!v.ok) process.exit(1);
const res = await fetch(`${BASE}/api/games`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ spec, idea: spec.meta.idea }) });
const body = await res.json();
console.log("POST", res.status, res.ok ? `\nPLAY: ${BASE}${body.url}\nid: ${body.id}` : JSON.stringify(body));
