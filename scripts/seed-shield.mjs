// Build a playable game that exercises rule conditions (`when`): a shield
// power-up makes the next enemy hit harmless (and visibly powers you up).
const BASE = process.env.BASE || "http://localhost:4321";

const spec = {
  meta: { title: "Shield Run", idea: "eat to score; grab the cyan shield to survive one hit" },
  world: { width: 800, height: 600, background: "#0b0b12", edges: "wall" },
  entities: [
    { id: "player", kind: "player", shape: "circle", color: "#4aa3ff", size: 14,
      control: "follow-pointer", spawn: { x: 400, y: 300 }, props: { speed: 280, shield: 0 } },
    { id: "food", kind: "food", shape: "dot", color: "#ffd23f", size: 5,
      spawn: { random: true, count: 12, maintain: 12 } },
    { id: "shield", kind: "food", shape: "dot", color: "#46e6d0", size: 8,
      spawn: { random: true, count: 1, maintain: 1 } },
    { id: "enemy", kind: "enemy", shape: "square", color: "#ff4d4d", size: 13,
      behavior: "chase:player", spawn: { random: true, count: 3 }, props: { speed: 110 } },
  ],
  rules: [
    { on: "collision", between: ["player", "food"],
      effects: [{ op: "add", target: "self.size", value: 1 }, { op: "destroy", target: "other" }, { op: "score", value: 1 }] },
    // grab shield: power up (and grow as a visible cue)
    { on: "collision", between: ["player", "shield"],
      effects: [{ op: "set", target: "self.shield", value: 1 }, { op: "add", target: "self.size", value: 6 }, { op: "destroy", target: "other" }] },
    // enemy hit with no shield -> game over
    { on: "collision", between: ["player", "enemy"], when: "player.shield <= 0",
      effects: [{ op: "gameover" }] },
    // enemy hit WITH shield -> harmless: destroy the enemy, consume the shield, shrink back
    { on: "collision", between: ["player", "enemy"], when: "player.shield > 0",
      effects: [{ op: "set", target: "self.shield", value: 0 }, { op: "add", target: "self.size", value: -6 }, { op: "destroy", target: "other" }, { op: "score", value: 2 }] },
    { on: "interval", every: 12, effects: [{ op: "spawn", target: "enemy" }] },
  ],
  win: { when: "score >= 25" },
};

const res = await fetch(`${BASE}/api/games`, {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ spec, idea: spec.meta.idea }),
});
console.log("POST /api/games ->", res.status);
const body = await res.json();
if (res.ok) console.log("PLAY:", `${BASE}${body.url}`, "\nid:", body.id);
else console.log("rejected:", JSON.stringify(body));
