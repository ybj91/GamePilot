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
import { GLYPH_PRESET_NAMES, COMPOSED_PRESET_NAMES } from "./glyphs";
import { DSL_VERSION, parseVersion, isVersionSupported } from "./version";

const isRows = (v: unknown): v is string[] =>
  Array.isArray(v) && v.length > 0 && v.every((r) => typeof r === "string");

/** A tile cell may name a mono OR a composed (v2) preset. */
const isKnownGlyph = (name: string): boolean =>
  GLYPH_PRESET_NAMES.includes(name) || COMPOSED_PRESET_NAMES.includes(name);

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

const SHAPES: Shape[] = ["circle", "square", "dot"];
const CONTROLS: Control[] = ["none", "follow-pointer", "follow-pointer-x", "arrows", "runner", "platformer"];
const TRIGGERS = ["collision", "tick", "interval", "input"];
const EFFECT_OPS = ["add", "set", "mul", "destroy", "spawn", "flash", "bounce", "score", "win", "gameover"];

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isStr = (v: unknown): v is string => typeof v === "string" && v.length > 0;

const COND_OPS = [">=", "<=", "==", "!=", ">", "<"];

/**
 * Light syntax check for a condition expression (rule `when`, win/lose `when`).
 * Mirrors conditions.ts: `<left> <op> <number>`. We don't evaluate it here, just
 * make sure the AI gets a precise error instead of a silently-false condition.
 */
function validateCondition(
  expr: unknown,
  where: string,
  errs: string[],
  declaredVars?: Set<string>,
): void {
  if (!isStr(expr)) {
    errs.push(`${where}: condition must be a non-empty string`);
    return;
  }
  const op = COND_OPS.find((o) => expr.includes(o));
  if (!op) {
    errs.push(`${where}: condition "${expr}" needs a comparison operator (>= <= > < == !=), e.g. "player.shield > 0"`);
    return;
  }
  const cut = expr.indexOf(op);
  const left = expr.slice(0, cut).trim();
  if (!left) errs.push(`${where}: condition "${expr}" is missing a left-hand side`);
  // A dot-less left side is a global variable — it must be declared in vars.
  if (declaredVars && left && !left.includes(".") && !declaredVars.has(left)) {
    errs.push(`${where}: unknown variable "${left}" — declare it in the top-level "vars"`);
  }
  const right = expr.slice(cut + op.length).trim();
  if (right === "" || Number.isNaN(Number(right))) {
    errs.push(`${where}: right side of "${expr}" must be a number`);
  }
}

