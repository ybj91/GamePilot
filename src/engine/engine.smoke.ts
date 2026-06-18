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
import { DSL_VERSION, parseVersion, isVersionSupported } from "../dsl/version";
import { GLYPH_PRESET_NAMES, COMPOSED_PRESET_NAMES, GLYPH_V2_OF, resolveParts } from "../dsl/glyphs";
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
// platformer glyph set
check("platformer + nature presets validate",
  ["hero", "coin", "brick", "flag", "goomba", "tree", "flower", "cloud", "sun", "house", "crown"].every(
    (g) => validateGameSpec({ ...glyphSpec, entities: [{ ...glyphSpec.entities[0]!, glyph: g }] }).ok));
check("animated goomba resolves to multiple frames",
  (new World({ ...glyphSpec, entities: [{ ...glyphSpec.entities[0]!, glyph: "goomba" }] }, 1).firstOf("player")!.frames?.length ?? 0) >= 2);

// 14f. composed multi-colour glyphs (parts) + composed presets.
{
  const partsSpec: GameSpec = {
    ...glyphSpec,
    entities: [{ ...glyphSpec.entities[0]!, glyph: undefined, parts: [
      { glyph: ["..X..", ".XXX.", "XXXXX"], color: "#7a4a23" },  // inline layer
      { glyph: "tree", color: "#2e8b3d" },                        // reuse a preset, recoloured
    ] }],
  };
  check("parts spec validates (inline rows + preset reuse + colours)", validateGameSpec(partsSpec).ok);
  const pe = new World(partsSpec, 1).firstOf("player")!;
  check("parts resolve to coloured layers (one frame, two layers)",
    pe.parts?.length === 1 && pe.parts[0]!.length === 2 && pe.parts[0]![1]!.color === "#2e8b3d");
  check("a composed glyph carries no monochrome frames", pe.frames === undefined);
}
check("composed preset name validates", validateGameSpec({ ...glyphSpec, entities: [{ ...glyphSpec.entities[0]!, glyph: "pinetree" }] }).ok);
check("a composed preset resolves to layers",
  ((new World({ ...glyphSpec, entities: [{ ...glyphSpec.entities[0]!, glyph: "pinetree" }] }, 1).firstOf("player")!.parts?.[0]?.length) ?? 0) >= 2);
// an animated composed preset (invader2) resolves to multiple frames of layers
check("an animated composed preset has multiple frames",
  (new World({ ...glyphSpec, entities: [{ ...glyphSpec.entities[0]!, glyph: "invader2" }] }, 1).firstOf("player")!.parts?.length ?? 0) >= 2);
check("bad parts rejected (unknown preset string)",
  !validateGameSpec({ ...glyphSpec, entities: [{ ...glyphSpec.entities[0]!, parts: [{ glyph: "nope" }] }] }).ok);

// 14g. tile-grid glyph: several tiles compose one big sprite on a single entity.
{
  const tileSpec: GameSpec = {
    ...glyphSpec,
    entities: [{ ...glyphSpec.entities[0]!, glyph: undefined, tiles: [
      ["brick", "brick", "brick"],
      ["brick", { glyph: "flag", color: "#e23d3d" }, "brick"],
      ["brick", ".", "brick"],
    ] }],
  };
  check("tiles spec validates (preset cells + {glyph,color} + gap)", validateGameSpec(tileSpec).ok);
  const te = new World(tileSpec, 1).firstOf("player")!;
  check("tiles resolve to a 3x3 grid (one entity)", te.tiles?.length === 3 && te.tiles[0]!.length === 3);
  check("a coloured tile keeps its colour; a '.' cell is a gap",
    te.tiles![1]![1]![0]!.color === "#e23d3d" && te.tiles![2]![1] === null);
  check("a tile-grid glyph carries no parts/frames", te.parts === undefined && te.frames === undefined);
}
// a tile cell may BE a composed (v2) glyph; the cell's colour recolours its
// colour-less base layer while fixed accent layers keep theirs.
{
  const recolorSpec: GameSpec = {
    ...glyphSpec,
    entities: [{ ...glyphSpec.entities[0]!, glyph: undefined, tiles: [[{ glyph: "brick2", color: "#9aa0aa" }]] }],
  };
  check("a v2 glyph works as a tile cell", validateGameSpec(recolorSpec).ok);
  const re = new World(recolorSpec, 1).firstOf("player")!;
  const cell = re.tiles![0]![0]!;
  check("a recoloured v2 tile: base inherits cell colour, accent keeps its own",
    cell.length === 2 && cell[0]!.color === "#9aa0aa" && cell[1]!.color === "#6b3a1a");
}
check("bad tiles rejected (unknown preset cell)",
  !validateGameSpec({ ...glyphSpec, entities: [{ ...glyphSpec.entities[0]!, tiles: [["brick", "nope"]] }] }).ok);
