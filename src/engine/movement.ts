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

function applyControl(e: Entity, input: Input, world: World): void {
  if (e.control === "follow-pointer") {
    if (input.pointerActive) {
      // Pointer is in viewport pixels; add the camera to get world coords.
      const px = input.pointerX + world.camX;
      const py = input.pointerY + world.camY;
      const dist = Math.hypot(px - e.x, py - e.y);
      // Ease off near the target so the blob doesn't jitter on top of the cursor.
      if (dist > e.size * 0.5) aimToward(e, px, py, 1);
      else (e.vx = 0), (e.vy = 0);
    } else {
      e.vx = 0;
      e.vy = 0;
    }
  } else if (e.control === "follow-pointer-x") {
    // Track only the cursor's X (a paddle); never move vertically.
    if (input.pointerActive) {
      const px = input.pointerX + world.camX;
      const dist = Math.abs(px - e.x);
      e.vx = dist > e.size * 0.5 ? Math.sign(px - e.x) * e.speed : 0;
    } else {
      e.vx = 0;
    }
    e.vy = 0;
  } else if (e.control === "arrows") {
    const ax = input.axisX;
    const ay = input.axisY;
    const len = Math.hypot(ax, ay) || 1;
    e.vx = (ax / len) * e.speed * (ax || ay ? 1 : 0);
    e.vy = (ay / len) * e.speed * (ax || ay ? 1 : 0);
  } else if (e.control === "runner") {
    // Always moving forward in the current heading. A TAP of an arrow/WASD latches
    // a new cardinal heading (edge-triggered, so a quick tap turns you and you
    // keep going), but a direct 180° reversal is refused — you can't turn back
    // into your own trail. Heading defaults to "up", so it starts moving at once.
    const pressed = input.frameEnv().pressed;
    let dx = e.hx;
    let dy = e.hy;
    if (pressed.has("left") || pressed.has("a")) { dx = -1; dy = 0; }
    else if (pressed.has("right") || pressed.has("d")) { dx = 1; dy = 0; }
    else if (pressed.has("up") || pressed.has("w")) { dx = 0; dy = -1; }
    else if (pressed.has("down") || pressed.has("s")) { dx = 0; dy = 1; }
    if (!(dx === -e.hx && dy === -e.hy)) { e.hx = dx; e.hy = dy; }
    e.vx = e.hx * e.speed;
    e.vy = e.hy * e.speed;
  } else if (e.control === "platformer") {
    // Left/right run; vertical is owned by gravity (in integrate). Jump is an
    // upward impulse on a key-down edge, ONLY when grounded (no mid-air jumps).
    e.vx = input.axisX * e.speed;
    if (e.vx !== 0) e.hx = Math.sign(e.vx);
    const pressed = input.frameEnv().pressed;
    if (e.grounded && (pressed.has("up") || pressed.has("w") || pressed.has("space"))) {
      e.vy = -(e.props.jump || 500);
      e.grounded = false;
    }
  }
}

/** Is there a solid entity covering this point? (ground-ahead check for walkers) */
function solidBelow(world: World, x: number, y: number): boolean {
  for (const s of world.entities) {
    if (!s.alive || !s.solid) continue;
    const half = s.size;
    if (x >= s.x - half && x <= s.x + half && y >= s.y - half && y <= s.y + half) return true;
  }
  return false;
}

