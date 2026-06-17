// Flash Range — demonstrates the `flash` hit-feedback effect. Armored invaders
// take 3 hits: each survivable hit flashes the enemy bright gold (flashColor)
// so you can see it connected; the third hit kills it with a one-shot
// explosion. Aim with the mouse and click to fire; drive with the arrows.
const BASE = process.env.BASE || "http://127.0.0.1:4321";

const spec = {
  meta: { title: "Flash Range", idea: "shoot armored invaders that flash bright on every hit and explode on the kill" },
  world: { width: 800, height: 600, background: "#0b0b12", edges: "wall" },
  entities: [
    { id: "player", kind: "player", shape: "square", color: "#8cb33a", size: 16,
      control: "arrows", glyph: "tank", rotate: true, spawn: { x: 400, y: 520 }, props: { speed: 220 } },
    { id: "bullet", kind: "obstacle", shape: "dot", color: "#dff0ff", size: 4,
      control: "none", spawn: { count: 0 }, props: { speed: 560, ttl: 1.6 } },
    // armored: 3 hp, flashes gold on a survivable hit
    { id: "enemy", kind: "enemy", shape: "square", color: "#9b5de5", size: 17,
      behavior: "wander", glyph: "invader", flashColor: "#ffd23f",
      spawn: { area: "top", count: 4, maintain: 4 }, props: { speed: 55, hp: 3 } },
    { id: "boom", kind: "effect", shape: "dot", color: "#ff9a3c", size: 22,
      control: "none", glyph: "explosion", loop: false, spawn: { count: 0 }, props: { ttl: 0.45 } },
  ],
  rules: [
    { on: "input", key: "pointer", effects: [{ op: "spawn", target: "bullet", from: "player", aim: "pointer" }] },
    { on: "input", key: "space", effects: [{ op: "spawn", target: "bullet", from: "player", aim: "forward" }] },
    // survivable hit (hp > 1): lose 1 hp, FLASH bright, consume the bullet
    { on: "collision", between: ["bullet", "enemy"], when: "enemy.hp > 1",
      effects: [{ op: "add", target: "other.hp", value: -1 }, { op: "flash", target: "other", value: 0.18 }, { op: "destroy", target: "self" }] },
    // killing hit (hp <= 1): explode, score, remove both
    { on: "collision", between: ["bullet", "enemy"], when: "enemy.hp <= 1",
      effects: [{ op: "spawn", target: "boom", from: "other" }, { op: "destroy", target: "self" }, { op: "destroy", target: "other" }, { op: "score", value: 1 }] },
    { on: "collision", between: ["player", "enemy"], effects: [{ op: "gameover" }] },
  ],
  win: { when: "score >= 20" },
};

const v = await (await fetch(`${BASE}/api/validate`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ spec }) })).json();
console.log("validate:", v.ok ? "ok" : JSON.stringify(v.errors));
if (!v.ok) process.exit(1);
const res = await fetch(`${BASE}/api/games`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ spec, idea: spec.meta.idea }) });
const body = await res.json();
console.log("POST", res.status, res.ok ? `\nPLAY: ${BASE}${body.url}\nid: ${body.id}` : JSON.stringify(body));
