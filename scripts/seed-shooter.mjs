// A twin-stick shooter that exercises input triggers + directional spawning:
// move with WASD/arrows, aim with the mouse, click to fire a bullet toward the
// cursor; shoot enemies for points, contact kills you.
const BASE = process.env.BASE || "http://localhost:4321";

const spec = {
  meta: { title: "Bullet Storm", idea: "move with WASD, aim with the mouse, click to shoot the chasers" },
  world: { width: 800, height: 600, background: "#0b0b12", edges: "wall" },
  entities: [
    { id: "player", kind: "player", shape: "circle", color: "#4aa3ff", size: 14,
      control: "arrows", spawn: { x: 400, y: 300 }, props: { speed: 240 } },
    { id: "bullet", kind: "obstacle", shape: "dot", color: "#9ad8ff", size: 5,
      control: "none", spawn: { count: 0 }, props: { speed: 560, ttl: 1.2 } },
    { id: "enemy", kind: "enemy", shape: "square", color: "#ff4d4d", size: 13,
      behavior: "chase:player", spawn: { random: true, count: 4, maintain: 4 }, props: { speed: 70 } },
  ],
  rules: [
    { on: "input", key: "pointer",
      effects: [{ op: "spawn", target: "bullet", from: "player", aim: "pointer" }] },
    { on: "collision", between: ["bullet", "enemy"],
      effects: [{ op: "destroy", target: "self" }, { op: "destroy", target: "other" }, { op: "score", value: 1 }] },
    { on: "collision", between: ["player", "enemy"], effects: [{ op: "gameover" }] },
  ],
  win: { when: "score >= 20" },
};

const res = await fetch(`${BASE}/api/games`, {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ spec, idea: spec.meta.idea }),
});
console.log("POST /api/games ->", res.status);
const body = await res.json();
if (res.ok) console.log("PLAY:", `${BASE}${body.url}`, "\nid:", body.id);
else console.log("rejected:", JSON.stringify(body));