function applyBehavior(e: Entity, world: World): void {
  if (!e.behavior) return;
  const { verb, target } = e.behavior;
  if (verb === "chase" || verb === "flee") {
    const t = target ? world.firstOf(target) : undefined;
    if (t) aimToward(e, t.x, t.y, verb === "chase" ? 1 : -1);
  } else if (verb === "walker") {
    // Patrol horizontally (a Goomba). Gravity (in integrate) owns the vertical;
    // reverse when blocked by a wall, or when grounded with no ground ahead (a
    // ledge) so it stays on its platform.
    let dir = e.scratch.wdir ?? -1;
    const moved = Math.abs(e.x - (e.scratch.wlastx ?? e.x));
    const wall = moved < 0.3 && world.time > 0.3;
    const ledge = e.grounded && !solidBelow(world, e.x + dir * (e.size + 2), e.y + e.size + 4);
    if (wall || ledge) dir = -dir;
    e.scratch.wdir = dir;
    e.scratch.wlastx = e.x;
    e.vx = dir * e.speed;
  } else if (verb === "wander") {
    // Roam deliberately: hold a random cardinal direction for a beat, then pick
    // a new one (and re-pick early when stuck against a wall). Tank-like, not
    // jittery, and never targets anything.
    const blocked = Math.hypot(e.x - (e.scratch.wlx ?? e.x), e.y - (e.scratch.wly ?? e.y)) < 0.5;
    if (world.time >= (e.scratch.wnext ?? 0) || (blocked && world.time > 0.2)) {
      const dirs = [
        [0, -1],
        [0, 1],
        [-1, 0],
        [1, 0],
      ] as const;
      const d = dirs[Math.floor(world.rng.range(0, 4))]!;
      e.scratch.wdx = d[0];
      e.scratch.wdy = d[1];
      e.scratch.wnext = world.time + world.rng.range(0.7, 1.8);
    }
    e.scratch.wlx = e.x;
    e.scratch.wly = e.y;
    e.vx = (e.scratch.wdx ?? 0) * e.speed;
    e.vy = (e.scratch.wdy ?? -1) * e.speed;
  }
}

/**
 * A free-flying projectile: no control, no behaviour, just a velocity carrying it
 * (a bullet/shell/ball/car). It LEAVES the world at an edge, and PASSES THROUGH
 * solids — its fate is decided by collision rules (which destroy it on a hit), not
 * by the solid resolver. So it never piles up against a wall nor ricochets off a
 * solid square's AABB corner (whose reach exceeds the entity's hit circle).
 */
function isFlying(e: Entity): boolean {
  return e.control === "none" && !e.behavior && (e.vx !== 0 || e.vy !== 0);
}

function integrate(e: Entity, world: World, dt: number): void {
  // Platformer gravity: accelerate downward (capped to avoid tunnelling thin
  // platforms), then integrate. Affects the platformer player and `walker`
  // enemies (Goombas) — both fall and land on solids.
  if (world.gravity && (e.control === "platformer" || e.behavior?.verb === "walker")) {
    e.vy = Math.min(e.vy + world.gravity * dt, 1200);
  }
  e.x += e.vx * dt;
  e.y += e.vy * dt;
  const m = e.size;
  // A free-flying projectile (a bullet/car/shell: no control, no behaviour, just
  // a velocity carrying it) LEAVES the world at an edge — it must not clamp and
  // pile up against the wall (which, with a ttl, looks like "stuck then vanish").
  // Steered/autonomous entities (the player, behaviour movers) still clamp.
  const flying = isFlying(e);
  if (world.edges === "wrap") {
    if (e.x < -m) e.x = world.width + m;
    if (e.x > world.width + m) e.x = -m;
    if (e.y < -m) e.y = world.height + m;
    if (e.y > world.height + m) e.y = -m;
  } else if (world.edges === "bounce") {
    // Reflect off left/right/top; leave the BOTTOM open so paddle games can miss.
    if (e.x < m) { e.x = m; e.vx = Math.abs(e.vx); }
    else if (e.x > world.width - m) { e.x = world.width - m; e.vx = -Math.abs(e.vx); }
    if (e.y < m) { e.y = m; e.vy = Math.abs(e.vy); }
    if (flying && e.y > world.height + m) e.alive = false; // fell out the open bottom
  } else if (flying && (e.x < m || e.x > world.width - m || e.y < m || e.y > world.height - m)) {
    e.alive = false; // a projectile reached a wall -> it flies off, doesn't stick
  } else {
    e.x = Math.min(world.width - m, Math.max(m, e.x));
    e.y = Math.min(world.height - m, Math.max(m, e.y));
  }
}