// fabric material tiles are recolourable single-layer presets
check("a fabric tile (brickwork) is a known single-layer preset",
  validateGameSpec({ ...glyphSpec, entities: [{ ...glyphSpec.entities[0]!, glyph: "brickwork" }] }).ok);
// every composed preset is well-formed, and the v1->v2 map points at real presets
check("every composed preset resolves to >=1 frame with >=1 layer",
  COMPOSED_PRESET_NAMES.every((n) => { const f = resolveParts(n); return !!f && f.length >= 1 && f.every((fr) => fr.length >= 1); }));
check("v1->v2 remake map is consistent (v1 mono exists, v2 composed exists)",
  Object.entries(GLYPH_V2_OF).every(([v1, v2]) => GLYPH_PRESET_NAMES.includes(v1) && COMPOSED_PRESET_NAMES.includes(v2)));

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

// 17. bounce archetype: a ball reflects off a brick (bounce effect), off the
//     side walls (edges:"bounce"), and a follow-pointer-x paddle tracks the
//     cursor's X only.
const breakoutSpec: GameSpec = {
  meta: { title: "Breakout test" },
  world: { width: 400, height: 400, background: "#000", edges: "bounce" },
  vars: { lives: 3 },
  entities: [
    { id: "paddle", kind: "player", shape: "square", color: "#8cb33a", size: 20,
      control: "follow-pointer-x", spawn: { x: 200, y: 370 }, props: { speed: 400 } },
    { id: "ball", kind: "obstacle", shape: "dot", color: "#fff", size: 6,
      control: "none", spawn: { count: 0 }, props: { speed: 200 } },
    { id: "brick", kind: "obstacle", shape: "square", color: "#d24b4b", size: 16, spawn: { count: 0 } },
    { id: "deadzone", kind: "obstacle", shape: "square", color: "#111", size: 200,
      control: "none", spawn: { x: 200, y: 460 } },
  ],
  rules: [
    { on: "input", key: "pointer", when: "ball.count == 0", effects: [{ op: "spawn", target: "ball", from: "paddle", aim: "up" }] },
    { on: "collision", between: ["ball", "brick"], effects: [{ op: "bounce" }, { op: "destroy", target: "other" }, { op: "score", value: 1 }] },
    { on: "collision", between: ["ball", "deadzone"], effects: [{ op: "destroy", target: "self" }, { op: "add", target: "lives", value: -1 }] },
  ],
  win: { when: "brick.count == 0" },
  lose: { when: "lives <= 0" },
};
check("breakout spec validates", validateGameSpec(breakoutSpec).ok);
check("invalid edges rejected", !validateGameSpec({ ...breakoutSpec, world: { ...breakoutSpec.world, edges: "boing" as never } }).ok);
check("invalid control rejected",
  !validateGameSpec({ ...breakoutSpec, entities: [{ ...breakoutSpec.entities[0]!, control: "follow-pointer-z" as never }, ...breakoutSpec.entities.slice(1)] }).ok);

