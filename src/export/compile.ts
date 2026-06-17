/**
 * GameSpec -> standalone game COMPILER (proof of concept).
 *
 * A second backend for the DSL contract: instead of the generic runtime
 * interpreting a GameSpec at play time, this emits a single self-contained HTML
 * file that contains ONLY the code this specific game needs — entity defs and
 * rule logic inlined as literals, unused engine systems omitted, and NO import
 * of the shared GamePilot engine. The output plays offline by double-click and
 * reveals none of the reusable engine.
 *
 * Coverage (PoC): shapes, controls (follow-pointer/arrows), behaviours
 * (chase/flee/wander), spawn (x/y/random/area/count/maintain), effects
 * (add/set/mul/destroy/spawn[+from/aim]/score/win/gameover), conditions,
 * triggers (collision/tick/interval/input), vars, ttl, edges, win/lose.
 * Not yet emitted (compiler reports them): glyph/frames/flash/loop/rotate,
 * solid, map/viewport. These are mechanical to add — the point here is to prove
 * the spec can target a compiler, not just an interpreter.
 */

import type { GameSpec, EntitySpec, Effect, Rule } from "../dsl/types";

export class UnsupportedFeatureError extends Error {
  constructor(public features: string[]) {
    super("This game uses features the compiler can't emit yet:\n - " + features.join("\n - "));
    this.name = "UnsupportedFeatureError";
  }
}

const j = (v: unknown) => JSON.stringify(v);

/**
 * Coverage ledger — can the PoC compiler emit this spec, and if not, what's
 * missing? Non-throwing, so the UI/agent/discipline can ask before committing.
 * This is the "linter for the contract": when adding a DSL feature, keep this
 * honest, and if a feature is *hard* to list a clean codegen path for, treat
 * that as a DSL smell (see docs/compiler-eject.md).
 */
export function canCompile(spec: GameSpec): { ok: boolean; unsupported: string[] } {
  const bad: string[] = [];
  if (spec.map) bad.push("map (tilemap)");
  if (spec.world.viewport) bad.push("world.viewport (camera)");
  for (const e of spec.entities) {
    if (e.glyph) bad.push(`entity "${e.id}": glyph`);
    if (e.frames) bad.push(`entity "${e.id}": frames`);
    if (e.solid) bad.push(`entity "${e.id}": solid`);
    if (e.flashColor) bad.push(`entity "${e.id}": flashColor`);
  }
  for (const [i, r] of spec.rules.entries()) {
    for (const fx of r.effects) if (fx.op === "flash") bad.push(`rule[${i}]: flash effect`);
  }
  return { ok: bad.length === 0, unsupported: [...new Set(bad)] };
}

/** Reject (clearly) the features the PoC compiler doesn't emit yet. */
function assertSupported(spec: GameSpec): void {
  const { ok, unsupported } = canCompile(spec);
  if (!ok) throw new UnsupportedFeatureError(unsupported);
}

/** Compile a `when`/win/lose expression into a JS boolean expression. */
function compileCond(expr: string): string {
  const OPS = [">=", "<=", "==", "!=", ">", "<"];
  for (const op of OPS) {
    const idx = expr.indexOf(op);
    if (idx === -1) continue;
    const left = compileLeft(expr.slice(0, idx).trim());
    const right = Number(expr.slice(idx + op.length).trim());
    return `_cmp(${left}, ${j(op)}, ${right})`;
  }
  return "false";
}

function compileLeft(tok: string): string {
  if (!tok.includes(".")) return `gv(${j(tok)})`;
  const [who, prop] = tok.split(".");
  if (prop === "count") return `countOf(${j(who)})`;
  if (who === "self") return `(self ? getP(self, ${j(prop)}) : NaN)`;
  if (who === "other") return `(other ? getP(other, ${j(prop)}) : NaN)`;
  return `propOf(${j(who)}, ${j(prop!)})`;
}

