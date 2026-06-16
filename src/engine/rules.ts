/**
 * Rule evaluation -- the heart of the DSL runtime.
 *
 * Each step we fire rules whose trigger matches the current event:
 *  - input:     once per key/pointer press this step (`key`).
 *  - collision: for every contact pair matching `between`, with self/other
 *    bound so effects can mutate either participant.
 *  - tick:      once per step.
 *  - interval:  every `every` seconds (tracked per-rule via accumulator).
 *
 * Effects are applied immediately and can read/write entity props, spawn
 * (optionally aimed, for projectiles), destroy, change score, or end the game.
 */

import type { Rule, Effect } from "../dsl/types";
import type { World } from "./world";
import type { Entity } from "./entity";
import type { InputEnv } from "./input";
import { setEntityProp, getEntityProp } from "./entity";
import { findContacts } from "./collision";
import { evalCondition } from "./conditions";

/** Resolution context for a single rule firing. */
interface Ctx {
  self?: Entity;
  other?: Entity;
}

function resolveEntity(token: string, ctx: Ctx, world: World): Entity | undefined {
  if (token === "self") return ctx.self;
  if (token === "other") return ctx.other;
  return world.firstOf(token);
}

/** Unit direction for an aimed spawn (defaults to "up" when undefined). */
function aimVector(
  aim: string,
  x: number,
  y: number,
  world: World,
  ctx: Ctx,
  env: InputEnv,
): { x: number; y: number } {
  const toward = (tx: number, ty: number) => {
    const dx = tx - x;
    const dy = ty - y;
    const len = Math.hypot(dx, dy) || 1;
    return { x: dx / len, y: dy / len };
  };
  switch (aim) {
    case "up": return { x: 0, y: -1 };
    case "down": return { x: 0, y: 1 };
    case "left": return { x: -1, y: 0 };
    case "right": return { x: 1, y: 0 };
    case "pointer":
      return env.pointerActive ? toward(env.pointerX, env.pointerY) : { x: 0, y: -1 };
    case "self":
    case "other": {
      const t = resolveEntity(aim, ctx, world);
      return t ? toward(t.x, t.y) : { x: 0, y: -1 };
    }
    default: {
      const t = world.nearestOf(aim, x, y);
      return t ? toward(t.x, t.y) : { x: 0, y: -1 };
    }
  }
}

function applyEffect(fx: Effect, ctx: Ctx, world: World, env: InputEnv): void {
  switch (fx.op) {
    case "add":
    case "set":
    case "mul": {
      if (!fx.target) return;
      const v = fx.value ?? 0;
      const apply = (cur: number) => (fx.op === "add" ? cur + v : fx.op === "mul" ? cur * v : v);
      // Bare target (no dot) -> a global variable (score/lives/level/...).
      if (!fx.target.includes(".")) {
        world.setVar(fx.target, apply(world.getVar(fx.target)));
        return;
      }
      const [who, prop] = fx.target.split(".");
      const ent = resolveEntity(who!, ctx, world);
      if (!ent || !prop) return;
      setEntityProp(ent, prop, apply(getEntityProp(ent, prop)));
      break;
    }
    case "destroy": {
      const ent = resolveEntity(fx.target ?? "self", ctx, world);
      if (ent) ent.alive = false;
      break;
    }
    case "spawn": {
      if (!fx.target) break;
      const e = world.spawn(fx.target);
      if (!e) break;
      // Optionally spawn at another entity's position (e.g. bullets from player).
      const src = fx.from ? resolveEntity(fx.from, ctx, world) : undefined;
      if (src) {
        e.x = src.x;
        e.y = src.y;
      }
      // Optionally give it an initial velocity (= its speed) in a direction.
      if (fx.aim) {
        let dir: { x: number; y: number };
        if (fx.aim === "forward" && src) dir = { x: src.hx, y: src.hy };
        else if (fx.aim === "backward" && src) dir = { x: -src.hx, y: -src.hy };
        else dir = aimVector(fx.aim, e.x, e.y, world, ctx, env);
        e.vx = dir.x * e.speed;
        e.vy = dir.y * e.speed;
        // Face the projectile the way it's travelling too.
        if (dir.x || dir.y) (e.hx = Math.sign(dir.x)), (e.hy = Math.sign(dir.y));
      }
      break;
    }
    case "score": {
      world.score += fx.value ?? 1;
      break;
    }
    case "win": {
      world.status = "won";
      break;
    }
    case "gameover": {
      world.status = "lost";
      break;
    }
  }
}

/** Returns true if the rule fired (its guard passed), false if it was skipped. */
function fire(rule: Rule, ctx: Ctx, world: World, env: InputEnv): boolean {
  // Optional guard: skip the rule unless its condition holds (self/other bound).
  if (rule.when && !evalCondition(rule.when, world, ctx)) return false;
  for (const fx of rule.effects) {
    if (world.status !== "playing") return true; // stop applying once the game ends
    applyEffect(fx, ctx, world, env);
  }
  return true;
}

/** Per-rule interval accumulators, keyed by rule index. */
export class RuleTimers {
  private acc: number[] = [];
  step(rules: Rule[], dt: number, fireInterval: (i: number) => void): void {
    for (let i = 0; i < rules.length; i++) {
      const r = rules[i]!;
      if (r.on !== "interval") continue;
      const every = r.every ?? 1;
      this.acc[i] = (this.acc[i] ?? 0) + dt;
      while (this.acc[i]! >= every) {
        this.acc[i]! -= every;
        fireInterval(i);
      }
    }
  }
}

export function evaluateRules(
  world: World,
  timers: RuleTimers,
  env: InputEnv,
  dt: number,
): void {
  const rules = world.spec.rules;

  // 1. input — edge-triggered presses this step
  if (env.pressed.size) {
    for (const rule of rules) {
      if (rule.on !== "input") continue;
      if (rule.key && env.pressed.has(rule.key)) fire(rule, {}, world, env);
      if (world.status !== "playing") return;
    }
  }

  // 2. collisions
  const collisionRules = rules.filter((r) => r.on === "collision");
  if (collisionRules.length) {
    const contacts = findContacts(world.entities);
    for (const { a, b } of contacts) {
      // The first matching rule (by spec order) whose guard passes handles this
      // contact; later rules for the same pair are skipped. This is what makes
      // branching patterns (shield up/down, lives>1 / lives<=1) work — a state
      // change from one rule can't immediately trigger another on the same hit.
      for (const rule of collisionRules) {
        const [ra, rb] = rule.between!;
        let fired = false;
        if (a.type === ra && b.type === rb) fired = fire(rule, { self: a, other: b }, world, env);
        else if (a.type === rb && b.type === ra) fired = fire(rule, { self: b, other: a }, world, env);
        if (world.status !== "playing") return;
        if (fired) break;
      }
    }
  }

  // 3. per-tick
  for (const rule of rules) {
    if (rule.on === "tick") fire(rule, {}, world, env);
    if (world.status !== "playing") return;
  }

  // 4. intervals
  timers.step(rules, dt, (i) => fire(rules[i]!, {}, world, env));
}
