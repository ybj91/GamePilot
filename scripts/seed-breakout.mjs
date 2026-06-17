// Breakout — a new archetype showing the `bounce` capability (and composing it
// with the tilemap). A mouse paddle (follow-pointer-x) keeps a ball alive; the
// ball reflects off the side/top walls (edges:"bounce") and off the bricks; a
// strip of deadzone blocks along the bottom catches a missed ball (−1 life).
// Click to launch the ball. Clear all the bricks to win; 3 misses and it's over.
const BASE = process.env.BASE || "http://127.0.0.1:4321";

const COLS = 20, ROWS = 18, TILE = 32; // 640 x 576 world
const rows = [];
for (let r = 0; r < ROWS; r++) {
  if (r >= 2 && r <= 6) rows.push("#".repeat(COLS));        // 5 rows of bricks up top
  else if (r === ROWS - 1) rows.push("D".repeat(COLS));     // deadzone strip along the bottom
  else rows.push(".".repeat(COLS));                          // open play area
}

const spec = {
  meta: { title: "Breakout", idea: "bounce a ball off a paddle to break every brick; miss and you lose a life" },
  world: { background: "#0b0b12", edges: "bounce" },
  vars: { lives: 3 },
  map: { tile: TILE, legend: { "#": "brick", D: "deadzone" }, rows },
  entities: [
    { id: "brick", kind: "obstacle", shape: "square", color: "#d24b4b", size: 15, spawn: { count: 0 } },
    { id: "deadzone", kind: "obstacle", shape: "square", color: "#15151f", size: 16, control: "none", spawn: { count: 0 } },
    { id: "paddle", kind: "player", shape: "square", color: "#8cb33a", size: 28,
      control: "follow-pointer-x", spawn: { x: 320, y: 520, count: 1 }, props: { speed: 460 } },
    { id: "ball", kind: "obstacle", shape: "dot", color: "#dff0ff", size: 7,
      control: "none", spawn: { count: 0 }, props: { speed: 320 } },
  ],
  rules: [
    // click to (re)launch the ball straight up from the paddle, only if none is live
    { on: "input", key: "pointer", when: "ball.count == 0", effects: [{ op: "spawn", target: "ball", from: "paddle", aim: "up" }] },
    // ball reflects off the paddle and off bricks (bounce FIRST, then break the brick)
    { on: "collision", between: ["ball", "paddle"], effects: [{ op: "bounce" }] },
    { on: "collision", between: ["ball", "brick"], effects: [{ op: "bounce" }, { op: "destroy", target: "other" }, { op: "score", value: 1 }] },
    // a missed ball hits the bottom deadzone: lose the ball + a life
    { on: "collision", between: ["ball", "deadzone"], effects: [{ op: "destroy", target: "self" }, { op: "add", target: "lives", value: -1 }] },
  ],
  win: { when: "brick.count == 0" },
  lose: { when: "lives <= 0" },
};

const v = await (await fetch(`${BASE}/api/validate`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ spec }) })).json();
console.log("validate:", v.ok ? "ok" : JSON.stringify(v.errors));
if (!v.ok) process.exit(1);
const res = await fetch(`${BASE}/api/games`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ spec, idea: spec.meta.idea }) });
const body = await res.json();
console.log("POST", res.status, res.ok ? `\nPLAY: ${BASE}${body.url}\nid: ${body.id}` : JSON.stringify(body));
