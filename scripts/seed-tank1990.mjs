// Tank 1990 (v3, new glyph lib) — drive with ARROWS/WASD, SPACE fires the way you
// face. Recreated with the composed glyph lib: every tank TYPE is a different
// SHAPE (light/medium/heavy/artillery), recoloured per faction; destructible
// brick2 + fabric stone walls; eat the bolt (speed) and star2 (smash steel).
// Updates the canonical game in place so its /play URL stays valid.
const BASE = process.env.BASE || "http://127.0.0.1:4321";
const ID = process.env.ID || "tank-1990-076bdc";

const spec = {
  meta: { title: "Tank 1990", idea: "drive a tank (space fires the way you face); each enemy tank type is a different shape; eat the bolt to speed up and the star to smash steel; clear the field" },
  world: { width: 800, height: 600, background: "#0e1108", edges: "wall" },
  vars: { lives: 3, power: 0 },
  entities: [
    // the player drives a distinctive HERO tank (medium hull + bright insignia)
    { id: "player", kind: "player", shape: "square", color: "#8cb33a", size: 15, control: "arrows", solid: true, glyph: "tankHero", rotate: true, spawn: { x: 400, y: 520 }, props: { speed: 155 } },
    { id: "bullet", kind: "obstacle", shape: "dot", color: "#dff0ff", size: 4, control: "none", spawn: { count: 0 }, props: { speed: 470, ttl: 1.6 } },
    { id: "shell", kind: "obstacle", shape: "dot", color: "#ff8a3a", size: 4, control: "none", spawn: { count: 0 }, props: { speed: 300, ttl: 2.4 } },
    // walls: brick (destructible, recolourable v2 brick) + steel (needs a star-powered shot, fabric stone)
    { id: "brick", kind: "obstacle", shape: "square", color: "#b06a3a", size: 22, control: "none", solid: true, glyph: "brick2", spawn: { area: "center", count: 6 }, props: { speed: 0 } },
    { id: "steel", kind: "obstacle", shape: "square", color: "#9aa3b0", size: 24, control: "none", solid: true, glyph: "stone", spawn: { area: "edges", count: 3 }, props: { speed: 0 } },
    // power-ups — rare: none at start, spawned occasionally by the timers below
    { id: "bolt", kind: "food", shape: "dot", color: "#46e6d0", size: 8, spawn: { random: true, count: 0 }, props: { speed: 0 } },
    { id: "star", kind: "food", shape: "square", color: "#ffd23f", size: 11, glyph: "star2", spawn: { random: true, count: 0 }, props: { speed: 0 } },
    // FOUR enemy tank types — each a DIFFERENT SHAPE (and faction colour):
    { id: "basic", kind: "enemy", shape: "square", color: "#e2554e", size: 14, behavior: "wander", solid: true, glyph: "tankMedium", rotate: true, spawn: { area: "top", count: 2, maintain: 2 }, props: { speed: 55 } },
    { id: "fast", kind: "enemy", shape: "square", color: "#46c7d0", size: 12, behavior: "wander", solid: true, glyph: "tankLight", rotate: true, spawn: { area: "top", count: 1, maintain: 1 }, props: { speed: 115 } },
    { id: "armor", kind: "enemy", shape: "square", color: "#a86bd6", size: 16, behavior: "wander", solid: true, glyph: "tankHeavy", rotate: true, spawn: { area: "top", count: 1, maintain: 1 }, props: { speed: 42, hp: 2 } },
    { id: "arty", kind: "enemy", shape: "square", color: "#e0a23a", size: 15, behavior: "wander", solid: true, glyph: "tankArty", rotate: true, spawn: { area: "top", count: 1, maintain: 1 }, props: { speed: 35 } },
  ],
  rules: [
    { on: "input", key: "space", effects: [{ op: "spawn", target: "bullet", from: "player", aim: "forward" }] },
    // destroy enemy tanks (armor/heavy takes two hits)
    { on: "collision", between: ["bullet", "basic"], effects: [{ op: "destroy", target: "self" }, { op: "destroy", target: "other" }, { op: "score", value: 1 }] },
    { on: "collision", between: ["bullet", "fast"], effects: [{ op: "destroy", target: "self" }, { op: "destroy", target: "other" }, { op: "score", value: 1 }] },
    { on: "collision", between: ["bullet", "arty"], effects: [{ op: "destroy", target: "self" }, { op: "destroy", target: "other" }, { op: "score", value: 2 }] },
    { on: "collision", between: ["bullet", "armor"], when: "other.hp > 1", effects: [{ op: "add", target: "other.hp", value: -1 }, { op: "destroy", target: "self" }] },
    { on: "collision", between: ["bullet", "armor"], when: "other.hp <= 1", effects: [{ op: "destroy", target: "self" }, { op: "destroy", target: "other" }, { op: "score", value: 3 }] },
    // walls: brick always breaks; steel only breaks with a star-powered shot
    { on: "collision", between: ["bullet", "brick"], effects: [{ op: "destroy", target: "self" }, { op: "destroy", target: "other" }] },
    { on: "collision", between: ["shell", "brick"], effects: [{ op: "destroy", target: "self" }, { op: "destroy", target: "other" }] },
    { on: "collision", between: ["bullet", "steel"], when: "power >= 1", effects: [{ op: "destroy", target: "self" }, { op: "destroy", target: "other" }] },
    { on: "collision", between: ["bullet", "steel"], when: "power < 1", effects: [{ op: "destroy", target: "self" }] },
    { on: "collision", between: ["shell", "steel"], effects: [{ op: "destroy", target: "self" }] },
    // POWER-UPS: rare — a timer spawns one only when none is on the map
    { on: "interval", every: 20, when: "bolt.count == 0", effects: [{ op: "spawn", target: "bolt" }] },
    { on: "interval", every: 35, when: "star.count == 0", effects: [{ op: "spawn", target: "star" }] },
    // eat to enhance your tank
    { on: "collision", between: ["player", "bolt"], effects: [{ op: "add", target: "player.speed", value: 40 }, { op: "destroy", target: "other" }] },
    { on: "collision", between: ["player", "star"], effects: [{ op: "set", target: "power", value: 1 }, { op: "destroy", target: "other" }] },
    // enemy fire (artillery fires the heaviest cadence)
    { on: "interval", every: 1.4, effects: [{ op: "spawn", target: "shell", from: "basic", aim: "forward" }] },
    { on: "interval", every: 2.0, effects: [{ op: "spawn", target: "shell", from: "fast", aim: "forward" }] },
    { on: "interval", every: 2.6, effects: [{ op: "spawn", target: "shell", from: "arty", aim: "forward" }] },
    { on: "collision", between: ["shell", "player"], when: "lives > 1", effects: [{ op: "add", target: "lives", value: -1 }, { op: "destroy", target: "self" }] },
    { on: "collision", between: ["shell", "player"], when: "lives <= 1", effects: [{ op: "gameover" }] },
  ],
  win: { when: "score >= 14" },
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