function validateEntity(e: EntitySpec, ids: Set<string>, errs: string[]): void {
  const where = `entity "${e?.id ?? "?"}"`;
  if (!isStr(e.id)) errs.push(`${where}: missing id`);
  if (!isStr(e.kind)) errs.push(`${where}: missing kind`);
  if (!SHAPES.includes(e.shape)) errs.push(`${where}: invalid shape "${e.shape}"`);
  if (!isStr(e.color)) errs.push(`${where}: missing color`);
  if (!isNum(e.size) || e.size <= 0) errs.push(`${where}: size must be a positive number`);
  if (e.control && !CONTROLS.includes(e.control)) errs.push(`${where}: invalid control "${e.control}"`);
  if (!e.spawn || typeof e.spawn !== "object") {
    errs.push(`${where}: missing spawn`);
  } else if (
    e.spawn.area !== undefined &&
    !["top", "bottom", "left", "right", "edges", "center"].includes(e.spawn.area)
  ) {
    errs.push(`${where}: invalid spawn.area "${e.spawn.area}" (top|bottom|left|right|edges|center)`);
  }
  if (e.behavior) {
    const verb = String(e.behavior).split(":")[0] ?? "";
    if (!["chase", "flee", "wander", "walker"].includes(verb)) {
      errs.push(`${where}: invalid behavior "${e.behavior}"`);
    }
  }
  if (e.props && typeof e.props !== "object") errs.push(`${where}: props must be an object`);
  if (e.solid !== undefined && typeof e.solid !== "boolean") errs.push(`${where}: solid must be a boolean`);
  if (e.glyph !== undefined) {
    if (typeof e.glyph === "string") {
      if (!GLYPH_PRESET_NAMES.includes(e.glyph) && !COMPOSED_PRESET_NAMES.includes(e.glyph)) {
        errs.push(`${where}: glyph "${e.glyph}" is not a known preset`);
      }
    } else if (!isRows(e.glyph)) {
      errs.push(`${where}: glyph must be a preset name or a non-empty array of grid rows`);
    }
  }
  if (e.parts !== undefined) {
    if (!Array.isArray(e.parts) || !e.parts.length) {
      errs.push(`${where}: parts must be a non-empty array of layers`);
    } else {
      e.parts.forEach((p, i) => {
        if (!p || typeof p !== "object") {
          errs.push(`${where}: parts[${i}] must be an object { glyph, color? }`);
          return;
        }
        if (typeof p.glyph === "string") {
          if (!GLYPH_PRESET_NAMES.includes(p.glyph)) errs.push(`${where}: parts[${i}].glyph "${p.glyph}" is not a known preset`);
        } else if (!isRows(p.glyph)) {
          errs.push(`${where}: parts[${i}].glyph must be a preset name or grid rows`);
        }
        if (p.color !== undefined && !isStr(p.color)) errs.push(`${where}: parts[${i}].color must be a string`);
      });
    }
  }
  if (e.tiles !== undefined) {
    if (!Array.isArray(e.tiles) || !e.tiles.length || !e.tiles.every((row) => Array.isArray(row))) {
      errs.push(`${where}: tiles must be a non-empty 2D array (rows of tile cells)`);
    } else {
      e.tiles.forEach((row, r) => row.forEach((cell, c) => {
        const at = `${where}: tiles[${r}][${c}]`;
        if (cell === null) return;
        if (typeof cell === "string") {
          if (cell !== "" && cell !== "." && cell !== " " && !isKnownGlyph(cell)) errs.push(`${at} "${cell}" is not a known preset`);
        } else if (cell && typeof cell === "object" && !Array.isArray(cell)) {
          if (typeof cell.glyph === "string") {
            if (!isKnownGlyph(cell.glyph)) errs.push(`${at}.glyph "${cell.glyph}" is not a known preset`);
          } else if (!isRows(cell.glyph)) {
            errs.push(`${at}.glyph must be a preset name or grid rows`);
          }
          if (cell.color !== undefined && !isStr(cell.color)) errs.push(`${at}.color must be a string`);
        } else {
          errs.push(`${at} must be a preset name, { glyph, color }, or null`);
        }
      }));
    }
  }
  if (e.frames !== undefined && (!Array.isArray(e.frames) || !e.frames.length || !e.frames.every(isRows))) {
    errs.push(`${where}: frames must be a non-empty array of frames (each a non-empty array of strings)`);
  }
  if (e.fps !== undefined && !isNum(e.fps)) errs.push(`${where}: fps must be a number`);
  if (e.loop !== undefined && typeof e.loop !== "boolean") errs.push(`${where}: loop must be a boolean`);
  if (e.rotate !== undefined && typeof e.rotate !== "boolean") errs.push(`${where}: rotate must be a boolean`);
  if (e.flashColor !== undefined && !isStr(e.flashColor)) errs.push(`${where}: flashColor must be a string (CSS color)`);
  ids.add(e.id);
}

function validateEffect(
  fx: Effect,
  idx: number,
  ruleNo: number,
  errs: string[],
  declaredVars: Set<string>,
): void {
  const where = `rule[${ruleNo}].effects[${idx}]`;
  if (!EFFECT_OPS.includes(fx.op)) {
    errs.push(`${where}: invalid op "${fx.op}"`);
    return;
  }
  if (["add", "set", "mul"].includes(fx.op)) {
    if (!isStr(fx.target)) errs.push(`${where}: ${fx.op} needs a target like "player.size" or a var name`);
    if (!isNum(fx.value)) errs.push(`${where}: ${fx.op} needs a numeric value`);
    // A dot-less target is a global variable — it must be declared in vars.
    if (isStr(fx.target) && !fx.target.includes(".") && !declaredVars.has(fx.target)) {
      errs.push(`${where}: unknown variable "${fx.target}" — declare it in the top-level "vars"`);
    }
  }
  if (fx.op === "destroy" && !isStr(fx.target)) {
    errs.push(`${where}: destroy needs a target ("self" | "other" | entity id)`);
  }
  if (fx.op === "flash") {
    if (fx.target !== undefined && !isStr(fx.target)) {
      errs.push(`${where}: flash target must be a string ("self" | "other" | entity id)`);
    }
    if (fx.value !== undefined && !isNum(fx.value)) errs.push(`${where}: flash value (seconds) must be a number`);
  }
  if (fx.op === "spawn") {
    if (!isStr(fx.target)) errs.push(`${where}: spawn needs a target entity id`);
    if (fx.from !== undefined && !isStr(fx.from)) {
      errs.push(`${where}: spawn "from" must be a string ("self"/"other"/entity id)`);
    }
    if (fx.aim !== undefined && !isStr(fx.aim)) {
      errs.push(`${where}: spawn "aim" must be a string ("pointer"/"up"/"down"/"left"/"right"/entity id)`);
    }
    if (fx.ttlFrom !== undefined) {
      if (!isStr(fx.ttlFrom)) errs.push(`${where}: spawn "ttlFrom" must be a var name (string)`);
      else if (!declaredVars.has(fx.ttlFrom)) errs.push(`${where}: spawn "ttlFrom" references unknown variable "${fx.ttlFrom}" — declare it in "vars"`);
    }
  }
}

