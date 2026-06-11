/**
 * Tiny expression evaluator for win/lose conditions. Deliberately NOT a general
 * expression engine -- it supports exactly the shapes the DSL documents so that
 * AI output stays predictable and safe (no eval, no arbitrary code):
 *
 *   "score >= 20"
 *   "player.size > 40"
 *   "food.count == 0"
 *
 * Left side is `score`, or `<entityType>.<prop>`, or `<entityType>.count`.
 * Operators: >= <= > < == !=
 */

import type { World } from "./world";
import { getEntityProp } from "./entity";

const OPS = [">=", "<=", "==", "!=", ">", "<"] as const;
type Op = (typeof OPS)[number];

function readLeft(token: string, world: World): number {
  token = token.trim();
  if (token === "score") return world.score;
  const [id, prop] = token.split(".");
  if (!id || !prop) return NaN;
  if (prop === "count") return world.countOf(id);
  const ent = world.firstOf(id);
  return ent ? getEntityProp(ent, prop) : NaN;
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

export function evalCondition(expr: string, world: World): boolean {
  for (const op of OPS) {
    const idx = expr.indexOf(op);
    if (idx === -1) continue;
    const left = readLeft(expr.slice(0, idx), world);
    const right = Number(expr.slice(idx + op.length).trim());
    if (Number.isNaN(left) || Number.isNaN(right)) return false;
    return compare(left, op, right);
  }
  return false;
}
