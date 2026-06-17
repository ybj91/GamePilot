/**
 * Headless smoke test for the DSL runtime (no DOM). Run with:
 *   npm run smoke   (tsx — resolves extensionless imports like Vite does)
 *
 * Validates the parts that don't need a browser: world population, collision
 * rule firing (eat food -> grow + slow + score + respawn), gameover on enemy
 * contact, and win-condition evaluation. Exits non-zero on failure.
 */

import { World } from "./world";
import { RuleTimers, evaluateRules } from "./rules";
import { evalCondition } from "./conditions";
import { stepMovement, resolveSolids } from "./movement";
import { Input, type InputEnv } from "./input";
import { growAndSlow } from "../dsl/samples/growAndSlow";
import { validateGameSpec } from "../dsl/validate";
import type { GameSpec } from "../dsl/types";

let failures = 0;
function check(name: string, cond: boolean): void {
  if (cond) {
    console.log(`  ok   ${name}`);
  } else {
    console.error(`  FAIL ${name}`);
    failures++;
  }
}

/** Empty input env for rules that don't depend on input. */
const noInput = (): InputEnv => ({ pressed: new Set(), pointerX: 0, pointerY: 0, pointerActive: false });

// 1. sample spec is valid
const v = validateGameSpec(growAndSlow);
check("sample spec validates", v.ok);
if (!v.ok) console.error(v.errors);

// 2. world populates from spawn counts
const world = new World(growAndSlow, 1);
check("1 player spawned", world.countOf("player") === 1);
check("18 food spawned", world.countOf("food") === 18);
check("3 enemies spawned", world.countOf("enemy") === 3);

// 3. eat food: place player on top of a food dot, run a step
const player = world.firstOf("player")!;
const food = world.firstOf("food")!;
player.x = food.x;
player.y = food.y;
const sizeBefore = player.size;
const speedBefore = player.speed;
const timers = new RuleTimers();
evaluateRules(world, timers, noInput(), 1 / 60);
world.reap();
world.maintainPopulations();
check("score incremented after eating", world.score === 1);
check("player grew", player.size > sizeBefore);
check("player slowed", player.speed < speedBefore);
check("food respawned to maintain 18", world.countOf("food") === 18);

// 4. enemy contact -> gameover
const enemy = world.firstOf("enemy")!;
player.x = enemy.x;
player.y = enemy.y;
evaluateRules(world, timers, noInput(), 1 / 60);
check("gameover on enemy contact", world.status === "lost");

// 5. win condition expression
world.status = "playing";
world.score = 25;
check("win condition triggers at score>=20", evalCondition(growAndSlow.win!.when, world));

// 6. rule conditions (`when`): a shield gates whether an enemy hit ends the game.
//    Two collision rules on the same pair branch on player.shield.
const shieldSpec: GameSpec = {
  meta: { title: "Shield test" },
  world: { width: 400, height: 300, background: "#000" },
  entities: [
    { id: "player", kind: "player", shape: "circle", color: "#4aa3ff", size: 12,
      control: "none", spawn: { x: 200, y: 150 }, props: { speed: 0, shield: 0 } },
    { id: "enemy", kind: "enemy", shape: "square", color: "#ff4d4d", size: 12,
      spawn: { x: 200, y: 150 }, props: { speed: 0 } },
  ],
  rules: [
    { on: "collision", between: ["player", "enemy"], when: "player.shield <= 0",
      effects: [{ op: "gameover" }] },
    { on: "collision", between: ["player", "enemy"], when: "player.shield > 0",
      effects: [{ op: "destroy", target: "other" }, { op: "set", target: "player.shield", value: 0 }] },
  ],
};
check("shield spec validates", validateGameSpec(shieldSpec).ok);

// shield down -> the overlapping enemy ends the game
const downWorld = new World(shieldSpec, 1);
evaluateRules(downWorld, new RuleTimers(), noInput(), 1 / 60);
check("when player.shield<=0: enemy contact = gameover", downWorld.status === "lost");

