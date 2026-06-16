/**
 * Engine: owns the World and advances it with a fixed-timestep loop decoupled
 * from rendering. The host (main.ts) calls `start()` with a render callback;
 * the engine accumulates real elapsed time and runs deterministic sim steps of
 * size DT, then invokes the renderer with the latest state.
 *
 * Update order per step matters:
 *   movement -> rules (collisions/tick/interval) -> reap dead -> maintain
 *   population -> check win/lose.
 */

import type { GameSpec } from "../dsl/types";
import { World } from "./world";
import { Input } from "./input";
import { stepMovement, resolveSolids } from "./movement";
import { evaluateRules, RuleTimers } from "./rules";
import { evalCondition } from "./conditions";

const DT = 1 / 60; // fixed simulation step (seconds)
const MAX_STEPS_PER_FRAME = 5; // avoid spiral-of-death after a tab stall

export type RenderFn = (world: World) => void;

export class Engine {
  readonly world: World;
  readonly input = new Input();
  private timers = new RuleTimers();
  private raf = 0;
  private last = 0;
  private acc = 0;
  private running = false;
  private paused = false;
  private render: RenderFn = () => {};
  private detachInput?: () => void;

  constructor(spec: GameSpec, seed?: number) {
    this.world = new World(spec, seed);
  }

  attachInput(canvas: HTMLCanvasElement): void {
    this.detachInput?.();
    this.detachInput = this.input.attach(canvas);
  }

  start(render: RenderFn): void {
    this.render = render;
    this.running = true;
    this.last = 0;
    this.acc = 0;
    // performance.now() is read inside the frame; the first frame seeds `last`.
    const frame = (now: number) => {
      if (!this.running) return;
      if (this.last === 0) this.last = now;
      let elapsed = (now - this.last) / 1000;
      this.last = now;
      // When paused, keep rendering (so the canvas + overlay stay live) but
      // don't advance the simulation or accrue time.
      if (!this.paused) {
        if (elapsed > 0.25) elapsed = 0.25; // clamp huge gaps
        this.acc += elapsed;
        let steps = 0;
        while (this.acc >= DT && steps < MAX_STEPS_PER_FRAME) {
          this.step(DT);
          this.acc -= DT;
          steps++;
        }
      }
      this.render(this.world);
      this.raf = requestAnimationFrame(frame);
    };
    this.raf = requestAnimationFrame(frame);
  }

  private step(dt: number): void {
    const w = this.world;
    if (w.status !== "playing") return;
    w.time += dt;

    stepMovement(w, this.input, dt);
    evaluateRules(w, this.timers, this.input.frameEnv(), dt);
    this.input.endFrame(); // consume this step's input edges
    w.stepLifetimes(dt); // expire ttl'd entities (projectiles)
    w.reap();
    resolveSolids(w); // push movers out of walls (after rules saw the overlap)
    w.maintainPopulations();

    if (w.status === "playing" && w.spec.win && evalCondition(w.spec.win.when, w)) {
      w.status = "won";
    }
    if (w.status === "playing" && w.spec.lose && evalCondition(w.spec.lose.when, w)) {
      w.status = "lost";
    }
  }

  get isPaused(): boolean {
    return this.paused;
  }

  pause(): void {
    this.paused = true;
  }

  resume(): void {
    this.paused = false;
    this.last = 0; // avoid a big time jump on the next frame
  }

  togglePause(): boolean {
    if (this.paused) this.resume();
    else this.pause();
    return this.paused;
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  dispose(): void {
    this.stop();
    this.detachInput?.();
  }
}
