// Tank 1990 (v4) — drive ARROWS/WASD, SPACE fires the way you face. Recreated
// with the composed glyph lib + fixes:
//  - walls are placed on a TILEMAP grid (a fort layout) so they never overlap.
//  - tanks are NON-SOLID (walls stay solid): a solid square's AABB corners reach
//    past its hit circle, so a solid tank used to DEFLECT bullets / SHOVE pickups
//    at the corners instead of registering the hit. Non-solid tanks are still
//    blocked by the solid walls (pushed out), so they can't drive through them.
//  - every tank type is the SAME SIZE (shape tells them apart, not scale).
//  - hit FLASH on a tank that survives, and an EXPLOSION burst on every kill.
// Updates the canonical game in place so its /play URL stays valid.
const BASE = process.env.BASE || "http://127.0.0.1:4321";
const ID = process.env.ID || "tank-1990-076bdc";

// --- fort layout on a 20x15 grid of 40px tiles (800x600). '#'=brick, 'S'=steel.
// Top two rows (enemy spawn) and bottom two (player) stay clear. Symmetric cover.
const COLS = 20, ROWS = 15, TILE = 40;
const g = Array.from({ length: ROWS }, () => Array(COLS).fill("."));
const put = (c, r, ch) => { if (r >= 0 && r < ROWS && c >= 0 && c < COLS) g[r][c] = ch; };
const block = (c, r, w, h, ch) => { for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) put(c + x, r + y, ch); };
block(3, 3, 2, 2, "#"); block(15, 3, 2, 2, "#");   // upper corner bunkers
block(8, 4, 4, 2, "#");                            // upper center wall
block(9, 3, 2, 1, "S");                            // steel cap over center
block(2, 6, 2, 2, "#"); block(16, 6, 2, 2, "#");   // mid side bunkers
block(0, 7, 1, 1, "S"); block(19, 7, 1, 1, "S");   // steel edge pillars
block(8, 9, 4, 2, "#");                            // lower center wall
block(9, 11, 2, 1, "S");                           // steel under center
block(3, 10, 2, 2, "#"); block(15, 10, 2, 2, "#"); // lower corner bunkers
const rows = g.map((r) => r.join(""));