// shield up -> the enemy is destroyed instead, game continues, shield consumed
const upWorld = new World(shieldSpec, 1);
upWorld.firstOf("player")!.props.shield = 1;
evaluateRules(upWorld, new RuleTimers(), noInput(), 1 / 60);
check(
  "when player.shield>0: enemy destroyed, not gameover",
  upWorld.status === "playing" && upWorld.countOf("enemy") === 0 && upWorld.firstOf("player")!.props.shield === 0,
);

// 7. input triggers + directional spawning + ttl: a click spawns a bullet at
//    the player aimed at the cursor; it travels and destroys the enemy; and a
//    stray bullet despawns via ttl.
const shooterSpec: GameSpec = {
  meta: { title: "Shooter test" },
  world: { width: 800, height: 600, background: "#000", edges: "wall" },
  entities: [
    { id: "player", kind: "player", shape: "circle", color: "#4aa3ff", size: 12,
      control: "none", spawn: { x: 100, y: 300 }, props: { speed: 0 } },
    { id: "bullet", kind: "obstacle", shape: "dot", color: "#ffffff", size: 4,
      control: "none", spawn: { count: 0 }, props: { speed: 600, ttl: 1 } },
    { id: "enemy", kind: "enemy", shape: "square", color: "#ff4d4d", size: 14,
      control: "none", spawn: { x: 500, y: 300 }, props: { speed: 0 } },
  ],
  rules: [
    { on: "input", key: "pointer",
      effects: [{ op: "spawn", target: "bullet", from: "player", aim: "pointer" }] },
    { on: "collision", between: ["bullet", "enemy"],
      effects: [{ op: "destroy", target: "self" }, { op: "destroy", target: "other" }, { op: "score", value: 1 }] },
  ],
};
check("shooter spec validates", validateGameSpec(shooterSpec).ok);

const sWorld = new World(shooterSpec, 1);
const sTimers = new RuleTimers();
const idle = new Input();
// Click while aiming at the enemy (to the right at 500,300).
const clickEnv: InputEnv = { pressed: new Set(["pointer"]), pointerX: 500, pointerY: 300, pointerActive: true };
evaluateRules(sWorld, sTimers, clickEnv, 1 / 60);
const bullet = sWorld.firstOf("bullet");
check("input click spawns a bullet", sWorld.countOf("bullet") === 1);
// muzzle offset: spawns just in front of the player (along the aim), same row
check("bullet spawns at the muzzle (in front of the player)",
  !!bullet && bullet.x > 105 && bullet.x < 130 && Math.abs(bullet.y - 300) < 1);
check("bullet aimed +x toward cursor", !!bullet && bullet.vx > 100 && Math.abs(bullet.vy) < 1);

// Advance the sim with NO further input — the bullet should reach and kill the enemy.
let killed = false;
for (let i = 0; i < 90 && sWorld.status === "playing"; i++) {
  stepMovement(sWorld, idle, 1 / 60);
  evaluateRules(sWorld, sTimers, noInput(), 1 / 60);
  sWorld.stepLifetimes(1 / 60);
  sWorld.reap();
  if (sWorld.countOf("enemy") === 0) { killed = true; break; }
}
check("bullet travels and destroys the enemy", killed && sWorld.score === 1);

// ttl: a bullet fired up (away from the enemy) despawns within its 1s lifetime.
const tWorld = new World(shooterSpec, 1);
const upEnv: InputEnv = { pressed: new Set(["pointer"]), pointerX: 100, pointerY: 0, pointerActive: true };
evaluateRules(tWorld, new RuleTimers(), upEnv, 1 / 60);
check("ttl: bullet exists right after firing", tWorld.countOf("bullet") === 1);
for (let i = 0; i < 70; i++) {
  stepMovement(tWorld, idle, 1 / 60);
  tWorld.stepLifetimes(1 / 60);
  tWorld.reap();
}
check("ttl: stray bullet despawned after ~1s", tWorld.countOf("bullet") === 0);

