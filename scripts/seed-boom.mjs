// Boom Range — demonstrates the one-shot `explosion` preset tied to ttl. Aim
// with the mouse, click to fire a bullet; when it hits an invader, a "boom"
// effect is spawned where the enemy died (glyph:"explosion", loop:false,
// ttl:0.4) — it plays its 5 frames once over 0.4s, then auto-despawns.
const BASE = process.env.BASE || "http://127.0.0.1:4321";

const spec = {
  meta: { title: "Boom Range", idea: "shoot invaders; each kill bursts into a one-shot explosion" },
  world: { width: 800, height: 600, background: "#0b0b12", edges: "wall" },
  entities: [
    { id: "player", kind: "player", shape: "square", color: "#8cb33a", size: 16,
      control: "arrows", glyph: "tank", rotate: true, spawn: { x: 400, y: 520 }, props: { speed: 220 } },
    { id: "bullet", kind: "obstacle", shape: "dot", color: "#dff0ff", size: 4,
      control: "none", spawn: { count: 0 }, props: { speed: 540, ttl: 1.6 } },
    { id: "invader", kind: "enemy", shape: "square", color: "#d24b4b", size: 16,
      behavior: "wander", glyph: "invader", spawn: { area: "top", count: 5, maintain: 5 }, props: { speed: 60 } },
    // one-shot explosion effect: only spawned by the kill rule, plays once, dies.
    { id: "boom", kind: "effect", shape: "dot", color: "#ff9a3c", size: 20,
      control: "none", glyph: "explosion", loop: false, spawn: { count: 0 }, props: { ttl: 0.45 } },
  ],
  rules: [
    { on: "input", key: "pointer", effects: [{ op: "spawn", target: "bullet", from: "player", aim: "pointer" }] },
    { on: "input", key: "space", effects: [{ op: "spawn", target: "bullet", from: "player", aim: "forward" }] },
    { on: "collision", between: ["bullet", "invader"], effects: [
      { op: "spawn", target: "boom", from: "other" },
      { op: "destroy", target: "self" },
      { op: "destroy", target: "other" },
      { op: "score", value: 1 },
    ] },
    { on: "collision", between: ["player", "invader"], effects: [{ op: "gameover" }] },
  ],
  win: { when: "score >= 25" },
};

const v = await (await fetch(`${BASE}/api/validate`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ spec }) })).json();
console.log("validate:", v.ok ? "ok" : JSON.stringify(v.errors));
if (!v.ok) process.exit(1);
const res = await fetch(`${BASE}/api/games`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ spec, idea: spec.meta.idea }) });
const body = await res.json();
console.log("POST", res.status, res.ok ? `\nPLAY: ${BASE}${body.url}\nid: ${body.id}` : JSON.stringify(body));