function validateRule(r: Rule, ruleNo: number, errs: string[], declaredVars: Set<string>): void {
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
  if (r.on === "input" && !isStr(r.key)) {
    errs.push(`${where}: input needs a "key" (e.g. "space", "up", "w", "pointer")`);
  }
  if (r.when !== undefined) validateCondition(r.when, `${where}.when`, errs, declaredVars);
  if (!Array.isArray(r.effects) || r.effects.length === 0) {
    errs.push(`${where}: needs at least one effect`);
    return;
  }
  r.effects.forEach((fx, i) => validateEffect(fx, i, ruleNo, errs, declaredVars));
}

export function validateGameSpec(spec: GameSpec): ValidationResult {
  const errors: string[] = [];

  if (!spec || typeof spec !== "object") {
    return { ok: false, errors: ["spec is not an object"] };
  }
  // Optional DSL version (Major.Minor.Patch). When set, the spec's MAJOR must
  // not be newer than the engine's — a future-major spec can't be played here.
  if (spec.version !== undefined) {
    if (typeof spec.version !== "string" || !parseVersion(spec.version)) {
      errors.push(`version: must be a "Major.Minor.Patch" string`);
    } else if (!isVersionSupported(spec.version)) {
      errors.push(`version: spec targets DSL ${spec.version}, newer than this engine (${DSL_VERSION})`);
    }
  }
  // A tilemap sizes the world, so width/height are only required without a map.
  if (!spec.world || typeof spec.world !== "object") {
    errors.push("world: missing");
  } else if (!spec.map && (!isNum(spec.world.width) || !isNum(spec.world.height))) {
    errors.push("world: needs numeric width and height");
  }
  if (spec.world?.viewport !== undefined) {
    const vp = spec.world.viewport;
    if (typeof vp !== "object" || vp === null || !isNum(vp.width) || !isNum(vp.height)) {
      errors.push("world.viewport: needs numeric width and height");
    }
  }
  if (spec.world?.edges !== undefined && !["wall", "wrap", "bounce"].includes(spec.world.edges)) {
    errors.push(`world.edges: must be "wall", "wrap", or "bounce"`);
  }
  if (spec.world?.gravity !== undefined && (!isNum(spec.world.gravity) || spec.world.gravity < 0)) {
    errors.push("world.gravity: must be a non-negative number");
  }
  if (!Array.isArray(spec.entities) || spec.entities.length === 0) {
    errors.push("entities: needs at least one entity");
  }

  // Global variables: { name: number }. `score` is always available.
  const declaredVars = new Set<string>(["score"]);
  if (spec.vars !== undefined) {
    if (typeof spec.vars !== "object" || spec.vars === null || Array.isArray(spec.vars)) {
      errors.push("vars: must be an object of { name: number }");
    } else {
      for (const [name, value] of Object.entries(spec.vars)) {
        if (!isNum(value)) errors.push(`vars."${name}": must be a number`);
        declaredVars.add(name);
      }
    }
  }

  const ids = new Set<string>();
  (spec.entities ?? []).forEach((e) => validateEntity(e, ids, errors));

  // Tilemap: tile size + legend (char -> declared entity id) + rows of chars.
  if (spec.map !== undefined) {
    const m = spec.map;
    if (typeof m !== "object" || m === null) {
      errors.push("map: must be an object");
    } else {
      if (!isNum(m.tile) || m.tile <= 0) errors.push("map.tile: must be a positive number");
      if (typeof m.legend !== "object" || m.legend === null || Array.isArray(m.legend)) {
        errors.push("map.legend: must be an object of { char: entityId }");
      } else {
        for (const [ch, id] of Object.entries(m.legend)) {
          if (ch.length !== 1) errors.push(`map.legend: key "${ch}" must be a single character`);
          if (typeof id !== "string" || !ids.has(id)) {
            errors.push(`map.legend["${ch}"]: unknown entity "${id}"`);
          }
        }
      }
      if (!Array.isArray(m.rows) || m.rows.length === 0) {
        errors.push("map.rows: must be a non-empty array of strings");
      } else if (m.rows.some((r) => typeof r !== "string")) {
        errors.push("map.rows: every row must be a string");
      }
    }
  }

  // Cross-references: rules must point at declared entity ids.
  (spec.rules ?? []).forEach((r, i) => {
    validateRule(r, i, errors, declaredVars);
    if (r.between) {
      for (const ref of r.between) {
        if (!ids.has(ref)) errors.push(`rule[${i}]: unknown entity "${ref}" in between`);
      }
    }
  });

  if (spec.win) validateCondition(spec.win.when, "win.when", errors, declaredVars);
  if (spec.lose) validateCondition(spec.lose.when, "lose.when", errors, declaredVars);

  return { ok: errors.length === 0, errors };
}
