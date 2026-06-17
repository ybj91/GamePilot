// Snake — full classic loop now. The `runner` control moves the head forward on
// its own (you only STEER, no reversal into your trail). The body is a path of
// segments dropped behind the head; and it GROWS as you eat: each segment's
// lifetime is taken from a `length` var (spawn ttlFrom:"length"), and eating a
// dot raises `length`, so the body lengthens. Run into your own trail -> over.
const BASE = process.env.BASE || "http://127.0.0.1:4321";

const spec = {
  meta: { title: "Snake", idea: "a growing snake: steer to eat dots, get longer, don't hit your own tail" },
  world: { width: 600, height: 600, background: "#0b0b12", edges: "wrap" },
  vars: { length: 0.5 }, // trail lifetime in seconds == body length; grows on eating
  entities: [
    { id: "head", kind: "player", shape: "square", color: "#6fcf52", size: 12,
      control: "runner", glyph: "arrow", rotate: true, spawn: { x: 300, y: 300, count: 1 }, props: { speed: 150 } },
    // the body: static (speed 0) segments dropped behind the head; ttl set per-spawn from `length`
    { id: "seg", kind: "obstacle", shape: "square", color: "#3fa34d", size: 9,
      control: "none", spawn: { count: 0 }, props: { speed: 0 } },
    { id: "food", kind: "food", shape: "dot", color: "#ffd23f", size: 8,
      spawn: { random: true, count: 1, maintain: 1 }, props: { speed: 0 } },
  ],
  rules: [
    // drop a body segment just behind the head every 80ms, its ttl = current length
    { on: "interval", every: 0.08, effects: [{ op: "spawn", target: "seg", from: "head", aim: "backward", ttlFrom: "length" }] },
    // eat a dot: score + GROW the body (longer trail lifetime)
    { on: "collision", between: ["head", "food"], effects: [{ op: "score", value: 1 }, { op: "add", target: "length", value: 0.35 }, { op: "destroy", target: "other" }] },
    // run into your own trail -> game over
    { on: "collision", between: ["head", "seg"], effects: [{ op: "gameover" }] },
  ],
  win: { when: "score >= 20" },
};

const v = await (await fetch(`${BASE}/api/validate`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ spec }) })).json();
console.log("validate:", v.ok ? "ok" : JSON.stringify(v.errors));
if (!v.ok) process.exit(1);
const res = await fetch(`${BASE}/api/games`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ spec, idea: spec.meta.idea }) });
const body = await res.json();
console.log("POST", res.status, res.ok ? `\nPLAY: ${BASE}${body.url}\nid: ${body.id}` : JSON.stringify(body));