// 8. global variables: a `lives` counter, decremented on enemy hits, gates
//    game over. Two collision rules branch on the var.
const livesSpec: GameSpec = {
  meta: { title: "Lives test" },
  world: { width: 400, height: 300, background: "#000" },
  vars: { lives: 2 },
  entities: [
    { id: "player", kind: "player", shape: "circle", color: "#4aa3ff", size: 12,
      control: "none", spawn: { x: 200, y: 150 }, props: { speed: 0 } },
    { id: "enemy", kind: "enemy", shape: "square", color: "#ff4d4d", size: 12,
      control: "none", spawn: { x: 200, y: 150 }, props: { speed: 0 } },
  ],
  rules: [
    { on: "collision", between: ["player", "enemy"], when: "lives > 1",
      effects: [{ op: "add", target: "lives", value: -1 }, { op: "destroy", target: "other" }] },
    { on: "collision", between: ["player", "enemy"], when: "lives <= 1",
      effects: [{ op: "gameover" }] },
  ],
  lose: { when: "lives <= 0" },
};
check("lives spec validates", validateGameSpec(livesSpec).ok);
// undeclared var is rejected
check(
  "undeclared var is a validation error",
  !validateGameSpec({ ...livesSpec, vars: {} }).ok,
);

const lWorld = new World(livesSpec, 1);
check("vars initialised from spec", lWorld.getVar("lives") === 2);

// first hit: lives 2 -> 1, enemy destroyed, still playing
evaluateRules(lWorld, new RuleTimers(), noInput(), 1 / 60);
lWorld.reap();
check("hit with lives>1: lose a life, enemy gone, still playing",
  lWorld.getVar("lives") === 1 && lWorld.countOf("enemy") === 0 && lWorld.status === "playing");

// second hit: spawn a fresh enemy on the player; lives<=1 -> gameover
const e2 = lWorld.spawn("enemy")!;
e2.x = 200; e2.y = 150;
evaluateRules(lWorld, new RuleTimers(), noInput(), 1 / 60);
check("hit with lives<=1: gameover", lWorld.status === "lost");

// 9. spawn.area constrains placement — "top" enemies stay in the top band
//    (so they never spawn on a base at the bottom).
const areaSpec: GameSpec = {
  meta: { title: "Area test" },
  world: { width: 800, height: 600, background: "#000" },
  entities: [
    { id: "player", kind: "player", shape: "circle", color: "#4aa3ff", size: 12,
      control: "none", spawn: { x: 400, y: 560 }, props: { speed: 0 } },
    { id: "enemy", kind: "enemy", shape: "square", color: "#ff4d4d", size: 14,
      spawn: { area: "top", count: 20 }, props: { speed: 0 } },
  ],
  rules: [{ on: "tick", effects: [{ op: "score", value: 0 }] }],
};
check("area spec validates", validateGameSpec(areaSpec).ok);
check("invalid area is rejected",
  !validateGameSpec({ ...areaSpec, entities: [areaSpec.entities[0]!, { ...areaSpec.entities[1]!, spawn: { area: "middle" as never, count: 1 } }] }).ok);
const aWorld = new World(areaSpec, 7);
const tops = aWorld.entities.filter((e) => e.type === "enemy");
check("area:top keeps all 20 enemies in the top 18% of the world",
  tops.length === 20 && tops.every((e) => e.y <= 600 * 0.18 + 0.001));

// 10. solid obstacles block movement — a mover can't pass through a solid wall.
const wallSpec: GameSpec = {
  meta: { title: "Wall test" },
  world: { width: 400, height: 300, background: "#000" },
  entities: [
    { id: "player", kind: "player", shape: "circle", color: "#4aa3ff", size: 10,
      control: "none", spawn: { x: 150, y: 150 }, props: { speed: 300 } },
    { id: "wall", kind: "obstacle", shape: "square", color: "#888", size: 20,
      control: "none", solid: true, spawn: { x: 200, y: 150 } },
  ],
  rules: [{ on: "tick", effects: [{ op: "score", value: 0 }] }],
};
check("wall spec validates", validateGameSpec(wallSpec).ok);
check("non-boolean solid rejected",
  !validateGameSpec({ ...wallSpec, entities: [{ ...wallSpec.entities[0]!, solid: "yes" as never }, wallSpec.entities[1]!] }).ok);