// bounce effect: a ball moving down-right into a brick directly below reflects vy.
{
  const w = new World(breakoutSpec, 1);
  const ball = w.spawn("ball")!;
  const brick = w.spawn("brick")!;
  ball.x = 200; ball.y = 200; ball.vx = 40; ball.vy = 120; // moving down
  brick.x = 200; brick.y = 218; // just below the ball (overlap on Y)
  evaluateRules(w, new RuleTimers(), noInput(), 1 / 60);
  check("bounce reflects the ball off the brick's face (vy flips up)", ball.vy < 0 && ball.alive);
  check("ball+brick also destroyed the brick and scored", w.countOf("brick") === 0 && w.score === 1);
}

// edges:"bounce" reflects off a side wall but leaves the bottom open.
{
  const w = new World(breakoutSpec, 1);
  const ball = w.spawn("ball")!;
  ball.x = 395; ball.y = 200; ball.vx = 200; ball.vy = 0; // heading into the right wall
  stepMovement(w, new Input(), 1 / 60);
  check("edges bounce reflects off the right wall (vx flips)", ball.vx < 0 && ball.x <= 400 - ball.size);
  // falling past the bottom is NOT clamped (open) so a miss is possible
  ball.x = 200; ball.y = 398; ball.vx = 0; ball.vy = 200;
  stepMovement(w, new Input(), 1 / 60);
  check("edges bounce leaves the bottom open (ball falls through)", ball.y > 400 - ball.size && ball.vy > 0);
}

// follow-pointer-x: the paddle tracks the cursor's X and never moves in Y.
{
  const w = new World(breakoutSpec, 1);
  const paddle = w.firstOf("paddle")!;
  const y0 = paddle.y;
  const input = new Input();
  (input as unknown as { pointerX: number; pointerActive: boolean }).pointerX = 360;
  (input as unknown as { pointerY: number }).pointerY = 50; // should be ignored
  (input as unknown as { pointerActive: boolean }).pointerActive = true;
  for (let i = 0; i < 30; i++) stepMovement(w, input, 1 / 60);
  check("follow-pointer-x tracks the cursor's X", paddle.x > 300);
  check("follow-pointer-x never moves the paddle in Y", paddle.y === y0);
}

// 18. boundary: a free-flying projectile despawns at a wall (no pile-up), while
//     the player and behaviour movers still clamp.
const edgeSpec: GameSpec = {
  meta: { title: "Edge test" },
  world: { width: 400, height: 300, background: "#000", edges: "wall" },
  entities: [
    { id: "player", kind: "player", shape: "circle", color: "#4aa3ff", size: 10,
      control: "arrows", spawn: { x: 200, y: 150 }, props: { speed: 300 } },
    { id: "enemy", kind: "enemy", shape: "square", color: "#f55", size: 10,
      behavior: "chase:player", spawn: { x: 380, y: 150 }, props: { speed: 300 } },
    { id: "bullet", kind: "obstacle", shape: "dot", color: "#fff", size: 4,
      control: "none", spawn: { count: 0 }, props: { speed: 600, ttl: 5 } },
  ],
  rules: [{ on: "tick", effects: [{ op: "score", value: 0 }] }],
};
check("edge spec validates", validateGameSpec(edgeSpec).ok);
{
  const w = new World(edgeSpec, 1);
  // a bullet flying into the right wall despawns instead of sticking
  const bullet = w.spawn("bullet")!;
  bullet.x = 360; bullet.y = 150; bullet.vx = 600; bullet.vy = 0;
  let despawnedAtWall = false;
  for (let i = 0; i < 20; i++) {
    stepMovement(w, new Input(), 1 / 60);
    w.reap();
    if (w.countOf("bullet") === 0) { despawnedAtWall = true; break; }
  }
  check("a projectile despawns at the wall (no pile-up)", despawnedAtWall);

  // the player (steered) clamps at the wall instead of despawning
  const w2 = new World(edgeSpec, 1);
  const p = w2.firstOf("player")!;
  p.x = 395; // shoved past the right edge
  for (let i = 0; i < 5; i++) stepMovement(w2, new Input(), 1 / 60);
  check("the player clamps at the wall (doesn't despawn)",
    w2.countOf("player") === 1 && p.x === 400 - p.size);

  // a chasing enemy also clamps (behaviour movers aren't projectiles)
  const w3 = new World(edgeSpec, 1);
  const en = w3.firstOf("enemy")!;
  en.x = 395; en.y = 150;
  for (let i = 0; i < 5; i++) stepMovement(w3, new Input(), 1 / 60);
  check("a behaviour enemy clamps at the wall (doesn't despawn)", w3.countOf("enemy") === 1 && en.x <= 400 - en.size);
}

