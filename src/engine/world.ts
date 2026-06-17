/**
 * Mutable world state for a running game: the live entity instances plus
 * global state (score, status) and a handle back to the spec so systems can
 * read entity-type definitions when respawning.
 */

import type { GameSpec, EntitySpec, TileMap } from "../dsl/types";
import { createEntity, type Entity } from "./entity";
import { Rng } from "./rng";

export type GameStatus = "playing" | "won" | "lost";

export class World {
  readonly spec: GameSpec;
  readonly width: number;
  readonly height: number;
  readonly edges: "wall" | "wrap" | "bounce";
  readonly rng: Rng;

  /** Visible window onto the world (the camera viewport). */
  readonly viewW: number;
  readonly viewH: number;
  /** Camera top-left in world coords (scrolls to follow the player). */
  camX = 0;
  camY = 0;

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
    // A tilemap sizes the world (cols*tile x rows*tile); otherwise use world.w/h.
    if (spec.map) {
      const cols = Math.max(...spec.map.rows.map((r) => r.length));
      this.width = cols * spec.map.tile;
      this.height = spec.map.rows.length * spec.map.tile;
    } else {
      this.width = spec.world.width ?? 800;
      this.height = spec.world.height ?? 600;
    }
    this.viewW = spec.world.viewport?.width ?? this.width;
    this.viewH = spec.world.viewport?.height ?? this.height;
    this.edges = spec.world.edges ?? "wall";
    this.rng = new Rng(seed);
    this.vars = { ...(spec.vars ?? {}) };
    for (const e of spec.entities) this.specsById.set(e.id, e);
    this.populate();
    this.updateCamera();
  }

  /** Scroll the view to centre on the player, clamped to the world. */
  updateCamera(): void {
    if (this.viewW >= this.width && this.viewH >= this.height) {
      this.camX = 0;
      this.camY = 0;
      return;
    }
    const p = this.firstOf("player");
    if (!p) return;
    this.camX = Math.max(0, Math.min(this.width - this.viewW, p.x - this.viewW / 2));
    this.camY = Math.max(0, Math.min(this.height - this.viewH, p.y - this.viewH / 2));
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
    // Entity types placed by the map are positioned by the grid, not by their
    // own spawn config — skip them here.
    const mapped = new Set(Object.values(this.spec.map?.legend ?? {}));
    for (const spec of this.spec.entities) {
      if (mapped.has(spec.id)) continue;
      const count = spec.spawn.count ?? 1;
      for (let i = 0; i < count; i++) this.spawn(spec.id);
    }
    if (this.spec.map) this.placeMap(this.spec.map);
  }

  /** Expand the grid: place each legend entity at its cell centre. */
  private placeMap(map: TileMap): void {
    const half = map.tile / 2;
    for (let r = 0; r < map.rows.length; r++) {
      const row = map.rows[r]!;
      for (let c = 0; c < row.length; c++) {
        const id = map.legend[row[c]!];
        if (!id) continue;
        const e = this.spawn(id);
        if (e) {
          e.x = c * map.tile + half;
          e.y = r * map.tile + half;
        }
      }
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
   * Per-step entity timers: tick down a hit-`flash` (visual only) and the
   * reserved `ttl` prop (seconds), killing the entity at ttl zero. Lets
   * projectiles/effects clean themselves up without per-rule bookkeeping.
   * Called each step before reaping.
   */
  stepLifetimes(dt: number): void {
    for (const e of this.entities) {
      if (!e.alive) continue;
      // Tick down a hit-flash, if any (visual only).
      if (e.flash > 0) e.flash = Math.max(0, e.flash - dt);
      if (e.props.ttl === undefined) continue;
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