// drive the player right (toward the wall at x=200) for ~1s; it must stop at the wall's left face
const wWorld = new World(wallSpec, 1);
const wp = wWorld.firstOf("player")!;
wp.vx = 300; // moving right; control "none" keeps the velocity
for (let i = 0; i < 60; i++) {
  stepMovement(wWorld, new Input(), 1 / 60);
  resolveSolids(wWorld);
}
// wall left face is at 200-20=180; player radius 10 -> player.x must be <= ~170, never past the wall
check("solid wall stops the mover at its left face", wp.x <= 171 && wp.x >= 168);

// a non-solid version lets the mover pass straight through
const openSpec: GameSpec = { ...wallSpec, entities: [wallSpec.entities[0]!, { ...wallSpec.entities[1]!, solid: false }] };
const oWorld = new World(openSpec, 1);
const op = oWorld.firstOf("player")!;
op.vx = 300;
for (let i = 0; i < 60; i++) {
  stepMovement(oWorld, new Input(), 1 / 60);
  resolveSolids(oWorld);
}
check("non-solid lets the mover pass through", op.x > 250);

// 11. heading + aim "forward": a tank fires in the direction it last moved.
const tankSpec: GameSpec = {
  meta: { title: "Heading test" },
  world: { width: 600, height: 400, background: "#000" },
  entities: [
    { id: "player", kind: "player", shape: "square", color: "#8cb33a", size: 12,
      control: "none", spawn: { x: 300, y: 200 }, props: { speed: 0 } },
    { id: "bullet", kind: "obstacle", shape: "dot", color: "#fff", size: 3,
      control: "none", spawn: { count: 0 }, props: { speed: 400, ttl: 2 } },
  ],
  rules: [{ on: "input", key: "space", effects: [{ op: "spawn", target: "bullet", from: "player", aim: "forward" }] }],
};
check("heading spec validates", validateGameSpec(tankSpec).ok);
const hWorld = new World(tankSpec, 1);
const hpl = hWorld.firstOf("player")!;
check("entity faces up by default", hpl.hx === 0 && hpl.hy === -1);
// drive right a few steps -> heading snaps to (1,0)
hpl.vx = 200; // control "none" keeps the velocity; updateHeading reads it
for (let i = 0; i < 5; i++) stepMovement(hWorld, new Input(), 1 / 60);
check("heading snaps to last movement (right)", hpl.hx === 1 && hpl.hy === 0);
// stop and press space -> bullet flies forward (+x)
hpl.vx = 0;
evaluateRules(hWorld, new RuleTimers(),
  { pressed: new Set(["space"]), pointerX: 0, pointerY: 0, pointerActive: false }, 1 / 60);
const hb = hWorld.firstOf("bullet")!;
check("aim 'forward' fires along heading (+x)", hb.vx > 100 && Math.abs(hb.vy) < 1);

// 12. wander roams (random cardinal direction, not toward a target) and changes
//     direction over time.
const wanderSpec: GameSpec = {
  meta: { title: "Wander test" },
  world: { width: 600, height: 400, background: "#000" },
  entities: [
    { id: "player", kind: "player", shape: "circle", color: "#4aa3ff", size: 8, control: "none", spawn: { x: 300, y: 200 }, props: { speed: 0 } },
    { id: "roamer", kind: "enemy", shape: "square", color: "#f55", size: 10, behavior: "wander", spawn: { x: 300, y: 200, count: 1 }, props: { speed: 60 } },
  ],
  rules: [{ on: "tick", effects: [{ op: "score", value: 0 }] }],
};
check("wander spec validates", validateGameSpec(wanderSpec).ok);
{
  const w = new World(wanderSpec, 3);
  const r = w.firstOf("roamer")!;
  const input = new Input();
  const dirs = new Set<string>();
  for (let i = 0; i < 300; i++) {
    w.time += 1 / 60; // wander re-picks against sim time
    stepMovement(w, input, 1 / 60);
    if (Math.hypot(r.vx, r.vy) > 1) dirs.add(`${Math.sign(r.vx)},${Math.sign(r.vy)}`);
  }
  // moved along a cardinal axis, and changed direction at least once over ~5s
  check("wander moves on a cardinal axis", [...dirs].every((d) => d.split(",").filter((n) => n !== "0").length === 1));
  check("wander changes direction over time", dirs.size >= 2);
}