// 19. runner control: constant forward motion, cardinal steering, no 180 reversal.
const runnerSpec: GameSpec = {
  meta: { title: "Runner test" },
  world: { width: 400, height: 400, background: "#000", edges: "wrap" },
  entities: [
    { id: "head", kind: "player", shape: "square", color: "#6fcf52", size: 10,
      control: "runner", spawn: { x: 200, y: 200 }, props: { speed: 120 } },
  ],
  rules: [{ on: "tick", effects: [{ op: "score", value: 0 }] }],
};
check("runner spec validates", validateGameSpec(runnerSpec).ok);
{
  const w = new World(runnerSpec, 1);
  const h = w.firstOf("head")!;
  // no input -> it moves forward (up) on its own and never stops
  stepMovement(w, new Input(), 1 / 60);
  check("runner moves forward with no input (never stops)", h.vy < 0 && Math.abs(h.vx) < 1);
  // a TAP (key-down edge) steers right
  const right = new Input();
  (right as unknown as { justPressed: Set<string> }).justPressed.add("right");
  stepMovement(w, right, 1 / 60);
  check("runner steers to a cardinal on a tap (right)", h.vx > 0 && Math.abs(h.vy) < 1 && h.hx === 1);
  // attempt a direct reversal (left while moving right) -> refused, keeps going right
  const left = new Input();
  (left as unknown as { justPressed: Set<string> }).justPressed.add("left");
  stepMovement(w, left, 1 / 60);
  check("runner refuses a 180 reversal (keeps heading right)", h.vx > 0 && h.hx === 1);
  // a perpendicular turn IS allowed (down)
  const down = new Input();
  (down as unknown as { justPressed: Set<string> }).justPressed.add("down");
  stepMovement(w, down, 1 / 60);
  check("runner turns perpendicular (down)", h.vy > 0 && h.hy === 1 && Math.abs(h.vx) < 1);
}

// 20. spawn ttlFrom: a spawned entity's lifetime comes from a var, so a snake
//     body grows as the var rises (eating lengthens the trail).
const trailSpec: GameSpec = {
  meta: { title: "Trail growth test" },
  world: { width: 400, height: 400, background: "#000", edges: "wrap" },
  vars: { length: 0.5 },
  entities: [
    { id: "head", kind: "player", shape: "square", color: "#6fcf52", size: 10,
      control: "runner", spawn: { x: 200, y: 200 }, props: { speed: 120 } },
    { id: "seg", kind: "obstacle", shape: "square", color: "#3fa34d", size: 8,
      control: "none", spawn: { count: 0 }, props: { speed: 0 } },
    { id: "food", kind: "food", shape: "dot", color: "#ffd23f", size: 6,
      spawn: { random: true, maintain: 1 }, props: { speed: 0 } },
  ],
  rules: [
    { on: "interval", every: 0.08, effects: [{ op: "spawn", target: "seg", from: "head", aim: "backward", ttlFrom: "length" }] },
    { on: "collision", between: ["head", "food"], effects: [{ op: "add", target: "length", value: 0.3 }, { op: "destroy", target: "other" }] },
  ],
};
check("ttlFrom spec validates", validateGameSpec(trailSpec).ok);
check("ttlFrom with an undeclared var is rejected",
  !validateGameSpec({ ...trailSpec, vars: {} }).ok);
{
  const w = new World(trailSpec, 1);
  const timers = new RuleTimers();
  // fire the interval spawner once (dt >= every) -> a seg with ttl = length (0.5)
  evaluateRules(w, timers, noInput(), 0.08);
  const segs1 = w.entities.filter((e) => e.alive && e.type === "seg");
  check("a seg's ttl is taken from the length var (0.5)",
    segs1.length >= 1 && segs1.every((s) => Math.abs((s.props.ttl ?? -1) - 0.5) < 1e-6));
  // grow length, fire again -> the newest seg lives longer (the body grows)
  w.setVar("length", 1.2);
  evaluateRules(w, timers, noInput(), 0.08);
  const longest = w.entities.filter((e) => e.alive && e.type === "seg").reduce((a, b) => ((b.props.ttl ?? 0) > (a.props.ttl ?? 0) ? b : a));
  check("growing the var lengthens new segments (body grows)", Math.abs((longest.props.ttl ?? 0) - 1.2) < 1e-6);
}

