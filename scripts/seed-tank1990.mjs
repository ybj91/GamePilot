// Tank 1990 (remake, v2) — drive with ARROWS/WASD, SPACE fires the way you face.
// Composition only (no new DSL): destructible brick + indestructible steel,
// three enemy tank types, directional tank glyphs, and POWER-UPS you eat to
// enhance abilities: a bolt (speed) and a star (your shots break steel).
// Updates the canonical game in place so its /play URL stays valid.
const BASE = process.env.BASE || "http://localhost:4321";
const ID = process.env.ID || "tank-1990-076bdc";

const TANK = ["..X..", ".XXX.", "XXXXX", "XXXXX", "X.X.X"]; // tank, facing up
const STAR = [".X.", "XXX", ".X."]; // a little diamond pickup

const spec = {
  meta: { title: "Tank 1990", idea: "drive a tank, space fires the way you face; eat the bolt to speed up and the star to smash steel; clear the enemy tanks" },
  world: { width: 800, height: 600, background: "#0e1108", edges: "wall" },
  vars: { lives: 3, power: 0 },
  entities: [
    { id: "player", kind: "player", shape: "square", color: "#8cb33a", size: 13, control: "arrows", solid: true, glyph: TANK, rotate: true, spawn: { x: 400, y: 520 }, props: { speed: 155 } },
    { id: "bullet", kind: "obstacle", shape: "dot", color: "#dff0ff", size: 4, control: "none", spawn: { count: 0 }, props: { speed: 470, ttl: 1.6 } },
    { id: "shell", kind: "obstacle", shape: "dot", color: "#ff8a3a", size: 4, control: "none", spawn: { count: 0 }, props: { speed: 300, ttl: 2.4 } },
    // obstacles (single types now): brick = destructible, steel = needs a star-powered shot
    { id: "brick", kind: "obstacle", shape: "square", color: "#b06a3a", size: 22, control: "none", solid: true, spawn: { area: "center", count: 6 }, props: { speed: 0 } },
    { id: "steel", kind: "obstacle", shape: "square", color: "#9aa3b0", size: 24, control: "none", solid: true, spawn: { area: "edges", count: 3 }, props: { speed: 0 } },
    // power-ups — eat to enhance
    { id: "bolt", kind: "food", shape: "dot", color: "#46e6d0", size: 8, spawn: { random: true, count: 1, maintain: 1 }, props: { speed: 0 } },
    { id: "star", kind: "food", shape: "square", color: "#ffd23f", size: 9, glyph: STAR, spawn: { random: true, count: 1, maintain: 1 }, props: { speed: 0 } },
    // three enemy tank types
    { id: "basic", kind: "enemy", shape: "square", color: "#e2554e", size: 13, behavior: "wander", solid: true, glyph: TANK, rotate: true, spawn: { area: "top", count: 2, maintain: 2 }, props: { speed: 55 } },
    { id: "fast", kind: "enemy", shape: "square", color: "#46c7d0", size: 12, behavior: "wander", solid: true, glyph: TANK, rotate: true, spawn: { area: "top", count: 1, maintain: 1 }, props: { speed: 110 } },
    { id: "armor", kind: "enemy", shape: "square", color: "#a86bd6", size: 15, behavior: "wander", solid: true, glyph: TANK, rotate: true, spawn: { area: "top", count: 1, maintain: 1 }, props: { speed: 42, hp: 2 } },
  ],
  rules: [
    { on: "input", key: "space", effects: [{ op: "spawn", target: "bullet", from: "player", aim: "forward" }] },
    // destroy enemy tanks (armor takes two hits)
    { on: "collision", between: ["bullet", "basic"], effects: [{ op: "destroy", target: "self" }, { op: "destroy", target: "other" }, { op: "score", value: 1 }] },
    { on: "collision", between: ["bullet", "fast"], effects: [{ op: "destroy", target: "self" }, { op: "destroy", target: "other" }, { op: "score", value: 1 }] },
    { on: "collision", between: ["bullet", "armor"], when: "other.hp > 1", effects: [{ op: "add", target: "other.hp", value: -1 }, { op: "destroy", target: "self" }] },
    { on: "collision", between: ["bullet", "armor"], when: "other.hp <= 1", effects: [{ op: "destroy", target: "self" }, { op: "destroy", target: "other" }, { op: "score", value: 3 }] },
    // walls: brick always breaks; steel only breaks with a star-powered shot
    { on: "collision", between: ["bullet", "brick"], effects: [{ op: "destroy", target: "self" }, { op: "destroy", target: "other" }] },
    { on: "collision", between: ["shell", "brick"], effects: [{ op: "destroy", target: "self" }, { op: "destroy", target: "other" }] },
    { on: "collision", between: ["bullet", "steel"], when: "power >= 1", effects: [{ op: "destroy", target: "self" }, { op: "destroy", target: "other" }] },
    { on: "collision", between: ["bullet", "steel"], when: "power < 1", effects: [{ op: "destroy", target: "self" }] },
    { on: "collision", between: ["shell", "steel"], effects: [{ op: "destroy", target: "self" }] },
    // POWER-UPS: eat to enhance your tank
    { on: "collision", between: ["player", "bolt"], effects: [{ op: "add", target: "player.speed", value: 40 }, { op: "destroy", target: "other" }] },
    { on: "collision", between: ["player", "star"], effects: [{ op: "set", target: "power", value: 1 }, { op: "destroy", target: "other" }] },
    // enemy fire
    { on: "interval", every: 1.4, effects: [{ op: "spawn", target: "shell", from: "basic", aim: "forward" }] },
    { on: "interval", every: 2.0, effects: [{ op: "spawn", target: "shell", from: "fast", aim: "forward" }] },
    { on: "collision", between: ["shell", "player"], when: "lives > 1", effects: [{ op: "add", target: "lives", value: -1 }, { op: "destroy", target: "self" }] },
    { on: "collision", between: ["shell", "player"], when: "lives <= 1", effects: [{ op: "gameover" }] },
  ],
  win: { when: "score >= 12" },
  lose: { when: "lives <= 0" },
};

const v = await (await fetch(`${BASE}/api/validate`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ spec }) })).json();
console.log("validate:", v.ok ? "ok" : JSON.stringify(v.errors));
if (!v.ok) process.exit(1);
// update in place (keep the URL); fall back to create if it doesn't exist
let res = await fetch(`${BASE}/api/games/${ID}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ spec, idea: spec.meta.idea }) });
if (res.status === 404) res = await fetch(`${BASE}/api/games`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ spec, idea: spec.meta.idea }) });
const body = await res.json();
console.log(res.status, res.ok ? `\nPLAY: ${BASE}/play/${body.id}` : JSON.stringify(body));