// 13. solid bodies don't overlap: two movable solid tanks placed on top of each
//     other separate; a movable solid vs a static solid wall only moves the tank.
const bodySpec: GameSpec = {
  meta: { title: "Body test" },
  world: { width: 600, height: 400, background: "#000" },
  entities: [
    { id: "tankA", kind: "enemy", shape: "square", color: "#f55", size: 14, control: "arrows", solid: true, spawn: { x: 300, y: 200, count: 1 }, props: { speed: 50 } },
    { id: "tankB", kind: "enemy", shape: "square", color: "#5f5", size: 14, control: "arrows", solid: true, spawn: { x: 306, y: 200, count: 1 }, props: { speed: 50 } },
    { id: "wall", kind: "obstacle", shape: "square", color: "#888", size: 20, control: "none", solid: true, spawn: { x: 450, y: 200, count: 1 }, props: { speed: 0 } },
  ],
  rules: [{ on: "tick", effects: [{ op: "score", value: 0 }] }],
};
check("solid-bodies spec validates", validateGameSpec(bodySpec).ok);
{
  const w = new World(bodySpec, 1);
  const a = w.firstOf("tankA")!;
  const b = w.firstOf("tankB")!;
  const wall = w.firstOf("wall")!;
  const wx = wall.x;
  // overlapping tanks (centres 6 apart, sizes 14) -> separate to ~>= 2*size
  for (let i = 0; i < 30; i++) resolveSolids(w);
  check("two solid tanks separate (don't overlap)", Math.abs(a.x - b.x) >= a.size + b.size - 1);
  // drive tankA into the static wall -> tank stops, wall doesn't move
  a.x = wall.x - 10; a.vx = 0;
  for (let i = 0; i < 30; i++) resolveSolids(w);
  check("static wall stays put while the tank is pushed out", wall.x === wx && a.x <= wall.x - wall.size - a.size + 1);
}

// 14. glyph field validates (rendering itself needs a canvas — verified in a browser).
const glyphSpec: GameSpec = {
  meta: { title: "Glyph test" },
  world: { width: 400, height: 300, background: "#000" },
  entities: [
    { id: "player", kind: "player", shape: "square", color: "#8cb33a", size: 14, control: "arrows",
      glyph: ["..X..", ".XXX.", "XXXXX", "XXXXX", "X.X.X"], rotate: true, spawn: { x: 200, y: 150 }, props: { speed: 100 } },
  ],
  rules: [{ on: "tick", effects: [{ op: "score", value: 0 }] }],
};
check("glyph spec validates", validateGameSpec(glyphSpec).ok);
check("bad glyph rejected",
  !validateGameSpec({ ...glyphSpec, entities: [{ ...glyphSpec.entities[0]!, glyph: 42 as never }] }).ok);
{
  const gp = new World(glyphSpec, 1).firstOf("player")!;
  check("raw glyph resolves to one 5-row frame", gp.frames?.length === 1 && gp.frames[0]!.length === 5);
}

// 14b. glyph presets — a named built-in shape resolves to its frames.
const presetSpec: GameSpec = {
  ...glyphSpec,
  entities: [{ ...glyphSpec.entities[0]!, glyph: "heart" }],
};
check("preset name validates", validateGameSpec(presetSpec).ok);
check("unknown preset rejected",
  !validateGameSpec({ ...glyphSpec, entities: [{ ...glyphSpec.entities[0]!, glyph: "banana" }] }).ok);