// 21. platformer: gravity makes a platformer entity fall, it lands on a solid
//     (grounded + fall stops), jumps only when grounded (no double-jump), runs.
const platformSpec: GameSpec = {
  meta: { title: "Platformer test" },
  world: { width: 400, height: 400, background: "#000", edges: "wall", gravity: 1600 },
  entities: [
    { id: "player", kind: "player", shape: "square", color: "#e23d3d", size: 12,
      control: "platformer", spawn: { x: 200, y: 100 }, props: { speed: 160, jump: 560 } },
    { id: "ground", kind: "obstacle", shape: "square", color: "#7a4a23", size: 16,
      control: "none", solid: true, spawn: { x: 200, y: 360 } },
  ],
  rules: [{ on: "tick", effects: [{ op: "score", value: 0 }] }],
};
check("platformer spec validates", validateGameSpec(platformSpec).ok);
check("negative gravity rejected", !validateGameSpec({ ...platformSpec, world: { ...platformSpec.world, gravity: -5 } }).ok);
{
  const w = new World(platformSpec, 1);
  const p = w.firstOf("player")!;
  const y0 = p.y;
  // with no input, gravity pulls the player down (vy grows, y increases)
  for (let i = 0; i < 5; i++) stepMovement(w, new Input(), 1 / 60);
  check("gravity makes a platformer entity fall", p.vy > 0 && p.y > y0);

  // let it fall onto the ground (solid at y=360, top ~344) -> grounded + fall stops
  for (let i = 0; i < 120; i++) { stepMovement(w, new Input(), 1 / 60); resolveSolids(w); }
  check("player lands on the ground (grounded, fall stopped)", p.grounded && Math.abs(p.vy) < 1 && p.y < 360);

  // jump from the ground: an up-press launches it upward
  const up = new Input();
  (up as unknown as { justPressed: Set<string> }).justPressed.add("up");
  stepMovement(w, up, 1 / 60);
  check("grounded jump launches upward (vy negative)", p.vy < 0 && !p.grounded);

  // mid-air: another up-press does NOT jump again (no double-jump)
  const vyAir = p.vy;
  const up2 = new Input();
  (up2 as unknown as { justPressed: Set<string> }).justPressed.add("up");
  stepMovement(w, up2, 1 / 60);
  check("no mid-air double-jump", p.vy > vyAir); // only gravity changed vy (made it less negative), not a fresh impulse

  // horizontal run: holding right moves the player in +x
  const w2 = new World(platformSpec, 1);
  const p2 = w2.firstOf("player")!;
  const right = new Input();
  (right as unknown as { keys: Set<string> }).keys.add("right");
  const x0 = p2.x;
  for (let i = 0; i < 5; i++) stepMovement(w2, right, 1 / 60);
  check("platformer runs left/right (held right -> +x)", p2.x > x0 && p2.vx > 0);
}

