/**
 * Movement systems: translate control + behaviour into velocity, then
 * integrate position and resolve world edges. Runs every simulation step.
 */

import type { World } from "./world";
import type { Entity } from "./entity";
import type { Input } from "./input";

function aimToward(e: Entity, tx: number, ty: number, sign: number): void {
  const dx = tx - e.x;
  const dy = ty - e.y;
  const len = Math.hypot(dx, dy) || 1;
  e.vx = (dx / len) * e.speed * sign;
  e.vy = (dy / len) * e.speed * sign;
}

function applyControl(e: Entity, input: Input): void {
  if (e.control === "follow-pointer") {
    if (input.pointerActive) {
      const dist = Math.hypot(input.pointerX - e.x, input.pointerY - e.y);
      // Ease off near the target so the blob doesn't jitter on top of the cursor.
      if (dist > e.size * 0.5) aimToward(e, input.pointerX, input.pointerY, 1);
      else (e.vx = 0), (e.vy = 0);
    } else {
      e.vx = 0;
      e.vy = 0;
    }
  } else if (e.control === "arrows") {
    const ax = input.axisX;
    const ay = input.axisY;
    const len = Math.hypot(ax, ay) || 1;
    e.vx = (ax / len) * e.speed * (ax || ay ? 1 : 0);
    e.vy = (ay / len) * e.speed * (ax || ay ? 1 : 0);
  }
}

function applyBehavior(e: Entity, world: World): void {
  if (!e.behavior) return;
  const { verb, target } = e.behavior;
  if (verb === "chase" || verb === "flee") {
    const t = target ? world.firstOf(target) : undefined;
    if (t) aimToward(e, t.x, t.y, verb === "chase" ? 1 : -1);
  } else if (verb === "wander") {
    // Slowly rotate a persistent heading for smooth drift.
    const h = (e.scratch.heading ?? (e.scratch.heading = world.rng.range(0, Math.PI * 2)));
    const nh = h + world.rng.range(-0.25, 0.25);
    e.scratch.heading = nh;
    e.vx = Math.cos(nh) * e.speed;
    e.vy = Math.sin(nh) * e.speed;
  }
}

function integrate(e: Entity, world: World, dt: number): void {
  e.x += e.vx * dt;
  e.y += e.vy * dt;
  const m = e.size;
  if (world.edges === "wrap") {
    if (e.x < -m) e.x = world.width + m;
    if (e.x > world.width + m) e.x = -m;
    if (e.y < -m) e.y = world.height + m;
    if (e.y > world.height + m) e.y = -m;
  } else {
    e.x = Math.min(world.width - m, Math.max(m, e.x));
    e.y = Math.min(world.height - m, Math.max(m, e.y));
  }
}

export function stepMovement(world: World, input: Input, dt: number): void {
  for (const e of world.entities) {
    if (!e.alive) continue;
    applyControl(e, input);
    applyBehavior(e, world);
    integrate(e, world, dt);
  }
}
