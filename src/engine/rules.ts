/**
 * Rule evaluation -- the heart of the DSL runtime.
 *
 * Each frame we fire rules whose trigger matches the current event:
 *  - collision: for every contact pair matching `between`, with self/other
 *    bound so effects can mutate either participant.
 *  - tick:      once per step.
 *  - interval:  every `every` seconds (tracked per-rule via accumulator).
 *
 * Effects are applied immediately and can read/write entity props, spawn,
 * destroy, change score, or end the game.
 */

import type { Rule, Effect } from "../dsl/types";
import type { World } from "./world";
import type { Entity } from "./entity";
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

function applyEffect(fx: Effect, ctx: Ctx, world: World): void {
  switch (fx.op) {
    case "add":
    case "set":
    case "mul": {
      if (!fx.target) return;
      const [who, prop] = fx.target.split(".");
      const ent = resolveEntity(who!, ctx, world);
      if (!ent || !prop) return;
      const cur = getEntityProp(ent, prop);
      const v = fx.value ?? 0;
      const next = fx.op === "add" ? cur + v : fx.op === "mul" ? cur * v : v;
      setEntityProp(ent, prop, next);
      break;
    }
    case "destroy": {
      const ent = resolveEntity(fx.target ?? "self", ctx, world);
      if (ent) ent.alive = false;
      break;
    }
    case "spawn": {
      if (fx.target) world.spawn(fx.target);
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

function fire(rule: Rule, ctx: Ctx, world: World): void {
  // Optional guard: skip the rule unless its condition holds (self/other bound).
  if (rule.when && !evalCondition(rule.when, world, ctx)) return;
  for (const fx of rule.effects) {
    if (world.status !== "playing") return; // stop applying once the game ends
    applyEffect(fx, ctx, world);
  }
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
  dt: number,
): void {
  const rules = world.spec.rules;

  // 1. collisions
  const collisionRules = rules.filter((r) => r.on === "collision");
  if (collisionRules.length) {
    const contacts = findContacts(world.entities);
    for (const { a, b } of contacts) {
      for (const rule of collisionRules) {
        const [ra, rb] = rule.between!;
        if (a.type === ra && b.type === rb) fire(rule, { self: a, other: b }, world);
        else if (a.type === rb && b.type === ra) fire(rule, { self: b, other: a }, world);
        if (world.status !== "playing") return;
      }
    }
  }

  // 2. per-tick
  for (const rule of rules) {
    if (rule.on === "tick") fire(rule, {}, world);
    if (world.status !== "playing") return;
  }

  // 3. intervals
  timers.step(rules, dt, (i) => fire(rules[i]!, {}, world));
}
