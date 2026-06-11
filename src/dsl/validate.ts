/**
 * Lightweight, dependency-free runtime validation for a GameSpec.
 *
 * The hand-written samples are already typed by TS, so today this mainly guards
 * the seam where *untrusted AI output* will enter the system. Keeping it as a
 * plain function (rather than zod) avoids a runtime dependency in the engine;
 * if validation needs grow we can swap the internals without touching callers.
 */

import type {
  GameSpec,
  EntitySpec,
  Rule,
  Effect,
  Shape,
  Control,
} from "./types";

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

const SHAPES: Shape[] = ["circle", "square", "dot"];
const CONTROLS: Control[] = ["none", "follow-pointer", "arrows"];
const TRIGGERS = ["collision", "tick", "interval"];
const EFFECT_OPS = ["add", "set", "mul", "destroy", "spawn", "score", "win", "gameover"];

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isStr = (v: unknown): v is string => typeof v === "string" && v.length > 0;

function validateEntity(e: EntitySpec, ids: Set<string>, errs: string[]): void {
  const where = `entity "${e?.id ?? "?"}"`;
  if (!isStr(e.id)) errs.push(`${where}: missing id`);
  if (!isStr(e.kind)) errs.push(`${where}: missing kind`);
  if (!SHAPES.includes(e.shape)) errs.push(`${where}: invalid shape "${e.shape}"`);
  if (!isStr(e.color)) errs.push(`${where}: missing color`);
  if (!isNum(e.size) || e.size <= 0) errs.push(`${where}: size must be a positive number`);
  if (e.control && !CONTROLS.includes(e.control)) errs.push(`${where}: invalid control "${e.control}"`);
  if (!e.spawn || typeof e.spawn !== "object") errs.push(`${where}: missing spawn`);
  if (e.behavior) {
    const verb = String(e.behavior).split(":")[0] ?? "";
    if (!["chase", "flee", "wander"].includes(verb)) {
      errs.push(`${where}: invalid behavior "${e.behavior}"`);
    }
  }
  if (e.props && typeof e.props !== "object") errs.push(`${where}: props must be an object`);
  ids.add(e.id);
}

function validateEffect(fx: Effect, idx: number, ruleNo: number, errs: string[]): void {
  const where = `rule[${ruleNo}].effects[${idx}]`;
  if (!EFFECT_OPS.includes(fx.op)) {
    errs.push(`${where}: invalid op "${fx.op}"`);
    return;
  }
  if (["add", "set", "mul"].includes(fx.op)) {
    if (!isStr(fx.target)) errs.push(`${where}: ${fx.op} needs a target like "player.size"`);
    if (!isNum(fx.value)) errs.push(`${where}: ${fx.op} needs a numeric value`);
  }
  if (fx.op === "destroy" && !isStr(fx.target)) {
    errs.push(`${where}: destroy needs a target ("self" | "other" | entity id)`);
  }
  if (fx.op === "spawn" && !isStr(fx.target)) {
    errs.push(`${where}: spawn needs a target entity id`);
  }
}

function validateRule(r: Rule, ruleNo: number, errs: string[]): void {
  const where = `rule[${ruleNo}]`;
  if (!TRIGGERS.includes(r.on)) errs.push(`${where}: invalid trigger "${r.on}"`);
  if (r.on === "collision") {
    if (!Array.isArray(r.between) || r.between.length !== 2) {
      errs.push(`${where}: collision needs between: [idA, idB]`);
    }
  }
  if (r.on === "interval" && !isNum(r.every)) {
    errs.push(`${where}: interval needs a numeric "every" (seconds)`);
  }
  if (!Array.isArray(r.effects) || r.effects.length === 0) {
    errs.push(`${where}: needs at least one effect`);
    return;
  }
  r.effects.forEach((fx, i) => validateEffect(fx, i, ruleNo, errs));
}

export function validateGameSpec(spec: GameSpec): ValidationResult {
  const errors: string[] = [];

  if (!spec || typeof spec !== "object") {
    return { ok: false, errors: ["spec is not an object"] };
  }
  if (!spec.world || !isNum(spec.world.width) || !isNum(spec.world.height)) {
    errors.push("world: needs numeric width and height");
  }
  if (!Array.isArray(spec.entities) || spec.entities.length === 0) {
    errors.push("entities: needs at least one entity");
  }

  const ids = new Set<string>();
  (spec.entities ?? []).forEach((e) => validateEntity(e, ids, errors));

  // Cross-references: rules must point at declared entity ids.
  (spec.rules ?? []).forEach((r, i) => {
    validateRule(r, i, errors);
    if (r.between) {
      for (const ref of r.between) {
        if (!ids.has(ref)) errors.push(`rule[${i}]: unknown entity "${ref}" in between`);
      }
    }
  });

  return { ok: errors.length === 0, errors };
}
