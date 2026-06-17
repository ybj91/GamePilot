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

/**
 * How an entity type is controlled / moves on its own.
 *  - "follow-pointer"   chase the cursor in both axes (a blob)
 *  - "follow-pointer-x" track only the cursor's X, hold Y (a Breakout paddle)
 *  - "arrows"           move with arrow keys / WASD (stops when nothing is held)
 *  - "runner"           ALWAYS moves forward at `speed`; arrows/WASD steer it to a
 *    cardinal but never a direct 180° reversal (Snake / Tron light-cycle).
 */
export type Control = "none" | "follow-pointer" | "follow-pointer-x" | "arrows" | "runner";

/**
 * Built-in autonomous behaviours. The target after ":" is an entity-type id.
 *  - "chase:player"  move toward nearest entity of that type
 *  - "flee:player"   move away from nearest entity of that type
 *  - "wander"        drift in slowly-changing random direction
 */
export type Behavior = "chase" | "flee" | "wander";
export type BehaviorSpec = Behavior | `${Behavior}:${string}`;

export interface World {
  /** World size in units. Optional only when a `map` provides it (grid x tile). */
  width?: number;
  height?: number;
  /** CSS color for the backdrop. */
  background: string;
  /**
   * What happens at the world boundary:
   *  - "wall"   clamp inside (default)
   *  - "wrap"   teleport to the opposite edge
   *  - "bounce" reflect velocity off the left/right/top walls; the BOTTOM is
   *    left open so paddle/ball games (Breakout) can "miss" — catch the ball
   *    with a deadzone entity along the bottom.
   */
  edges?: "wall" | "wrap" | "bounce";
  /**
   * Visible window onto the world. When smaller than width/height the view
   * scrolls to follow the player (a camera). Defaults to the full world (no
   * scrolling). Use it for maps bigger than the screen.
   */
  viewport?: { width: number; height: number };
}

/**
 * A grid level: rows of characters expanded into entity instances at build
 * time. Each cell char is looked up in `legend` (char -> entity id) and that
 * entity is placed at the cell centre; chars not in the legend (space/".") are
 * empty. The world's size is taken from the grid (cols*tile x rows*tile).
 * Makes wall-heavy levels easy to author — draw them as ASCII art.
 */
export interface TileMap {
  /** World units per cell. */
  tile: number;
  /** Character -> entity id. */
  legend: Record<string, string>;
  /** Grid rows (top to bottom). */
  rows: string[];
}

/** Region to scatter spawns within (takes precedence over random/x/y). */
export type SpawnArea = "top" | "bottom" | "left" | "right" | "edges" | "center";