check("preset resolves to a frame on the entity",
  (new World(presetSpec, 1).firstOf("player")!.frames?.[0]?.length ?? 0) > 0);
// a multi-frame preset (invader) animates -> more than one frame
const invaderSpec: GameSpec = { ...glyphSpec, entities: [{ ...glyphSpec.entities[0]!, glyph: "invader" }] };
check("animated preset resolves to multiple frames",
  (new World(invaderSpec, 1).firstOf("player")!.frames?.length ?? 0) >= 2);

// 14c. explicit frames + fps — GIF-like animation authored inline.
const animSpec: GameSpec = {
  ...glyphSpec,
  entities: [{ ...glyphSpec.entities[0]!, glyph: undefined,
    frames: [["X.X", ".X.", "X.X"], [".X.", "XXX", ".X."]], fps: 4 }],
};
check("frames+fps spec validates", validateGameSpec(animSpec).ok);
check("bad frames rejected",
  !validateGameSpec({ ...glyphSpec, entities: [{ ...glyphSpec.entities[0]!, frames: ["nope"] as never }] }).ok);
{
  const ap = new World(animSpec, 1).firstOf("player")!;
  check("explicit frames + fps land on the entity", ap.frames?.length === 2 && ap.fps === 4);
}

// 14d. one-shot explosion preset tied to ttl: it resolves to multiple frames,
//      carries loop:false + the captured initial ttl, and despawns via ttl.
const boomSpec: GameSpec = {
  meta: { title: "Boom test" },
  world: { width: 400, height: 300, background: "#000" },
  entities: [
    { id: "player", kind: "player", shape: "circle", color: "#4aa3ff", size: 10,
      control: "none", spawn: { x: 200, y: 150 }, props: { speed: 0 } },
    { id: "boom", kind: "effect", shape: "dot", color: "#ff9a3c", size: 18,
      control: "none", glyph: "explosion", loop: false, spawn: { count: 0 }, props: { ttl: 0.4 } },
  ],
  rules: [{ on: "tick", effects: [{ op: "score", value: 0 }] }],
};
check("explosion spec validates", validateGameSpec(boomSpec).ok);
check("non-boolean loop rejected",
  !validateGameSpec({ ...boomSpec, entities: [boomSpec.entities[0]!, { ...boomSpec.entities[1]!, loop: "no" as never }] }).ok);
{
  const w = new World(boomSpec, 1);
  const boom = w.spawn("boom")!;
  check("explosion preset is multi-frame", (boom.frames?.length ?? 0) >= 4);
  check("explosion is one-shot with its ttl captured", boom.loop === false && boom.ttl0 === 0.4);
  // run past its 0.4s life -> ttl decrements and it gets reaped
  for (let i = 0; i < 30; i++) { w.stepLifetimes(1 / 60); w.reap(); }
  check("explosion despawns after its ttl", w.countOf("boom") === 0);
}

// 14e. hit-flash: a survivable hit flashes the enemy bright, and the flash
//      timer ticks down to zero (visual only — the entity lives on).
const flashSpec: GameSpec = {
  meta: { title: "Flash test" },
  world: { width: 400, height: 300, background: "#000" },
  entities: [
    { id: "bullet", kind: "obstacle", shape: "dot", color: "#fff", size: 4,
      control: "none", spawn: { x: 200, y: 150 }, props: { speed: 0 } },
    { id: "enemy", kind: "enemy", shape: "square", color: "#d24b4b", size: 14,
      control: "none", flashColor: "#ffd23f", spawn: { x: 200, y: 150 }, props: { speed: 0, hp: 3 } },
  ],
  rules: [
    { on: "collision", between: ["bullet", "enemy"], when: "enemy.hp > 1",
      effects: [{ op: "add", target: "other.hp", value: -1 }, { op: "flash", target: "other", value: 0.2 }, { op: "destroy", target: "self" }] },
  ],
};
check("flash spec validates", validateGameSpec(flashSpec).ok);
check("flash op is accepted", validateGameSpec(flashSpec).ok);
check("bad flashColor rejected",
  !validateGameSpec({ ...flashSpec, entities: [flashSpec.entities[0]!, { ...flashSpec.entities[1]!, flashColor: 7 as never }] }).ok);
{
  const w = new World(flashSpec, 1);
  const enemy = w.firstOf("enemy")!;
  check("flashColor lands on the entity", enemy.flashColor === "#ffd23f" && enemy.flash === 0);
  // the bullet overlaps the enemy -> survivable hit flashes it
  evaluateRules(w, new RuleTimers(), noInput(), 1 / 60);
  check("survivable hit flashes the enemy (and it lives)",
    enemy.flash > 0 && enemy.alive && enemy.props.hp === 2);
  // the flash ticks down to zero over its 0.2s
  for (let i = 0; i < 15; i++) w.stepLifetimes(1 / 60);
  check("flash decays to zero, entity still alive", enemy.flash === 0 && enemy.alive);
}

