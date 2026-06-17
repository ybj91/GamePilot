// Glyph Zoo — showcases the extended glyph system: built-in preset shapes and
// GIF-like animation. The player is a preset "tank" that rotates to face its
// heading; the enemies are self-animating "invader" / "blob" presets (they
// wiggle/breathe on their own); pickups are a custom 2-frame pulsing gem. Drive
// with the arrows, collect the gems, dodge the creatures.
const BASE = process.env.BASE || "http://127.0.0.1:4321";

const spec = {
  meta: { title: "Glyph Zoo", idea: "show off preset shapes and animated glyphs that look alive" },
  world: { width: 800, height: 600, background: "#0b0b12", edges: "wall" },
  entities: [
    { id: "player", kind: "player", shape: "square", color: "#8cb33a", size: 16,
      control: "arrows", glyph: "tank", rotate: true, spawn: { x: 400, y: 300 }, props: { speed: 220 } },
    // self-animating presets — no frames authored, they cycle on their own
    { id: "invader", kind: "enemy", shape: "square", color: "#d24b4b", size: 15,
      behavior: "wander", glyph: "invader", spawn: { area: "top", count: 3, maintain: 3 }, props: { speed: 70 } },
    { id: "blob", kind: "enemy", shape: "square", color: "#a86bd6", size: 16,
      behavior: "chase:player", glyph: "blob", fps: 3, spawn: { area: "edges", count: 2, maintain: 2 }, props: { speed: 55 } },
    // a custom 2-frame pulsing gem (explicit frames + fps)
    { id: "gem", kind: "food", shape: "dot", color: "#ffd23f", size: 10,
      frames: [
        ["..X..", ".XXX.", "XXXXX", ".XXX.", "..X.."],
        [".....", "..X..", ".XXX.", "..X..", "....."],
      ], fps: 4, spawn: { random: true, count: 8, maintain: 8 } },
  ],
  rules: [
    { on: "collision", between: ["player", "gem"], effects: [{ op: "score", value: 1 }, { op: "destroy", target: "other" }] },
    { on: "collision", between: ["player", "invader"], effects: [{ op: "gameover" }] },
    { on: "collision", between: ["player", "blob"], effects: [{ op: "gameover" }] },
  ],
  win: { when: "score >= 20" },
};

const v = await (await fetch(`${BASE}/api/validate`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ spec }) })).json();
console.log("validate:", v.ok ? "ok" : JSON.stringify(v.errors));
if (!v.ok) process.exit(1);
const res = await fetch(`${BASE}/api/games`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ spec, idea: spec.meta.idea }) });
const body = await res.json();
console.log("POST", res.status, res.ok ? `\nPLAY: ${BASE}${body.url}\nid: ${body.id}` : JSON.stringify(body));