/** "self"/"other"/id -> a JS expression yielding the entity (or undefined). */
function resolveEnt(token: string): string {
  if (token === "self") return "self";
  if (token === "other") return "other";
  return `firstOf(${j(token)})`;
}

/** Compile one effect into JS statements (executed with self/other in scope). */
function compileEffect(fx: Effect): string {
  switch (fx.op) {
    case "add":
    case "set":
    case "mul": {
      if (!fx.target) return "";
      const v = fx.value ?? 0;
      const apply = (cur: string) => (fx.op === "add" ? `${cur} + ${v}` : fx.op === "mul" ? `${cur} * ${v}` : `${v}`);
      if (!fx.target.includes(".")) {
        return `sv(${j(fx.target)}, ${apply(`gv(${j(fx.target)})`)});`;
      }
      const [who, prop] = fx.target.split(".");
      const e = resolveEnt(who!);
      return `{ const _e = ${e}; if (_e) setP(_e, ${j(prop!)}, ${apply(`getP(_e, ${j(prop!)})`)}); }`;
    }
    case "destroy": {
      const e = resolveEnt(fx.target ?? "self");
      return `{ const _e = ${e}; if (_e) _e.alive = false; }`;
    }
    case "spawn": {
      if (!fx.target) return "";
      const from = fx.from ? resolveEnt(fx.from) : "null";
      const aim = fx.aim ? j(fx.aim) : "null";
      return `spawnFx(${j(fx.target)}, ${from}, ${aim});`;
    }
    case "score":
      return `score += ${fx.value ?? 1};`;
    case "win":
      return `status = "won";`;
    case "gameover":
      return `status = "lost";`;
    default:
      return "";
  }
}

function compileRuleBody(r: Rule): string {
  const guard = r.when ? `if (!(${compileCond(r.when)})) ` : "";
  const body = r.effects.map(compileEffect).filter(Boolean).join(" ");
  const run = `{ ${body} }`;
  // After each effect block, bail out of effect application if the game ended.
  return guard ? `${guard}${run}` : run;
}

/** Build the inlined entity-definition table (only the fields this game sets). */
function compileDefs(entities: EntitySpec[]): string {
  const defs = entities.map((e) => {
    const d: Record<string, unknown> = {
      kind: e.kind, shape: e.shape, color: e.color, size: e.size,
      control: e.control ?? "none", spawn: e.spawn, props: { size: e.size, speed: e.props?.speed ?? 0, ...(e.props ?? {}) },
    };
    if (e.behavior) {
      const [verb, target] = e.behavior.split(":");
      d.behavior = { verb, target: target || null };
    }
    return `  ${j(e.id)}: ${j(d)}`;
  });
  return `{\n${defs.join(",\n")}\n}`;
}