export interface Spawn {
  /** Fixed spawn point (ignored when `random` is true). */
  x?: number;
  y?: number;
  /** Scatter `count` instances at random positions instead of (x,y). */
  random?: boolean;
  /**
   * Constrain scattering to a region of the world — e.g. enemies that spawn at
   * the "top" and advance, or pickups in the "center". Overrides random/x/y.
   */
  area?: SpawnArea;
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
   * If true, other entities cannot move through this one — it physically blocks
   * them (walls, obstacles, cover). One orthogonal flag that composes into
   * mazes/arenas. (Enemies don't pathfind around solids.)
   */
  solid?: boolean;
  /**
   * Optional pixel-grid glyph, drawn scaled to the entity's box in its color
   * instead of the bare `shape`. Either:
   *  - raw rows of a small bitmap, e.g. ["..X..", ".XXX.", "XXXXX", ...]; or
   *  - the NAME of a built-in preset (see GLYPH_PRESETS — tank/heart/star/
   *    invader/blob/...). Some presets are multi-frame and animate on their own.
   * A cell is "on" for any char except space/"." /"0". Authored facing up.
   * No assets — just data.
   */
  glyph?: string[] | string;
  /**
   * Explicit GIF-like animation: a list of frames (each a bitmap = rows),
   * cycled at `fps`. Overrides `glyph` as the drawn shape. Use it to make an
   * entity look alive (a walk cycle, a pulse, a spin).
   */
  frames?: string[][];
  /** Animation speed for a multi-frame glyph/preset, in frames per second. Default 6. */
  fps?: number;
  /**
   * Whether a multi-frame glyph loops (default true). Set false for a ONE-SHOT
   * animation: if the entity has a `ttl`, the frames play once spread across its
   * lifetime (then it despawns) — perfect for an "explosion" spawned on a hit;
   * without a ttl it plays once at `fps` and holds the last frame.
   */
  loop?: boolean;
  /** Rotate the glyph to the entity's facing (heading), so it shows direction. */
  rotate?: boolean;
  /** Color the entity flashes to on a `flash` effect (hit feedback). Default white. */
  flashColor?: string;
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
  | "interval" // every `every` seconds (requires `every`)
  | "input"; // on a key/pointer press (requires `key`)

export type EffectOp =
  | "add" // target += value
  | "set" // target = value
  | "mul" // target *= value
  | "destroy" // remove an entity instance ("self" | "other" | entity id)
  | "spawn" // create one instance of entity type `target`
  | "flash" // briefly flash an entity bright (hit feedback) for `value` seconds
  | "bounce" // reflect the colliding entity's velocity off the other (ball physics)
  | "score" // global score += value
  | "win"
  | "gameover";

/**
 * A single effect. `target` meaning depends on `op`:
 *  - add/set/mul: a property path "<entityId>.<prop>" OR the special tokens
 *    "self"/"other" combined with a prop, e.g. "other.size".
 *  - destroy: "self" | "other" | "<entityId>".
 *  - spawn:   "<entityId>" (entity type to spawn).
 *  - flash:   "self" | "other" | "<entityId>" (defaults to "self") — flashes that
 *    entity bright for `value` seconds (default 0.15) as hit feedback.
 *  - bounce:  no target — in a collision rule, reflects "self"'s velocity off
 *    "other" (off the face it hit) and nudges it clear. Ball/paddle physics.
 *  - score/win/gameover: target ignored.
 *
 * In a `collision` rule, "self" = the first entity in `between`, "other" = the
 * second. In `tick`/`interval` rules there is no self/other; use explicit ids.
 */
export interface Effect {
  op: EffectOp;
  target?: string;
  value?: number;
  /**
   * For `spawn` only — directional spawning (projectiles).
   * `from`: spawn at this entity's position ("self"/"other"/an id) instead of
   *   the spawned type's own spawn config.
   * `aim`: give the new instance an initial velocity (= its `speed`) in a
   *   direction: "pointer" (toward the cursor), "up"/"down"/"left"/"right", or
   *   an entity id (toward the nearest of that type). Pair with a short `ttl`
   *   prop so the projectile despawns.
   * `ttlFrom`: set the new instance's `ttl` (seconds) to the current value of
   *   this global var instead of its type's fixed `ttl`. Lets a spawned thing's
   *   lifetime grow with game state — e.g. a Snake body that lengthens as a
   *   `length` var rises each time you eat.
   */
  from?: string;
  aim?: string;
  ttlFrom?: string;
}

export interface Rule {
  on: Trigger;
  /** For `collision`: the two entity-type ids that must touch. */
  between?: [string, string];
  /** For `interval`: seconds between firings. */
  every?: number;
  /** For `input`: the key/button that fires the rule — e.g. "space", "up", "w", "pointer". */
  key?: string;
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
  /** Optional grid level — places legend entities on a grid and sizes the world. */
  map?: TileMap;
  /**
   * Named global variables (game-wide state) with their starting values, e.g.
   * `{ "lives": 3, "level": 1, "ammo": 10 }`. Read/written by rules and
   * conditions via the bare name (no dot), shown on the HUD, and usable in
   * win/lose. `score` is a built-in global and need not be declared here.
   */
  vars?: Record<string, number>;
  win?: WinCondition;
  /** Optional explicit lose condition; collisions usually drive `gameover`. */
  lose?: WinCondition;
}