// 15. tilemap: a grid of chars expands into solid walls + a player at its cell.
const mapSpec: GameSpec = {
  meta: { title: "Map test" },
  world: { background: "#000", edges: "wall", viewport: { width: 120, height: 120 } },
  entities: [
    { id: "wall", kind: "obstacle", shape: "square", color: "#888", size: 20, control: "none", solid: true, spawn: { count: 0 } },
    { id: "player", kind: "player", shape: "square", color: "#8cb33a", size: 14, control: "arrows", spawn: { count: 0 }, props: { speed: 200 } },
  ],
  rules: [{ on: "tick", effects: [{ op: "score", value: 0 }] }],
  map: {
    tile: 40,
    legend: { "#": "wall", P: "player" },
    rows: [
      "#####",
      "#P..#",
      "#.#.#",
      "#...#",
      "#####",
    ],
  },
};
check("map spec validates", validateGameSpec(mapSpec).ok);
// legend referencing an unknown entity is rejected
check("map with unknown legend entity is rejected",
  !validateGameSpec({ ...mapSpec, map: { ...mapSpec.map!, legend: { "#": "nope" } } }).ok);
{
  const w = new World(mapSpec, 1);
  // grid is 5x5 of 40px tiles -> world is 200x200
  check("map sizes the world from the grid", w.width === 200 && w.height === 200);
  // 17 '#' border/interior cells -> 17 walls; exactly one player at cell (1,1)
  check("map expands '#' cells into walls", w.countOf("wall") === 17);
  const mp = w.firstOf("player")!;
  check("map places the player at its cell centre", mp.x === 60 && mp.y === 60);
  // legend entities are placed by the grid only (player count:0 didn't pre-spawn a second one)
  check("legend entity isn't double-spawned", w.countOf("player") === 1);
}

// 16. camera: a world bigger than the viewport scrolls to follow the player and
//     clamps at the edges; an unscrolled world keeps the camera at the origin.
{
  const w = new World(mapSpec, 1); // 200x200 world, 120x120 viewport
  check("viewport is read from the spec", w.viewW === 120 && w.viewH === 120);
  const p = w.firstOf("player")!;
  // player near the top-left -> camera clamps to origin (can't scroll past 0)
  p.x = 20; p.y = 20; w.updateCamera();
  check("camera clamps at the world's top-left", w.camX === 0 && w.camY === 0);
  // player in the middle -> camera centres on it (60 = 80 - 120/2)
  p.x = 140; p.y = 140; w.updateCamera();
  check("camera centres on the player mid-world", w.camX === 80 && w.camY === 80);
  // player at the far corner -> camera clamps to the max (world - viewport = 80)
  p.x = 200; p.y = 200; w.updateCamera();
  check("camera clamps at the world's bottom-right", w.camX === 80 && w.camY === 80);
}
{
  // no viewport -> camera stays at the origin (whole world on screen)
  const w = new World(growAndSlow, 1);
  check("no viewport: camera fixed at origin", w.camX === 0 && w.camY === 0 && w.viewW === w.width);
}

if (failures > 0) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nAll smoke checks passed");