export function compileGameToHtml(spec: GameSpec): string {
  assertSupported(spec);

  const title = spec.meta?.title ?? "GamePilot Game";
  const W = spec.world.width ?? 800;
  const H = spec.world.height ?? 600;
  const BG = spec.world.background ?? "#0b0b12";
  const EDGES = spec.world.edges ?? "wall";

  const controls = new Set(spec.entities.map((e) => e.control ?? "none"));
  const behaviors = new Set(spec.entities.filter((e) => e.behavior).map((e) => e.behavior!.split(":")[0]!));
  const usesArea = spec.entities.some((e) => e.spawn.area);
  const usesTtl = spec.entities.some((e) => e.props?.ttl !== undefined);

  const collisionRules = spec.rules.filter((r) => r.on === "collision");
  const tickRules = spec.rules.filter((r) => r.on === "tick");
  const inputRules = spec.rules.filter((r) => r.on === "input");
  const intervalRules = spec.rules.filter((r) => r.on === "interval");

  // ---- movement, emitted only for the controls/behaviours this game uses ----
  const move: string[] = [];
  if (controls.has("follow-pointer")) {
    move.push(`if (e.control === "follow-pointer") {
      if (pointerActive) { const dx = pointerX - e.x, dy = pointerY - e.y, d = Math.hypot(dx, dy);
        if (d > e.size * 0.5) { e.vx = dx / d * e.speed; e.vy = dy / d * e.speed; } else { e.vx = e.vy = 0; } }
      else { e.vx = e.vy = 0; }
    }`);
  }
  if (controls.has("arrows")) {
    move.push(`if (e.control === "arrows") {
      const ax = (keys.has("right")||keys.has("d")?1:0)-(keys.has("left")||keys.has("a")?1:0);
      const ay = (keys.has("down")||keys.has("s")?1:0)-(keys.has("up")||keys.has("w")?1:0);
      const L = Math.hypot(ax, ay) || 1; e.vx = ax/L*e.speed*(ax||ay?1:0); e.vy = ay/L*e.speed*(ax||ay?1:0);
    }`);
  }
  if (behaviors.has("chase") || behaviors.has("flee")) {
    move.push(`if (e.behavior && (e.behavior.verb === "chase" || e.behavior.verb === "flee")) {
      const t = firstOf(e.behavior.target); if (t) { const dx = t.x-e.x, dy = t.y-e.y, d = Math.hypot(dx,dy)||1, s = e.behavior.verb==="chase"?1:-1;
        e.vx = dx/d*e.speed*s; e.vy = dy/d*e.speed*s; } }`);
  }
  if (behaviors.has("wander")) {
    move.push(`if (e.behavior && e.behavior.verb === "wander") {
      const blocked = Math.hypot(e.x-(e.scratch.wlx??e.x), e.y-(e.scratch.wly??e.y)) < 0.5;
      if (time >= (e.scratch.wnext??0) || (blocked && time > 0.2)) {
        const dirs=[[0,-1],[0,1],[-1,0],[1,0]], dd=dirs[Math.floor(rng(0,4))]; e.scratch.wdx=dd[0]; e.scratch.wdy=dd[1]; e.scratch.wnext=time+rng(0.7,1.8); }
      e.scratch.wlx=e.x; e.scratch.wly=e.y; e.vx=(e.scratch.wdx??0)*e.speed; e.vy=(e.scratch.wdy??-1)*e.speed; }`);
  }

  // ---- collision handling: unrolled per rule, first match per pair wins ----
  const collisionBlock = collisionRules.length
    ? `for (let i = 0; i < ents.length; i++) for (let k = i + 1; k < ents.length; k++) {
      const A = ents[i], B = ents[k]; if (!A.alive || !B.alive) continue;
      if (Math.hypot(A.x - B.x, A.y - B.y) > A.size + B.size) continue;
      ${collisionRules.map((r) => {
        const [ra, rb] = r.between!;
        return `if (status === "playing") { let self, other;
        if (A.type === ${j(ra)} && B.type === ${j(rb)}) { self = A; other = B; }
        else if (A.type === ${j(rb)} && B.type === ${j(ra)}) { self = B; other = A; }
        if (self) { let _fired = true; ${r.when ? `if (!(${compileCond(r.when)})) _fired = false; else ` : ""}${`{ ${r.effects.map(compileEffect).filter(Boolean).join(" ")} }`} if (_fired) continue; } }`;
      }).join("\n      ")}
    }`
    : "";

  const tickBlock = tickRules.map((r) => `if (status === "playing") ${compileRuleBody(r)}`).join("\n    ");

  const intervalBlock = intervalRules
    .map((r, n) => `_acc[${n}] = (_acc[${n}]||0) + dt; while (_acc[${n}] >= ${r.every ?? 1}) { _acc[${n}] -= ${r.every ?? 1}; if (status === "playing") ${compileRuleBody(r)} }`)
    .join("\n    ");

  const inputBlock = inputRules
    .map((r) => `if (pressed.has(${j(r.key ?? "")}) && status === "playing") ${compileRuleBody(r)}`)
    .join("\n      ");

  const winBlock = spec.win ? `if (status === "playing" && (${compileCond(spec.win.when)})) status = "won";` : "";
  const loseBlock = spec.lose ? `if (status === "playing" && (${compileCond(spec.lose.when)})) status = "lost";` : "";

  const initVars = j({ ...(spec.vars ?? {}) });

  // ----------------------------------------------------------------- emit ----
  const script = `
const DT = 1/60, MAXSTEPS = 5;
const W = ${W}, H = ${H}, BG = ${j(BG)}, EDGES = ${j(EDGES)};
const DEFS = ${compileDefs(spec.entities)};

const game = document.getElementById("game"), hud = document.getElementById("hud");
game.width = hud.width = W; game.height = hud.height = H;
const ctx = game.getContext("2d"), hctx = hud.getContext("2d");

let _s = 12345 >>> 0;
function rnd() { _s = (Math.imul(_s, 1664525) + 1013904223) >>> 0; return _s / 4294967296; }
function rng(a, b) { return a + rnd() * (b - a); }

let ents = [], score = 0, status = "playing", time = 0, _iid = 1;
let vars = ${initVars};
const _acc = [];

function gv(n) { return n === "score" ? score : (vars[n] || 0); }
function sv(n, v) { if (n === "score") score = v; else vars[n] = v; }
function getP(e, p) { return e.props[p] || 0; }
function setP(e, p, v) { e.props[p] = v; if (p === "size") e.size = Math.max(0.5, v); if (p === "speed") e.speed = Math.max(0, v); }
function firstOf(t) { return ents.find(e => e.alive && e.type === t); }
function propOf(t, p) { const e = firstOf(t); return e ? getP(e, p) : NaN; }
function countOf(t) { let n = 0; for (const e of ents) if (e.alive && e.type === t) n++; return n; }
function nearestOf(t, x, y) { let b, bd = Infinity; for (const e of ents) { if (!e.alive || e.type !== t) continue; const d = (e.x-x)**2+(e.y-y)**2; if (d < bd) { bd = d; b = e; } } return b; }
function _cmp(a, op, b) { if (Number.isNaN(a) || Number.isNaN(b)) return false;
  return op === ">=" ? a>=b : op === "<=" ? a<=b : op === ">" ? a>b : op === "<" ? a<b : op === "==" ? a===b : a!==b; }
${usesArea ? `function areaPoint(area, m) { const rx = (lo,hi)=>rng(lo,hi); const a = area === "edges" ? ["top","bottom","left","right"][Math.floor(rng(0,4))] : area;
  if (a==="top") return {x:rx(m,W-m),y:rx(m,H*0.18)}; if (a==="bottom") return {x:rx(m,W-m),y:rx(H*0.82,H-m)};
  if (a==="left") return {x:rx(m,W*0.18),y:rx(m,H-m)}; if (a==="right") return {x:rx(W*0.82,W-m),y:rx(m,H-m)};
  if (a==="center") return {x:rx(W*0.3,W*0.7),y:rx(H*0.3,H*0.7)}; return {x:rx(m,W-m),y:rx(m,H-m)}; }` : ""}

function spawn(type) {
  const d = DEFS[type]; if (!d) return null; const m = d.size + 4; let x, y;
  ${usesArea ? `if (d.spawn.area) { const p = areaPoint(d.spawn.area, m); x = p.x; y = p.y; } else ` : ""}if (d.spawn.random) { x = rng(m, W-m); y = rng(m, H-m); }
  else { x = d.spawn.x != null ? d.spawn.x : W/2; y = d.spawn.y != null ? d.spawn.y : H/2; }
  const e = { iid: _iid++, type, kind: d.kind, shape: d.shape, color: d.color, size: d.size,
    control: d.control, behavior: d.behavior || null, x, y, vx: 0, vy: 0, hx: 0, hy: -1,
    speed: d.props.speed || 0, props: Object.assign({}, d.props), alive: true, scratch: {} };
  ents.push(e); return e;
}

function spawnFx(type, src, aim) {
  const e = spawn(type); if (!e) return;
  if (src) { e.x = src.x; e.y = src.y; }
  if (aim) {
    let dx, dy;
    if (aim === "forward" && src) { dx = src.hx; dy = src.hy; }
    else if (aim === "backward" && src) { dx = -src.hx; dy = -src.hy; }
    else if (aim === "up") { dx = 0; dy = -1; } else if (aim === "down") { dx = 0; dy = 1; }
    else if (aim === "left") { dx = -1; dy = 0; } else if (aim === "right") { dx = 1; dy = 0; }
    else if (aim === "pointer") { if (pointerActive) { const ddx = pointerX-e.x, ddy = pointerY-e.y, L = Math.hypot(ddx,ddy)||1; dx = ddx/L; dy = ddy/L; } else { dx = 0; dy = -1; } }
    else { const t = nearestOf(aim, e.x, e.y); if (t) { const ddx = t.x-e.x, ddy = t.y-e.y, L = Math.hypot(ddx,ddy)||1; dx = ddx/L; dy = ddy/L; } else { dx = 0; dy = -1; } }
    e.vx = dx * e.speed; e.vy = dy * e.speed;
    if (dx || dy) { e.hx = Math.sign(dx); e.hy = Math.sign(dy); if (src) { const off = src.size + e.size + 2; e.x += dx * off; e.y += dy * off; } }
  }
}

// initial population
for (const type in DEFS) { const c = DEFS[type].spawn.count != null ? DEFS[type].spawn.count : 1; for (let n = 0; n < c; n++) spawn(type); }

// ---- input ----
let pointerX = 0, pointerY = 0, pointerActive = false; const keys = new Set(), pressed = new Set();
function toWorld(cx, cy) { const r = game.getBoundingClientRect(); pointerX = (cx-r.left)/r.width*W; pointerY = (cy-r.top)/r.height*H; }
game.addEventListener("pointermove", ev => { toWorld(ev.clientX, ev.clientY); pointerActive = true; });
game.addEventListener("pointerdown", ev => { toWorld(ev.clientX, ev.clientY); pointerActive = true; pressed.add("pointer"); });
game.addEventListener("pointerleave", () => pointerActive = false);
function nk(k){ if(k===" ")return "space"; if(k.startsWith("Arrow"))return k.slice(5).toLowerCase(); return k.toLowerCase(); }
addEventListener("keydown", ev => { const k = nk(ev.key); if (!keys.has(k)) pressed.add(k); keys.add(k); if (k === "r") restart(); });
addEventListener("keyup", ev => keys.delete(nk(ev.key)));

function restart() { ents = []; score = 0; status = "playing"; time = 0; _iid = 1; _acc.length = 0; vars = ${initVars};
  for (const type in DEFS) { const c = DEFS[type].spawn.count != null ? DEFS[type].spawn.count : 1; for (let n = 0; n < c; n++) spawn(type); } }

function step(dt) {
  if (status !== "playing") return; time += dt;
  for (const e of ents) { if (!e.alive) continue;
    ${move.join("\n    ") || "// (no movement systems used)"}
    e.x += e.vx * dt; e.y += e.vy * dt; const m = e.size;
    ${EDGES === "wrap"
      ? `if (e.x < -m) e.x = W+m; if (e.x > W+m) e.x = -m; if (e.y < -m) e.y = H+m; if (e.y > H+m) e.y = -m;`
      : `e.x = Math.min(W-m, Math.max(m, e.x)); e.y = Math.min(H-m, Math.max(m, e.y));`}
    if (Math.hypot(e.vx, e.vy) >= 1) { if (Math.abs(e.vx) >= Math.abs(e.vy)) { e.hx = Math.sign(e.vx); e.hy = 0; } else { e.hx = 0; e.hy = Math.sign(e.vy); } }
  }
  ${inputRules.length ? `// input rules (edge-triggered)\n      ${inputBlock}` : ""}
  ${collisionBlock}
  ${tickBlock}
  ${intervalRules.length ? `// interval rules\n    ${intervalBlock}` : ""}
  pressed.clear();
  ${usesTtl ? `for (const e of ents) { if (!e.alive || e.props.ttl === undefined) continue; e.props.ttl -= dt; if (e.props.ttl <= 0) e.alive = false; }` : ""}
  if (ents.some(e => !e.alive)) ents = ents.filter(e => e.alive);
  // maintain populations
  for (const type in DEFS) { const t = DEFS[type].spawn.maintain || 0; if (t <= 0) continue; let miss = t - countOf(type); while (miss-- > 0) spawn(type); }
  ${winBlock}
  ${loseBlock}
}

