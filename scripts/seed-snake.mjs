// Snake — an EDGE PROBE, not a polished archetype. The point is to find where
// the DSL's movement model runs out. Best approximation with today's features:
// the head drops a short-lived "trail" segment behind itself every tick (spawn
// from:head, aim:"backward", segment speed 0 so it stays put + ttl so the tail
// fades) — so the body is a path of timed ghosts, and running into one ends it.
//
// What this canNOT do with the current DSL (the findings):
//  1. No body GROWTH on eating — a spawned entity's ttl is fixed by its type;
//     it can't be tied to a "length" var, so the trail length is constant.
//  2. No auto-forward motion — `arrows` is direct velocity, so the head STOPS
//     when you release keys (real snake never stops, you only steer).
//  3. The body is a timed-ghost trail, not a true linked/path-following chain;
//     spacing depends on speed × tick, and there's no real "follow the leader".
// See the writeup printed by scripts/snake-verify.mjs.
const BASE = process.env.BASE || "http://127.0.0.1:4321";

const spec = {
  meta: { title: "Snake (edge probe)", idea: "steer a trailing snake, eat dots, don't hit your own tail" },
  world: { width: 600, height: 600, background: "#0b0b12", edges: "wrap" },
  entities: [
    { id: "head", kind: "player", shape: "square", color: "#6fcf52", size: 12,
      control: "arrows", glyph: "arrow", rotate: true, spawn: { x: 300, y: 300, count: 1 }, props: { speed: 150 } },
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
