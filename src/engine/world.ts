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
    for (const e of spec.entities) this.specsById.set(e.id, e);
    this.populate();
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

  spawn(typeId: string): Entity | undefined {
    const spec = this.specsById.get(typeId);
    if (!spec) return undefined;
    let x: number;
    let y: number;
    if (spec.spawn.random) {
      const m = spec.size + 4;
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