function draw() {
  ctx.fillStyle = BG; ctx.fillRect(0, 0, W, H);
  for (const e of ents) { if (!e.alive) continue;
    ctx.save(); ctx.shadowColor = e.color; ctx.shadowBlur = e.shape === "dot" ? 8 : 14; ctx.fillStyle = e.color;
    if (e.shape === "square") ctx.fillRect(e.x-e.size, e.y-e.size, e.size*2, e.size*2);
    else { ctx.beginPath(); ctx.arc(e.x, e.y, e.size, 0, Math.PI*2); ctx.fill(); }
    ctx.restore();
  }
  hctx.clearRect(0, 0, W, H);
  hctx.fillStyle = "rgba(232,232,240,0.9)"; hctx.font = "600 16px system-ui, sans-serif"; hctx.textBaseline = "top";
  const fmt = v => Number.isInteger(v) ? "" + v : "" + (Math.round(v*100)/100);
  const stats = ["Score " + score].concat(Object.keys(vars).map(k => k[0].toUpperCase()+k.slice(1)+" "+fmt(vars[k]))).join("    ");
  hctx.fillText(stats, 14, 12);
  if (status !== "playing") {
    hctx.fillStyle = "rgba(7,7,13,0.62)"; hctx.fillRect(0, 0, W, H);
    hctx.textAlign = "center"; hctx.fillStyle = status === "won" ? "#7CFFB0" : "#ff8080";
    hctx.font = "700 42px system-ui, sans-serif"; hctx.fillText(status === "won" ? "YOU WIN" : "GAME OVER", W/2, H/2-30);
    hctx.fillStyle = "rgba(232,232,240,0.5)"; hctx.font = "400 14px system-ui, sans-serif"; hctx.fillText("Press R to restart", W/2, H/2+24);
    hctx.textAlign = "left";
  }
}

let last = 0, acc = 0;
function frame(now) {
  if (last === 0) last = now; let el = (now - last) / 1000; last = now; if (el > 0.25) el = 0.25;
  acc += el; let steps = 0; while (acc >= DT && steps < MAXSTEPS) { step(DT); acc -= DT; steps++; }
  draw(); requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// minimal hook for automated checks
window.game = { get score(){return score;}, get status(){return status;}, count: countOf, ents: () => ents };
`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
<style>
  html,body{margin:0;height:100%;background:#07070d;display:grid;place-items:center;font-family:system-ui,sans-serif;color:#9aa}
  .wrap{display:flex;flex-direction:column;gap:10px;align-items:center}
  h1{font:600 14px system-ui;opacity:.7;margin:0}
  .stage{display:grid}.stage canvas{grid-area:1/1;border-radius:10px}
  #hud{pointer-events:none}
  .hint{font-size:12px;opacity:.5}
</style>
</head>
<body>
  <div class="wrap">
    <h1>${escapeHtml(title)}</h1>
    <div class="stage"><canvas id="game"></canvas><canvas id="hud"></canvas></div>
    <div class="hint">mouse / arrows / WASD to play &middot; R to restart</div>
  </div>
  <script>${script}</script>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