/** Snap facing to the dominant cardinal of the current velocity (keeps last when stopped). */
function updateHeading(e: Entity): void {
  if (Math.hypot(e.vx, e.vy) < 1) return;
  if (Math.abs(e.vx) >= Math.abs(e.vy)) {
    e.hx = Math.sign(e.vx);
    e.hy = 0;
  } else {
    e.hx = 0;
    e.hy = Math.sign(e.vy);
  }
}

export function stepMovement(world: World, input: Input, dt: number): void {
  for (const e of world.entities) {
    if (!e.alive) continue;
    applyControl(e, input, world);
    applyBehavior(e, world);
    updateHeading(e);
    integrate(e, world, dt);
  }
}

/** Whether an entity can be pushed (a tank/unit) vs. a static placement (a wall). */
function movable(e: Entity): boolean {
  return e.control !== "none" || !!e.behavior;
}

/**
 * Displacement to move `m` (circle, r = size) out of `s` (axis-aligned box,
 * half = size). null if they don't overlap. Circle-vs-AABB gives natural
 * wall-stopping/sliding.
 */
function pushVector(m: Entity, s: Entity): { x: number; y: number } | null {
  const half = s.size;
  const r = m.size;
  const cx = Math.max(s.x - half, Math.min(m.x, s.x + half));
  const cy = Math.max(s.y - half, Math.min(m.y, s.y + half));
  const dx = m.x - cx;
  const dy = m.y - cy;
  const dist = Math.hypot(dx, dy);
  if (dist >= r) return null;
  if (dist > 1e-6) {
    const push = r - dist;
    return { x: (dx / dist) * push, y: (dy / dist) * push };
  }
  // Centre inside the box — eject along the shallowest axis.
  const left = m.x - (s.x - half);
  const right = s.x + half - m.x;
  const top = m.y - (s.y - half);
  const bottom = s.y + half - m.y;
  const min = Math.min(left, right, top, bottom);
  if (min === left) return { x: s.x - half - r - m.x, y: 0 };
  if (min === right) return { x: s.x + half + r - m.x, y: 0 };
  if (min === top) return { x: 0, y: s.y - half - r - m.y };
  return { x: 0, y: s.y + half + r - m.y };
}

/**
 * Keep entities from overlapping solids:
 *  1. non-solid movers (bullets, etc.) are pushed fully out of any solid.
 *  2. two solids that overlap are separated — both move if both are movable
 *     (tanks bumping tanks), only the movable one moves against a static wall.
 * Runs after rules so a collision rule (e.g. bullet destroys a brick) still
 * sees the overlap first.
 */
export function resolveSolids(world: World): void {
  // Recompute grounded each step (a platformer mover is grounded only while a
  // solid is pushing it up this frame).
  for (const e of world.entities) if (e.alive) e.grounded = false;
  const solids = world.entities.filter((e) => e.alive && e.solid);
  if (!solids.length) return;

  for (const m of world.entities) {
    if (!m.alive || m.solid || isFlying(m)) continue; // flying projectiles pass through solids
    for (const s of solids) {
      const p = pushVector(m, s);
      if (p) {
        m.x += p.x;
        m.y += p.y;
        // Landing on a solid's top stops the fall and grounds the mover; a head
        // bonk on a solid's underside just stops upward motion.
        if (p.y < 0 && m.vy > 0) { m.vy = 0; m.grounded = true; }
        else if (p.y > 0 && m.vy < 0) { m.vy = 0; }
      }
    }
  }

  for (let i = 0; i < solids.length; i++) {
    for (let j = i + 1; j < solids.length; j++) {
      const a = solids[i]!;
      const b = solids[j]!;
      const am = movable(a);
      const bm = movable(b);
      if (!am && !bm) continue; // two static walls — leave them
      const p = pushVector(a, b);
      if (!p) continue;
      if (am && bm) {
        a.x += p.x / 2;
        a.y += p.y / 2;
        b.x -= p.x / 2;
        b.y -= p.y / 2;
      } else if (am) {
        a.x += p.x;
        a.y += p.y;
      } else {
        b.x -= p.x;
        b.y -= p.y;
      }
    }
  }
}
