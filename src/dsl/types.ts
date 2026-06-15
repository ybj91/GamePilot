/**
 * GamePilot DSL v0
 * ----------------
 * A GameSpec is the single contract between every layer of GamePilot:
 *
 *   Idea -> AI compiler -> GameSpec -> Runtime engine -> Renderer
 *
 * It is intentionally *declarative* and *small*. The AI is only ever allowed to
 * emit a GameSpec (data) -- never engine code. Everything playable must be
 * expressible here, and everything here must be executable by the engine.
 *
 * Design rules for v0:
 *  - No imperative scripting. Behaviour = built-in `behavior` + rule `effects`.
 *  - No assets. Visuals are primitive shapes + colors.
 *  - Numbers are plain world units (pixels). Time is in seconds.
 */

export type Shape = "circle" | "square" | "dot";

/** How an entity type is controlled / moves on its own. */
export type Control = "none" | "follow-pointer" | "arrows";

/**
 * Built-in autonomous behaviours. The target after ":" is an entity-type id.
 *  - "chase:player"  move toward nearest entity of that type
 *  - "flee:player"   move away from nearest entity of that type
 *  - "wander"        drift in slowly-changing random direction
 */
export type Behavior = "chase" | "flee" | "wander";
export type BehaviorSpec = Behavior | `${Behavior}:${string}`;

export interface World {
  width: number;
  height: number;
  /** CSS color for the backdrop. */
  background: string;
  /** Entities that leave the world are clamped ("wall") or wrapped ("wrap"). */
  edges?: "wall" | "wrap";
}

export interface Spawn {
  /** Fixed spawn point (ignored when `random` is true). */
  x?: number;
  y?: number;
  /** Scatter `count` instances at random positions instead of (x,y). */
  random?: boolean;
  /** How many instances of this entity type to create. Default 1. */
  count?: number;
  /**
   * If set, the engine keeps respawning to maintain this many alive at all
   * times (used for food/pickups). Defaults to `count` for `random` spawns of
   * non-player/non-enemy kinds, otherwise 0 (no respawn).
   */
  maintain?: number;
}

/**
 * Semantic role of an entity type. Drives sensible defaults (e.g. the engine
 * gives exactly one `player`, points the camera/HUD at it, etc.). The set is
 * open-ended via string, but these are the well-known kinds for v0.
 */
export type EntityKind = "player" | "enemy" | "food" | "obstacle" | (string & {});

export interface EntitySpec {
  /** Unique type id, referenced by rules and behaviours (e.g. "player"). */
  id: string;
  kind: EntityKind;
  shape: Shape;
  color: string;
  /** Radius for circle/dot, half-width for square. World units. */
  size: number;
  spawn: Spawn;
  control?: Control;
  behavior?: BehaviorSpec;
  /**
   * Free-form numeric properties readable/writable by rule effects via
   * `<id>.<prop>` targets. `speed` is special-cased by the engine as movement
   * units/second; everything else is just state (e.g. `length`, `hp`).
   */
  props?: Record<string, number>;
}

/** Events that can trigger a rule. */
export type Trigger =
  | "collision" // requires `between: [aId, bId]`
  | "tick" // every simulation step
  | "interval"; // every `every` seconds (requires `every`)

export type EffectOp =
  | "add" // target += value
  | "set" // target = value
  | "mul" // target *= value
  | "destroy" // remove an entity instance ("self" | "other" | entity id)
  | "spawn" // create one instance of entity type `target`
  | "score" // global score += value
  | "win"
  | "gameover";

/**
 * A single effect. `target` meaning depends on `op`:
 *  - add/set/mul: a property path "<entityId>.<prop>" OR the special tokens
 *    "self"/"other" combined with a prop, e.g. "other.size".
 *  - destroy: "self" | "other" | "<entityId>".
 *  - spawn:   "<entityId>" (entity type to spawn).
 *  - score/win/gameover: target ignored.
 *
 * In a `collision` rule, "self" = the first entity in `between`, "other" = the
 * second. In `tick`/`interval` rules there is no self/other; use explicit ids.
 */
export interface Effect {
  op: EffectOp;
  target?: string;
  value?: number;
}

export interface Rule {
  on: Trigger;
  /** For `collision`: the two entity-type ids that must touch. */
  between?: [string, string];
  /** For `interval`: seconds between firings. */
  every?: number;
  /**
   * Optional guard: the rule only fires when this condition holds. Same grammar
   * as win/lose (`score`, `<id>.count`, `<id>.<prop>`) plus `self`/`other`.<prop>
   * in collisions. Lets the same trigger branch on state — e.g. two
   * player↔enemy collision rules, one `when: "player.shield <= 0"` (gameover)
   * and one `when: "player.shield > 0"` (block the hit).
   */
  when?: string;
  effects: Effect[];
}

export interface WinCondition {
  /** Minimal expression DSL: "score >= 20" | "<id>.count == 0" | "<id>.<prop> >= N". */
  when: string;
}

export interface GameSpec {
  meta?: {
    title?: string;
    /** The natural-language idea this spec was compiled from. */
    idea?: string;
  };
  world: World;
  entities: EntitySpec[];
  rules: Rule[];
  win?: WinCondition;
  /** Optional explicit lose condition; collisions usually drive `gameover`. */
  lose?: WinCondition;
}
