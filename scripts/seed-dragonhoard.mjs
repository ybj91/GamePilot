// Dragon's Hoard — a fantasy collector showcasing the new 16x16 detail sprites.
// Drive the KNIGHT (arrows/WASD) to grab CHESTS while two DRAGONS chase you;
// drink a POTION for a brief shield that soaks one dragon hit. Trees + a campfire
// are solid cover. Collect 12 chests to win; a dragon hit with no shield ends it.
const BASE = process.env.BASE || "http://127.0.0.1:4321";

const spec = {
  meta: { title: "Dragon's Hoard", idea: "a knight collects treasure chests while dragons chase; drink a potion for a shield; grab 12 chests to win" },
  world: { width: 800, height: 600, background: "#1a2030", edges: "wall" },
  vars: { shield: 0 },
  entities: [
    // the knight — a 16x16 detail sprite, recolourable shield/armour read in the entity colour
    { id: "knight", kind: "player", shape: "square", color: "#c8d0d8", size: 16, control: "arrows", glyph: "knight16", spawn: { x: 400, y: 520, count: 1 }, props: { speed: 175 } },
    // treasure chests to collect (the goal). maintain keeps the field stocked.
    { id: "chest", kind: "food", shape: "square", color: "#c8902b", size: 13, glyph: "chest16", spawn: { random: true, count: 6, maintain: 6 }, props: { speed: 0 } },
    // two dragons that hunt the knight
    { id: "dragon", kind: "enemy", shape: "square", color: "#3aa54a", size: 17, behavior: "chase:knight", glyph: "dragon16", spawn: { area: "top", count: 2 }, props: { speed: 78 } },
    // a potion power-up — rare; a timer drops one only when none is on the map
    { id: "potion", kind: "food", shape: "square", color: "#a86bd6", size: 13, glyph: "potion16", spawn: { random: true, count: 0 }, props: { speed: 0 } },
    // solid scenery for cover (the knight + dragons are blocked by these)
    { id: "tree", kind: "obstacle", shape: "square", color: "#3aa54a", size: 22, control: "none", solid: true, glyph: "bigtree16", spawn: { x: 200, y: 240, count: 1 } },
    { id: "tree2", kind: "obstacle", shape: "square", color: "#3aa54a", size: 22, control: "none", solid: true, glyph: "bigtree16", spawn: { x: 600, y: 300, count: 1 } },
    { id: "fire", kind: "obstacle", shape: "square", color: "#ff7a18", size: 18, control: "none", solid: true, glyph: "campfire16", spawn: { x: 400, y: 200, count: 1 } },
  ],
  rules: [
    // collect a chest: score + restock happens via maintain
    { on: "collision", between: ["knight", "chest"], effects: [{ op: "score", value: 1 }, { op: "destroy", target: "other" }] },
    // drink a potion: gain a shield charge (and flash to show it)
    { on: "collision", between: ["knight", "potion"], effects: [{ op: "set", target: "shield", value: 1 }, { op: "flash", target: "self" }, { op: "destroy", target: "other" }] },
    // dragon hit WITH a shield: consume the shield, kill that dragon, flash — survive
    { on: "collision", between: ["knight", "dragon"], when: "shield > 0", effects: [{ op: "set", target: "shield", value: 0 }, { op: "flash", target: "self" }, { op: "destroy", target: "other" }] },
    // dragon hit with NO shield: game over
    { on: "collision", between: ["knight", "dragon"], when: "shield <= 0", effects: [{ op: "gameover" }] },
    // a potion appears every 14s, but only if none is currently out
    { on: "interval", every: 14, when: "potion.count == 0", effects: [{ op: "spawn", target: "potion" }] },
    // difficulty ramp: a fresh dragon joins every 18s
    { on: "interval", every: 18, effects: [{ op: "spawn", target: "dragon" }] },
  ],
  win: { when: "score >= 12" },
};

const v = await (await fetch(`${BASE}/api/validate`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ spec }) })).json();
console.log("validate:", v.ok ? "ok" : JSON.stringify(v.errors));
if (v.warnings?.length) console.log("warnings:", v.warnings.join(" | "));
if (!v.ok) process.exit(1);
const res = await fetch(`${BASE}/api/games`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ spec, idea: spec.meta.idea }) });
const body = await res.json();
console.log("POST", res.status, res.ok ? `\nPLAY: ${BASE}${body.url}\nid: ${body.id}` : JSON.stringify(body));
