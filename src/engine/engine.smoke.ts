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
evaluateRules(world, timers, 1 / 60);
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
evaluateRules(world, timers, 1 / 60);
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
evaluateRules(downWorld, new RuleTimers(), 1 / 60);
check("when player.shield<=0: enemy contact = gameover", downWorld.status === "lost");

// shield up -> the enemy is destroyed instead, game continues, shield consumed
const upWorld = new World(shieldSpec, 1);
upWorld.firstOf("player")!.props.shield = 1;
evaluateRules(upWorld, new RuleTimers(), 1 / 60);
check(
  "when player.shield>0: enemy destroyed, not gameover",
  upWorld.status === "playing" && upWorld.countOf("enemy") === 0 && upWorld.firstOf("player")!.props.shield === 0,
);

if (failures > 0) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nAll smoke checks passed");
