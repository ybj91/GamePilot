/**
 * Runtime entity instance.
 *
 * A GameSpec declares entity *types* (EntitySpec). At runtime each type is
 * instantiated one or more times into `Entity` objects that carry mutable
 * position, velocity and an open property bag that rule effects can mutate.
 */

import type { EntitySpec, Shape } from "../dsl/types";
import { resolveFrames, resolveParts, type ResolvedLayer } from "../dsl/glyphs";

let nextId = 1;

export interface Entity {
  /** Unique per-instance id. */
  iid: number;
  /** The entity *type* id this instance was spawned from (e.g. "player"). */
  type: string;
  kind: string;
  shape: Shape;
  color: string;
  size: number;
  x: number;
  y: number;
  /** Velocity in world units / second (set by control + behaviours). */
  vx: number;
  vy: number;
  /** Facing direction (cardinal unit vector) — the way it last moved. */
  hx: number;
  hy: number;
  /** Movement speed in units/second; mirrored into props.speed. */
  speed: number;
  /** Open numeric state bag (size, speed, and any spec-defined props). */
  props: Record<string, number>;
  /** Behaviour verb + optional target type, parsed from the spec. */
  behavior?: { verb: string; target?: string };
  control: string;
  /** Blocks other entities' movement (walls/obstacles). */
  solid: boolean;
  /** True while resting on a solid (platformer): gates jumping. Set by resolveSolids. */
  grounded: boolean;
  /**
   * Resolved animation frames (each a bitmap) drawn instead of the bare shape —
   * from a raw glyph, a named preset, or explicit `frames`. One frame = static.
   */
  frames?: string[][];
  /** Resolved composed glyph: colored layers drawn back-to-front (takes priority). */
  parts?: ResolvedLayer[];
  /** Animation speed in frames/second for a multi-frame glyph. */
  fps: number;
  /** Whether a multi-frame glyph loops; false = one-shot (see ttl0). */
  loop: boolean;
  /** Initial ttl (seconds) captured at spawn, so a one-shot glyph can map its
   *  frames across the entity's lifetime. 0 when the entity has no ttl. */
  ttl0: number;
  /** Rotate the glyph to face the heading. */
  rotate: boolean;
  /** Seconds of hit-flash remaining; while > 0 the entity is drawn in flashColor. */
  flash: number;
  /** Color to flash to on a `flash` effect (hit feedback). */
  flashColor: string;
  alive: boolean;
  /** Per-entity scratch state for behaviours (e.g. wander heading). */
  scratch: Record<string, number>;
}

export function createEntity(spec: EntitySpec, x: number, y: number): Entity {
  const speed = spec.props?.speed ?? 0;
  const [verb, target] = (spec.behavior ?? "").split(":");
  // A composed glyph (parts / a composed-preset name) wins over a plain glyph.
  const parts = resolveParts(spec.glyph, spec.parts);
  return {
    iid: nextId++,
    type: spec.id,
    kind: spec.kind,
    shape: spec.shape,
    color: spec.color,
    size: spec.size,
    x,
    y,
    vx: 0,
    vy: 0,
    hx: 0,
    hy: -1, // faces "up" until it moves
    speed,
    props: { size: spec.size, speed, ...(spec.props ?? {}) },
    behavior: verb ? { verb, target: target || undefined } : undefined,
    control: spec.control ?? "none",
    solid: spec.solid ?? false,
    grounded: false,
    parts,
    frames: parts ? undefined : resolveFrames(spec.glyph, spec.frames),
    fps: spec.fps ?? 6,
    loop: spec.loop ?? true,
    ttl0: spec.props?.ttl ?? 0,
    rotate: spec.rotate ?? false,
    flash: 0,
    flashColor: spec.flashColor ?? "#ffffff",
    alive: true,
    scratch: {},
  };
}

/**
 * Property paths in the DSL are "<entity>.<prop>". A couple of props are
 * mirrored onto first-class Entity fields so the engine's hot loops don't have
 * to read the bag every frame. Keep them in sync when written.
 */
export function setEntityProp(e: Entity, prop: string, value: number): void {
  e.props[prop] = value;
  if (prop === "size") e.size = Math.max(0.5, value);
  if (prop === "speed") e.speed = Math.max(0, value);
}

export function getEntityProp(e: Entity, prop: string): number {
  return e.props[prop] ?? 0;
}
