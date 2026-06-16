/**
 * Mutable world state for a running game: the live entity instances plus
 * global state (score, status) and a handle back to the spec so systems can
 * read entity-type definitions when respawning.
 */

import type { GameSpec, EntitySpec } from "../dsl/types";
import { createEntity, type Entity } from "./entity";
import { Rng } from "./rng";

export type GameStatus = "playing" | "won" | "lost";

export class World {
  readonly spec: GameSpec;
  readonly width: number;
  readonly height: number;
  readonly edges: "wall" | "wrap";
  readonly rng: Rng;

  entities: Entity[] = [];
  score = 0;
  /** Named global variables (lives/level/ammo/...), initialised from spec.vars. */
  vars: Record<string, number> = {};
  status: GameStatus = "playing";
  /** Seconds since the game started (sim time, not wall-clock). */
  time = 0;

  private specsById = new Map<string, EntitySpec>();

  constructor(spec: GameSpec, seed = 12345) {
    this.spec = spec;
    this.width = spec.world.width;
    this.height = spec.world.height;
    this.edges = spec.world.edges ?? "wall";
    this.rng = new Rng(seed);
    this.vars = { ...(spec.vars ?? {}) };
    for (const e of spec.entities) this.specsById.set(e.id, e);
    this.populate();
  }

  /** Read a global by name. `score` is built-in; others default to 0. */
  getVar(name: string): number {
    return name === "score" ? this.score : (this.vars[name] ?? 0);
  }

  /** Write a global by name. `score` is mirrored onto the first-class field. */
  setVar(name: string, value: number): void {
    if (name === "score") this.score = value;
    else this.vars[name] = value;
  }

  private populate(): void {
    for (const spec of this.spec.entities) {
      const count = spec.spawn.count ?? 1;
      for (let i = 0; i < count; i++) this.spawn(spec.id);
    }
  }

  /** How many living instances of a given entity type currently exist. */
  countOf(typeId: string): number {
    let n = 0;
    for (const e of this.entities) if (e.alive && e.type === typeId) n++;
    return n;
  }

  /** First living instance of a type (used for player + behaviour targets). */
  firstOf(typeId: string): Entity | undefined {
    return this.entities.find((e) => e.alive && e.type === typeId);
  }

  /** Nearest living instance of a type to a point (used for aimed spawns). */
  nearestOf(typeId: string, x: number, y: number): Entity | undefined {
    let best: Entity | undefined;
    let bestD = Infinity;
    for (const e of this.entities) {
      if (!e.alive || e.type !== typeId) continue;
      const d = (e.x - x) ** 2 + (e.y - y) ** 2;
      if (d < bestD) {
        bestD = d;
        best = e;
      }
    }
    return best;
  }

  /**
   * Decrement the reserved `ttl` prop (seconds) on any entity that has one and
   * kill it at zero. Lets projectiles and temporary effects clean themselves up
   * without per-rule bookkeeping. Called each step before reaping.
   */
  stepLifetimes(dt: number): void {
    for (const e of this.entities) {
      if (!e.alive || e.props.ttl === undefined) continue;
      e.props.ttl -= dt;
      if (e.props.ttl <= 0) e.alive = false;
    }
  }

  spawn(typeId: string): Entity | undefined {
    const spec = this.specsById.get(typeId);
    if (!spec) return undefined;
    const m = spec.size + 4;
    let x: number;
    let y: number;
    if (spec.spawn.area) {
      ({ x, y } = this.areaPoint(spec.spawn.area, m));
    } else if (spec.spawn.random) {
      x = this.rng.range(m, this.width - m);
      y = this.rng.range(m, this.height - m);
    } else {
      x = spec.spawn.x ?? this.width / 2;
      y = spec.spawn.y ?? this.height / 2;
    }
    const e = createEntity(spec, x, y);
    this.entities.push(e);
    return e;
  }

  /** A random point within a named spawn region (margin `m` from the walls). */
  private areaPoint(area: string, m: number): { x: number; y: number } {
    const W = this.width;
    const H = this.height;
    const rx = (lo: number, hi: number) => this.rng.range(lo, hi);
    switch (area === "edges" ? (["top", "bottom", "left", "right"] as const)[Math.floor(this.rng.range(0, 4))]! : area) {
      case "top": return { x: rx(m, W - m), y: rx(m, H * 0.18) };
      case "bottom": return { x: rx(m, W - m), y: rx(H * 0.82, H - m) };
      case "left": return { x: rx(m, W * 0.18), y: rx(m, H - m) };
      case "right": return { x: rx(W * 0.82, W - m), y: rx(m, H - m) };
      case "center": return { x: rx(W * 0.3, W * 0.7), y: rx(H * 0.3, H * 0.7) };
      default: return { x: rx(m, W - m), y: rx(m, H - m) };
    }
  }

  /**
   * Maintain target population for entity types that declare `maintain` (or
   * random food-like spawns). Called each frame after rules run so destroyed
   * pickups reappear.
   */
  maintainPopulations(): void {
    for (const spec of this.spec.entities) {
      const target = spec.spawn.maintain ?? 0;
      if (target <= 0) continue;
      let missing = target - this.countOf(spec.id);
      while (missing-- > 0) this.spawn(spec.id);
    }
  }

  /** Drop dead entities. Called once per frame to keep arrays compact. */
  reap(): void {
    if (this.entities.some((e) => !e.alive)) {
      this.entities = this.entities.filter((e) => e.alive);
    }
  }

  specFor(typeId: string): EntitySpec | undefined {
    return this.specsById.get(typeId);
  }
}
