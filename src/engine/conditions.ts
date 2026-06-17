/**
 * Tiny expression evaluator for conditions. Deliberately NOT a general
 * expression engine -- it supports exactly the shapes the DSL documents so that
 * AI output stays predictable and safe (no eval, no arbitrary code):
 *
 *   "score >= 20"
 *   "player.size > 40"
 *   "food.count == 0"
 *   "self.shield > 0"      (rule `when`, in a collision context)
 *
 * Used for win/lose (no context) and for rule `when` (with a self/other
 * context, so collision rules can gate on the participants).
 *
 * Left side is `score`, `<id>.count`, `<id>.<prop>`, or `self`/`other`.<prop>.
 * Operators: >= <= > < == !=
 */

import type { World } from "./world";
import { getEntityProp, type Entity } from "./entity";

export interface CondContext {
  self?: Entity;
  other?: Entity;
}

const OPS = [">=", "<=", "==", "!=", ">", "<"] as const;
type Op = (typeof OPS)[number];

function readLeft(token: string, world: World, ctx?: CondContext): number {
  token = token.trim();
  // Bare name (no dot) -> a global: `score` or a declared var (lives/level/...).
  if (!token.includes(".")) return world.getVar(token);
  const [who, prop] = token.split(".");
  if (!who || !prop) return NaN;
  if (prop === "count") return world.countOf(who);
  const ent =
    who === "self" ? ctx?.self : who === "other" ? ctx?.other : world.firstOf(who);
  if (!ent) return NaN;
  // Live motion state readable in conditions (e.g. a stomp = "self.vy > 0").
  if (prop === "vx") return ent.vx;
  if (prop === "vy") return ent.vy;
  if (prop === "grounded") return ent.grounded ? 1 : 0;
  return getEntityProp(ent, prop);
}

function compare(a: number, op: Op, b: number): boolean {
  switch (op) {
    case ">=": return a >= b;
    case "<=": return a <= b;
    case ">": return a > b;
    case "<": return a < b;
    case "==": return a === b;
    case "!=": return a !== b;
  }
}

export function evalCondition(expr: string, world: World, ctx?: CondContext): boolean {
  for (const op of OPS) {
    const idx = expr.indexOf(op);
    if (idx === -1) continue;
    const left = readLeft(expr.slice(0, idx), world, ctx);
    const right = Number(expr.slice(idx + op.length).trim());
    if (Number.isNaN(left) || Number.isNaN(right)) return false;
    return compare(left, op, right);
  }
  return false;
}