// 22. walker enemy (Goomba) + stomp: a gravity-affected horizontal patrol that
//     reverses at walls/ledges; the player stomps it from above (self.vy > 0)
//     but is hurt on a side hit. Exercises reading self.vy in a condition.
const goombaSpec: GameSpec = {
  meta: { title: "Goomba test" },
  world: { width: 400, height: 400, background: "#000", edges: "wall", gravity: 1600 },
  entities: [
    { id: "player", kind: "player", shape: "square", color: "#e23d3d", size: 12, control: "platformer", spawn: { x: 200, y: 100 }, props: { speed: 150, jump: 500 } },
    { id: "goomba", kind: "enemy", shape: "square", color: "#9a6324", size: 12, behavior: "walker", spawn: { x: 200, y: 310 }, props: { speed: 60 } },
    { id: "ground", kind: "obstacle", shape: "square", color: "#888", size: 40, control: "none", solid: true, spawn: { x: 200, y: 380 } },
  ],
  rules: [
    { on: "collision", between: ["player", "goomba"], when: "self.vy > 40", effects: [{ op: "bounce" }, { op: "destroy", target: "other" }, { op: "score", value: 1 }] },
    { on: "collision", between: ["player", "goomba"], when: "self.vy <= 40", effects: [{ op: "gameover" }] },
  ],
};
check("goomba spec validates (walker behavior + self.vy condition)", validateGameSpec(goombaSpec).ok);

// gravity affects the walker (it falls)
{
  const w = new World(goombaSpec, 1);
  const g = w.firstOf("goomba")!;
  const y0 = g.y;
  for (let i = 0; i < 5; i++) stepMovement(w, new Input(), 1 / 60);
  check("walker falls under gravity", g.vy > 0 && g.y > y0);
}
// the walker patrols and reverses (goes both ways across the platform)
{
  const w = new World(goombaSpec, 1);
  const g = w.firstOf("goomba")!;
  let sawLeft = false, sawRight = false;
  for (let i = 0; i < 120; i++) { stepMovement(w, new Input(), 1 / 60); resolveSolids(w); if (g.vx < -1) sawLeft = true; if (g.vx > 1) sawRight = true; }
  check("walker patrols and reverses at walls/ledges", sawLeft && sawRight && g.grounded);
}
// conditions can read self.vy
{
  const w = new World(goombaSpec, 1);
  const e = w.firstOf("player")!;
  e.vy = 100;
  check("conditions read self.vy (live)", evalCondition("self.vy > 40", w, { self: e }) && !evalCondition("self.vy <= 40", w, { self: e }));
}
// stomp: a falling player kills the goomba, scores, and bounces up
{
  const w = new World(goombaSpec, 1);
  const p = w.firstOf("player")!, g = w.firstOf("goomba")!;
  p.x = 200; g.x = 200; p.y = 150; g.y = 162; p.vy = 300; // player just above the goomba, falling
  const sc = w.score;
  evaluateRules(w, new RuleTimers(), noInput(), 1 / 60);
  check("stomp: falling onto a goomba kills it, scores, and bounces up",
    w.countOf("goomba") === 0 && w.score === sc + 1 && p.vy < 0);
}
// side hit: walking into a goomba (not falling) is a game over
{
  const w = new World(goombaSpec, 1);
  const p = w.firstOf("player")!, g = w.firstOf("goomba")!;
  p.x = 200; g.x = 200; p.y = 150; g.y = 150; p.vy = 0; // same level, not falling
  evaluateRules(w, new RuleTimers(), noInput(), 1 / 60);
  check("side hit (not falling) = game over", w.status === "lost");
}

// 23. DSL versioning: the version parses as semver, the sample carries it, a
//     valid version validates, a future-major version is rejected, malformed too.
check("DSL_VERSION is valid Major.Minor.Patch", parseVersion(DSL_VERSION) !== null);
check("the sample spec records its DSL version", growAndSlow.version === DSL_VERSION);
check("a spec with the current version validates", validateGameSpec({ ...growAndSlow, version: DSL_VERSION }).ok);
check("a spec with no version still validates (back-compat)", validateGameSpec({ ...growAndSlow, version: undefined }).ok);
{
  const major = parseVersion(DSL_VERSION)!.major;
  check("a future-MAJOR spec is rejected", !validateGameSpec({ ...growAndSlow, version: `${major + 1}.0.0` }).ok);
  check("an older/equal-major spec is supported", isVersionSupported(`${major}.99.99`) && !isVersionSupported(`${major + 1}.0.0`));
}
check("a malformed version is rejected", !validateGameSpec({ ...growAndSlow, version: "1.2" as never }).ok);

if (failures > 0) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nAll smoke checks passed");
