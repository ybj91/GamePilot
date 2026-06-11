/**
 * Headless smoke test for the DSL runtime (no DOM). Run with:
 *   node --experimental-strip-types src/engine/engine.smoke.ts
 *
 * Validates the parts that don't need a browser: world population, collision
 * rule firing (eat food -> grow + slow + score + respawn), gameover on enemy
 * contact, and win-condition evaluation. Exits non-zero on failure.
 */

import { World } from "./world.ts";
import { RuleTimers, evaluateRules } from "./rules.ts";
import { evalCondition } from "./conditions.ts";
import { growAndSlow } from "../dsl/samples/growAndSlow.ts";
import { validateGameSpec } from "../dsl/validate.ts";

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

if (failures > 0) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nAll smoke checks passed");
