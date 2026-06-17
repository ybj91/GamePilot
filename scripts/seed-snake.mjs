// Snake / Tron light-cycle — now using the `runner` control, so the head moves
// forward on its own and you only STEER (no reversal into your own trail). The
// body is a path of short-lived segments dropped behind the head (spawn
// from:head, aim:"backward", segment speed 0 so it stays put + ttl so the tail
// fades); running into one ends it.
//
// One known edge remains: the body length is FIXED — a spawned segment's ttl is
// set by its type and can't grow when you eat (true Snake growth needs a new
// primitive; see docs/extending-the-dsl.md). This plays as Tron / fixed-length
// snake. (The auto-forward edge is now SOLVED by `runner`.)
const BASE = process.env.BASE || "http://127.0.0.1:4321";

const spec = {
  meta: { title: "Snake / Light-cycle", idea: "a constant-forward snake: steer to eat dots and avoid your own trail" },
  world: { width: 600, height: 600, background: "#0b0b12", edges: "wrap" },
  entities: [
    { id: "head", kind: "player", shape: "square", color: "#6fcf52", size: 12,
      control: "runner", glyph: "arrow", rotate: true, spawn: { x: 300, y: 300, count: 1 }, props: { speed: 150 } },
    // the body: static (speed 0) segments dropped behind the head, fading after ttl
    { id: "seg", kind: "obstacle", shape: "square", color: "#3fa34d", size: 9,
      control: "none", spawn: { count: 0 }, props: { speed: 0, ttl: 1.6 } },
    { id: "food", kind: "food", shape: "dot", color: "#ffd23f", size: 8,
      spawn: { random: true, count: 1, maintain: 1 }, props: { speed: 0 } },
  ],
  rules: [
    // drop a body segment just behind the head every 80ms (aim backward => placed
    // behind via the muzzle offset; speed 0 => it stays where it's dropped)
    { on: "interval", every: 0.08, effects: [{ op: "spawn", target: "seg", from: "head", aim: "backward" }] },
    { on: "collision", between: ["head", "food"], effects: [{ op: "score", value: 1 }, { op: "destroy", target: "other" }] },
    // run into your own trail -> game over
    { on: "collision", between: ["head", "seg"], effects: [{ op: "gameover" }] },
  ],
  win: { when: "score >= 15" },
  lose: { when: "score < 0" },
};

const v = await (await fetch(`${BASE}/api/validate`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ spec }) })).json();
console.log("validate:", v.ok ? "ok" : JSON.stringify(v.errors));
if (!v.ok) process.exit(1);
const res = await fetch(`${BASE}/api/games`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ spec, idea: spec.meta.idea }) });
const body = await res.json();
console.log("POST", res.status, res.ok ? `\nPLAY: ${BASE}${body.url}\nid: ${body.id}` : JSON.stringify(body));
