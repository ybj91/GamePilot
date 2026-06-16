// Tank 1990 (remake) — drive with ARROWS/WASD, SPACE fires the way you face.
// Demonstrates composition (no new DSL): two obstacle types (destructible brick
// + indestructible steel) and three enemy tank types (basic, fast, armor) — all
// just entities + rules.
const BASE = process.env.BASE || "http://localhost:4321";

const brick = (id, x, y) => ({ id, kind: "obstacle", shape: "square", color: "#b06a3a", size: 22, control: "none", solid: true, spawn: { x, y, count: 1 }, props: { speed: 0 } });
const steel = (id, x, y) => ({ id, kind: "obstacle", shape: "square", color: "#9aa3b0", size: 24, control: "none", solid: true, spawn: { x, y, count: 1 }, props: { speed: 0 } });

const spec = {
  meta: { title: "Tank 1990", idea: "drive a tank, space fires the way you face; destroy red/cyan/armor tanks through brick and steel walls" },
  world: { width: 800, height: 600, background: "#0e1108", edges: "wall" },
  vars: { lives: 3 },
  entities: [
    { id: "player", kind: "player", shape: "square", color: "#8cb33a", size: 13, control: "arrows", spawn: { x: 400, y: 520 }, props: { speed: 155 } },
    { id: "bullet", kind: "obstacle", shape: "dot", color: "#dff0ff", size: 4, control: "none", spawn: { count: 0 }, props: { speed: 470, ttl: 1.6 } },
    { id: "shell", kind: "obstacle", shape: "dot", color: "#ff8a3a", size: 4, control: "none", spawn: { count: 0 }, props: { speed: 300, ttl: 2.4 } },
    // obstacles: destructible brick + indestructible steel
    brick("b1", 280, 270), brick("b2", 330, 270), brick("b3", 380, 270),
    brick("b4", 300, 440), brick("b5", 520, 440), brick("b6", 540, 300),
    steel("s1", 170, 200), steel("s2", 630, 210), steel("s3", 410, 400),
    // three enemy tank types
    { id: "basic", kind: "enemy", shape: "square", color: "#e2554e", size: 13, behavior: "chase:player", spawn: { area: "top", count: 2, maintain: 2 }, props: { speed: 55 } },
    { id: "fast", kind: "enemy", shape: "square", color: "#46c7d0", size: 12, behavior: "chase:player", spawn: { area: "top", count: 1, maintain: 1 }, props: { speed: 110 } },
    { id: "armor", kind: "enemy", shape: "square", color: "#a86bd6", size: 15, behavior: "chase:player", spawn: { area: "top", count: 1, maintain: 1 }, props: { speed: 42, hp: 2 } },
  ],
  rules: [
    { on: "input", key: "space", effects: [{ op: "spawn", target: "bullet", from: "player", aim: "forward" }] },
    // destroy enemy tanks (armor takes two hits)
    { on: "collision", between: ["bullet", "basic"], effects: [{ op: "destroy", target: "self" }, { op: "destroy", target: "other" }, { op: "score", value: 1 }] },
    { on: "collision", between: ["bullet", "fast"], effects: [{ op: "destroy", target: "self" }, { op: "destroy", target: "other" }, { op: "score", value: 1 }] },
    { on: "collision", between: ["bullet", "armor"], when: "other.hp > 1", effects: [{ op: "add", target: "other.hp", value: -1 }, { op: "destroy", target: "self" }] },
    { on: "collision", between: ["bullet", "armor"], when: "other.hp <= 1", effects: [{ op: "destroy", target: "self" }, { op: "destroy", target: "other" }, { op: "score", value: 3 }] },
    // brick is destructible; steel stops shots but survives
    { on: "collision", between: ["bullet", "b1"], effects: [{ op: "destroy", target: "self" }, { op: "destroy", target: "other" }] },
    { on: "collision", between: ["bullet", "b2"], effects: [{ op: "destroy", target: "self" }, { op: "destroy", target: "other" }] },
    { on: "collision", between: ["bullet", "b3"], effects: [{ op: "destroy", target: "self" }, { op: "destroy", target: "other" }] },
    { on: "collision", between: ["bullet", "b4"], effects: [{ op: "destroy", target: "self" }, { op: "destroy", target: "other" }] },
    { on: "collision", between: ["bullet", "b5"], effects: [{ op: "destroy", target: "self" }, { op: "destroy", target: "other" }] },
    { on: "collision", between: ["bullet", "b6"], effects: [{ op: "destroy", target: "self" }, { op: "destroy", target: "other" }] },
    { on: "collision", between: ["bullet", "s1"], effects: [{ op: "destroy", target: "self" }] },
    { on: "collision", between: ["bullet", "s2"], effects: [{ op: "destroy", target: "self" }] },
    { on: "collision", between: ["bullet", "s3"], effects: [{ op: "destroy", target: "self" }] },
    // enemy fire (forward, i.e. toward you as they advance)
    { on: "interval", every: 1.4, effects: [{ op: "spawn", target: "shell", from: "basic", aim: "forward" }] },
    { on: "interval", every: 2.0, effects: [{ op: "spawn", target: "shell", from: "fast", aim: "forward" }] },
    // their shells cost you a life
    { on: "collision", between: ["shell", "player"], when: "lives > 1", effects: [{ op: "add", target: "lives", value: -1 }, { op: "destroy", target: "self" }] },
    { on: "collision", between: ["shell", "player"], when: "lives <= 1", effects: [{ op: "gameover" }] },
  ],
  win: { when: "score >= 12" },
  lose: { when: "lives <= 0" },
};

const v = await (await fetch(`${BASE}/api/validate`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ spec }) })).json();
console.log("validate:", v.ok ? "ok" : JSON.stringify(v.errors));
if (!v.ok) process.exit(1);
const res = await fetch(`${BASE}/api/games`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ spec, idea: spec.meta.idea }) });
const body = await res.json();
console.log("POST", res.status, res.ok ? `\nPLAY: ${BASE}${body.url}\nid: ${body.id}` : JSON.stringify(body));
