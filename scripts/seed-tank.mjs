// Tank Battle — a Battle City / Tank 1990 inspired game, authored by hand
// against the GamePilot DSL (this is exactly what an agent would emit).
// Drive with WASD/arrows, aim with the mouse, click to fire. Enemy tanks
// advance on your gold base; shoot them before they reach it, and dodge shells.
const BASE = process.env.BASE || "http://localhost:4321";

const spec = {
  meta: {
    title: "Tank Battle",
    idea: "drive a tank, aim with the mouse and shoot enemy tanks, defend your base, dodge shells",
  },
  world: { width: 800, height: 600, background: "#0e1108", edges: "wall" },
  vars: { lives: 3 },
  entities: [
    // your tank
    { id: "player", kind: "player", shape: "square", color: "#8cb33a", size: 15,
      control: "arrows", spawn: { x: 400, y: 470 }, props: { speed: 185 } },
    // the base / eagle you must protect
    { id: "base", kind: "obstacle", shape: "square", color: "#ffd23f", size: 17,
      control: "none", spawn: { x: 400, y: 560, count: 1 }, props: { speed: 0 } },
    // enemy tanks: advance on the base
    { id: "enemy", kind: "enemy", shape: "square", color: "#d24b4b", size: 15,
      behavior: "chase:base", spawn: { random: true, count: 4, maintain: 4 }, props: { speed: 58 } },
    // your shells (mouse-aimed)
    { id: "bullet", kind: "obstacle", shape: "dot", color: "#dff0ff", size: 4,
      control: "none", spawn: { count: 0 }, props: { speed: 520, ttl: 1.4 } },
    // enemy shells (aimed at you)
    { id: "shell", kind: "obstacle", shape: "dot", color: "#ff8a3a", size: 4,
      control: "none", spawn: { count: 0 }, props: { speed: 270, ttl: 2.4 } },
  ],
  rules: [
    // fire toward the cursor
    { on: "input", key: "pointer",
      effects: [{ op: "spawn", target: "bullet", from: "player", aim: "pointer" }] },
    // your shell destroys an enemy tank -> score
    { on: "collision", between: ["bullet", "enemy"],
      effects: [{ op: "destroy", target: "self" }, { op: "destroy", target: "other" }, { op: "score", value: 1 }] },
    // the lead enemy fires at you on a cadence
    { on: "interval", every: 1.1,
      effects: [{ op: "spawn", target: "shell", from: "enemy", aim: "player" }] },
    // enemy shell hits you -> lose a life (last one = game over)
    { on: "collision", between: ["shell", "player"], when: "lives > 1",
      effects: [{ op: "add", target: "lives", value: -1 }, { op: "destroy", target: "self" }] },
    { on: "collision", between: ["shell", "player"], when: "lives <= 1",
      effects: [{ op: "gameover" }] },
    // ramming an enemy tank also costs a life (and wrecks the enemy)
    { on: "collision", between: ["enemy", "player"], when: "lives > 1",
      effects: [{ op: "add", target: "lives", value: -1 }, { op: "destroy", target: "self" }] },
    { on: "collision", between: ["enemy", "player"], when: "lives <= 1",
      effects: [{ op: "gameover" }] },
    // an enemy reaching the base = you lose
    { on: "collision", between: ["enemy", "base"], effects: [{ op: "gameover" }] },
  ],
  win: { when: "score >= 12" },
  lose: { when: "lives <= 0" },
};

// validate first (what an agent would do before saving)
const v = await (await fetch(`${BASE}/api/validate`, {
  method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ spec }),
})).json();
console.log("validate:", v.ok ? "ok" : JSON.stringify(v.errors));
if (!v.ok) process.exit(1);

const res = await fetch(`${BASE}/api/games`, {
  method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ spec, idea: spec.meta.idea }),
});
const body = await res.json();
console.log("POST", res.status, res.ok ? `\nPLAY: ${BASE}${body.url}\nid: ${body.id}` : JSON.stringify(body));
