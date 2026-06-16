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
import { stepMovement } from "./movement";
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
check("bullet spawns at the player", !!bullet && Math.abs(bullet.x - 100) < 1 && Math.abs(bullet.y - 300) < 1);
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

if (failures > 0) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nAll smoke checks passed");