const spec = {
  meta: { title: "Tank 1990", idea: "drive a tank (space fires the way you face); each enemy tank type is a different shape; brick/steel fort; eat the bolt to speed up and the star to smash steel; clear the field" },
  world: { background: "#0e1108", edges: "wall" },
  vars: { lives: 3, power: 0 },
  map: { tile: TILE, legend: { "#": "brick", S: "steel" }, rows },
  entities: [
    // the player drives a distinctive HERO tank (medium hull + bright insignia).
    // NON-solid: blocked by solid walls (pushed out), but won't shove pickups.
    { id: "player", kind: "player", shape: "square", color: "#8cb33a", size: 15, control: "arrows", glyph: "tankHero", rotate: true, spawn: { x: 400, y: 560 }, props: { speed: 150 } },
    { id: "bullet", kind: "obstacle", shape: "dot", color: "#dff0ff", size: 4, control: "none", spawn: { count: 0 }, props: { speed: 460, ttl: 1.6 } },
    { id: "shell", kind: "obstacle", shape: "dot", color: "#ff8a3a", size: 4, control: "none", spawn: { count: 0 }, props: { speed: 300, ttl: 2.4 } },
    // walls — placed by the map grid (count:0; never overlap). brick breaks; steel
    // needs a star-powered shot. Recolourable brick2 + fabric stone dressing.
    { id: "brick", kind: "obstacle", shape: "square", color: "#b06a3a", size: 18, control: "none", solid: true, glyph: "brick2", spawn: { count: 0 } },
    { id: "steel", kind: "obstacle", shape: "square", color: "#9aa3b0", size: 19, control: "none", solid: true, glyph: "stone", spawn: { count: 0 } },
    // explosion burst (effect): plays once over its short ttl, then vanishes.
    { id: "boom", kind: "effect", shape: "dot", color: "#ff9a3c", size: 17, control: "none", glyph: "explosion2", loop: false, spawn: { count: 0 }, props: { ttl: 0.45 } },
    // power-ups — rare: none at start, spawned occasionally by the timers below
    { id: "bolt", kind: "food", shape: "dot", color: "#46e6d0", size: 9, spawn: { random: true, count: 0 }, props: { speed: 0 } },
    { id: "star", kind: "food", shape: "square", color: "#ffd23f", size: 12, glyph: "star2", spawn: { random: true, count: 0 }, props: { speed: 0 } },
    // FOUR enemy tank types — each a DIFFERENT SHAPE (and faction colour), SAME SIZE.
    // solid:true so they block each other + the player; bullets still hit cleanly
    // (flying projectiles pass through solids and are handled by the rules).
    { id: "basic", kind: "enemy", shape: "square", color: "#e2554e", size: 15, behavior: "wander", solid: true, glyph: "tankMedium", rotate: true, spawn: { area: "top", count: 2, maintain: 2 }, props: { speed: 55 } },
    { id: "fast", kind: "enemy", shape: "square", color: "#46c7d0", size: 15, behavior: "wander", solid: true, glyph: "tankLight", rotate: true, spawn: { area: "top", count: 1, maintain: 1 }, props: { speed: 110 } },
    { id: "armor", kind: "enemy", shape: "square", color: "#a86bd6", size: 15, behavior: "wander", solid: true, glyph: "tankHeavy", rotate: true, spawn: { area: "top", count: 1, maintain: 1 }, props: { speed: 42, hp: 2 } },
    { id: "arty", kind: "enemy", shape: "square", color: "#e0a23a", size: 15, behavior: "wander", solid: true, glyph: "tankArty", rotate: true, spawn: { area: "top", count: 1, maintain: 1 }, props: { speed: 35 } },
  ],
  rules: [
    { on: "input", key: "space", effects: [{ op: "spawn", target: "bullet", from: "player", aim: "forward" }] },
    // destroy enemy tanks — spawn a boom at the kill, then remove it (armor/heavy
    // takes two hits and FLASHES on the survived hit).
    { on: "collision", between: ["bullet", "basic"], effects: [{ op: "spawn", target: "boom", from: "other" }, { op: "destroy", target: "self" }, { op: "destroy", target: "other" }, { op: "score", value: 1 }] },
    { on: "collision", between: ["bullet", "fast"], effects: [{ op: "spawn", target: "boom", from: "other" }, { op: "destroy", target: "self" }, { op: "destroy", target: "other" }, { op: "score", value: 1 }] },
    { on: "collision", between: ["bullet", "arty"], effects: [{ op: "spawn", target: "boom", from: "other" }, { op: "destroy", target: "self" }, { op: "destroy", target: "other" }, { op: "score", value: 2 }] },
    { on: "collision", between: ["bullet", "armor"], when: "other.hp > 1", effects: [{ op: "add", target: "other.hp", value: -1 }, { op: "flash", target: "other" }, { op: "destroy", target: "self" }] },
    { on: "collision", between: ["bullet", "armor"], when: "other.hp <= 1", effects: [{ op: "spawn", target: "boom", from: "other" }, { op: "destroy", target: "self" }, { op: "destroy", target: "other" }, { op: "score", value: 3 }] },
    // walls: brick always breaks (with a little boom); steel needs a star-powered shot
    { on: "collision", between: ["bullet", "brick"], effects: [{ op: "spawn", target: "boom", from: "other" }, { op: "destroy", target: "self" }, { op: "destroy", target: "other" }] },
    { on: "collision", between: ["shell", "brick"], effects: [{ op: "destroy", target: "self" }, { op: "destroy", target: "other" }] },
    { on: "collision", between: ["bullet", "steel"], when: "power >= 1", effects: [{ op: "spawn", target: "boom", from: "other" }, { op: "destroy", target: "self" }, { op: "destroy", target: "other" }] },
    { on: "collision", between: ["bullet", "steel"], when: "power < 1", effects: [{ op: "destroy", target: "self" }] },
    { on: "collision", between: ["shell", "steel"], effects: [{ op: "destroy", target: "self" }] },
    // POWER-UPS: rare — a timer spawns one only when none is on the map
    { on: "interval", every: 20, when: "bolt.count == 0", effects: [{ op: "spawn", target: "bolt" }] },
    { on: "interval", every: 35, when: "star.count == 0", effects: [{ op: "spawn", target: "star" }] },
    // eat to enhance your tank
    { on: "collision", between: ["player", "bolt"], effects: [{ op: "add", target: "player.speed", value: 35 }, { op: "destroy", target: "other" }] },
    { on: "collision", between: ["player", "star"], effects: [{ op: "set", target: "power", value: 1 }, { op: "flash", target: "player" }, { op: "destroy", target: "other" }] },
    // enemy fire
    { on: "interval", every: 1.4, effects: [{ op: "spawn", target: "shell", from: "basic", aim: "forward" }] },
    { on: "interval", every: 2.0, effects: [{ op: "spawn", target: "shell", from: "fast", aim: "forward" }] },
    { on: "interval", every: 2.6, effects: [{ op: "spawn", target: "shell", from: "arty", aim: "forward" }] },
    // a hit you survive FLASHES the player; the last one ends it (with a boom)
    { on: "collision", between: ["shell", "player"], when: "lives > 1", effects: [{ op: "add", target: "lives", value: -1 }, { op: "flash", target: "other" }, { op: "destroy", target: "self" }] },
    { on: "collision", between: ["shell", "player"], when: "lives <= 1", effects: [{ op: "spawn", target: "boom", from: "other" }, { op: "gameover" }] },
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
