/**
 * No-asset renderer. Draws the world with primitive shapes -- the whole point
 * of GamePilot v0 is that "visuals are semantic carriers, not the product."
 * Circles/dots/squares + flat colors, plus a subtle glow so it doesn't look
 * dead. A second canvas layer (the HUD) draws score and end-state overlays.
 */

import type { World, GameStatus } from "../engine/world";
import type { Entity } from "../engine/entity";

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private hud: CanvasRenderingContext2D;

  constructor(
    gameCanvas: HTMLCanvasElement,
    hudCanvas: HTMLCanvasElement,
    world: World,
  ) {
    // The canvas is the viewport (the visible window), not the whole world.
    gameCanvas.width = world.viewW;
    gameCanvas.height = world.viewH;
    hudCanvas.width = world.viewW;
    hudCanvas.height = world.viewH;
    const ctx = gameCanvas.getContext("2d");
    const hud = hudCanvas.getContext("2d");
    if (!ctx || !hud) throw new Error("2D canvas context unavailable");
    this.ctx = ctx;
    this.hud = hud;
  }

  draw(world: World, paused = false): void {
    const ctx = this.ctx;
    ctx.fillStyle = world.spec.world.background ?? "#0b0b12";
    ctx.fillRect(0, 0, world.viewW, world.viewH);

    // Translate by the camera so world coords map into the viewport; cull
    // anything off-screen (matters for big maps).
    ctx.save();
    ctx.translate(-world.camX, -world.camY);
    const x0 = world.camX, y0 = world.camY, x1 = world.camX + world.viewW, y1 = world.camY + world.viewH;
    for (const e of world.entities) {
      if (!e.alive) continue;
      if (e.x + e.size < x0 || e.x - e.size > x1 || e.y + e.size < y0 || e.y - e.size > y1) continue;
      this.drawEntity(e, world.time);
    }
    ctx.restore();

    this.drawHud(world);
    if (paused && world.status === "playing") this.drawPaused(world);
  }

  private drawPaused(world: World): void {
    const hud = this.hud;
    hud.fillStyle = "rgba(7,7,13,0.5)";
    hud.fillRect(0, 0, world.viewW, world.viewH);
    hud.textAlign = "center";
    hud.fillStyle = "rgba(232,232,240,0.92)";
    hud.font = "700 36px ui-sans-serif, system-ui, sans-serif";
    hud.fillText("PAUSED", world.viewW / 2, world.viewH / 2 - 6);
    hud.font = "400 14px ui-sans-serif, system-ui, sans-serif";
    hud.fillStyle = "rgba(232,232,240,0.5)";
    hud.fillText("press Resume to continue", world.viewW / 2, world.viewH / 2 + 26);
    hud.textAlign = "left";
  }

  private drawEntity(e: Entity, time: number): void {
    if (e.tiles?.length) {
      this.drawTiles(e);
      return;
    }
    if (e.parts?.length) {
      this.drawParts(e);
      return;
    }
    if (e.frames?.length) {
      this.drawGlyph(e, time);
      return;
    }
    const ctx = this.ctx;
    const color = e.flash > 0 ? e.flashColor : e.color;
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = (e.shape === "dot" ? 8 : 14) + (e.flash > 0 ? 12 : 0);
    ctx.fillStyle = color;
    if (e.shape === "square") {
      const s = e.size;
      ctx.fillRect(e.x - s, e.y - s, s * 2, s * 2);
    } else {
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  /** Which animation frame to show now (deterministic, driven by sim time). */
  private frameIndex(e: Entity, time: number): number {
    const n = e.frames!.length;
    if (n <= 1) return 0;
    if (e.loop) {
      // Loop on fps. A small per-entity phase keeps a crowd out of lockstep.
      return Math.floor(time * e.fps + (e.iid % n)) % n;
    }
    // One-shot: spread the frames across the entity's ttl lifetime if it has
    // one (an explosion fills its short life), else play once at fps and hold.
    const t = e.ttl0 > 0 ? 1 - (e.props.ttl ?? 0) / e.ttl0 : time * e.fps / n;
    return Math.min(n - 1, Math.max(0, Math.floor(t * n)));
  }

  /** Draw a pixel-grid glyph (current animation frame) scaled to the entity's box. */
  private drawGlyph(e: Entity, time: number): void {
    const rows = e.frames![this.frameIndex(e, time)]!;
    const color = e.flash > 0 ? e.flashColor : e.color;
    this.drawBitmap(e, rows, color, e.flash > 0 ? 20 : 8);
  }

  /** Draw a composed glyph: each layer's bitmap in its own color, back-to-front. */
  private drawParts(e: Entity): void {
    const flashing = e.flash > 0;
    for (const layer of e.parts!) {
      const color = flashing ? e.flashColor : layer.color ?? e.color;
      this.drawBitmap(e, layer.rows, color, flashing ? 20 : 8);
    }
  }

  /** Draw a tile-grid glyph: lay each tile in its grid cell to form one big sprite. */
  private drawTiles(e: Entity): void {
    const grid = e.tiles!;
    const rows = grid.length;
    const cols = Math.max(...grid.map((row) => row.length));
    if (!rows || !cols) return;
    const span = e.size * 2;
    const cell = span / Math.max(rows, cols); // square tiles, centred
    const ox = -(cols * cell) / 2;
    const oy = -(rows * cell) / 2;
    const flashing = e.flash > 0;
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(e.x, e.y);
    if (e.rotate) ctx.rotate(Math.atan2(e.hy, e.hx) + Math.PI / 2);
    for (let r = 0; r < rows; r++) {
      const row = grid[r]!;
      for (let c = 0; c < row.length; c++) {
        const tile = row[c];
        if (!tile) continue;
        const color = flashing ? e.flashColor : tile.color ?? e.color;
        this.fillBitmap(tile.rows, ox + (c + 0.5) * cell, oy + (r + 0.5) * cell, cell / 2, color, flashing ? 12 : 6);
      }
    }
    ctx.restore();
  }

  /** Draw a bitmap scaled to the entity's box, rotated to its heading. */
  private drawBitmap(e: Entity, rows: string[], color: string, glow: number): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(e.x, e.y);
    // Bitmaps are authored facing "up" (0,-1); rotate to the entity's heading.
    if (e.rotate) ctx.rotate(Math.atan2(e.hy, e.hx) + Math.PI / 2);
    this.fillBitmap(rows, 0, 0, e.size, color, glow);
    ctx.restore();
  }

  /** Low-level: fill an "on"-cell bitmap centred at (cx,cy) with half-extent `half`.
   *  Assumes the caller has already set up the transform (translate/rotate). */
  private fillBitmap(rows: string[], cx: number, cy: number, half: number, color: string, glow: number): void {
    const ctx = this.ctx;
    const nrows = rows.length;
    const ncols = Math.max(...rows.map((r) => r.length));
    if (!nrows || !ncols) return;
    const span = half * 2;
    const cw = span / ncols;
    const ch = span / nrows;
    ctx.shadowColor = color;
    ctx.shadowBlur = glow;
    ctx.fillStyle = color;
    for (let r = 0; r < nrows; r++) {
      const row = rows[r]!;
      for (let c = 0; c < row.length; c++) {
        const cell = row[c]!;
        if (cell !== " " && cell !== "." && cell !== "0") {
          // +0.5 overlap avoids hairline seams between cells.
          ctx.fillRect(cx - half + c * cw, cy - half + r * ch, cw + 0.5, ch + 0.5);
        }
      }
    }
  }

  private drawHud(world: World): void {
    const hud = this.hud;
    hud.clearRect(0, 0, world.viewW, world.viewH);

    hud.fillStyle = "rgba(232,232,240,0.9)";
    hud.font = "600 16px ui-sans-serif, system-ui, sans-serif";
    hud.textBaseline = "top";
    // Score plus any global vars (lives/level/ammo/...).
    const fmt = (v: number) => (Number.isInteger(v) ? `${v}` : `${Math.round(v * 100) / 100}`);
    const stats = [
      `Score ${world.score}`,
      ...Object.entries(world.vars).map(([k, v]) => `${k[0]!.toUpperCase()}${k.slice(1)} ${fmt(v)}`),
    ].join("    ");
    hud.fillText(stats, 14, 12);

    const title = world.spec.meta?.title;
    if (title) {
      hud.textAlign = "right";
      hud.fillStyle = "rgba(232,232,240,0.45)";
      hud.fillText(title, world.viewW - 14, 12);
      hud.textAlign = "left";
    }

    if (world.status !== "playing") this.drawOverlay(world, world.status);
  }

  private drawOverlay(world: World, status: GameStatus): void {
    const hud = this.hud;
    hud.fillStyle = "rgba(7,7,13,0.62)";
    hud.fillRect(0, 0, world.viewW, world.viewH);

    const cx = world.viewW / 2;
    const cy = world.viewH / 2;
    hud.textAlign = "center";
    hud.fillStyle = status === "won" ? "#7CFFB0" : "#ff8080";
    hud.font = "700 42px ui-sans-serif, system-ui, sans-serif";
    hud.fillText(status === "won" ? "YOU WIN" : "GAME OVER", cx, cy - 30);

    hud.fillStyle = "rgba(232,232,240,0.8)";
    hud.font = "500 18px ui-sans-serif, system-ui, sans-serif";
    hud.fillText(`Score ${world.score}`, cx, cy + 24);
    hud.fillStyle = "rgba(232,232,240,0.5)";
    hud.font = "400 14px ui-sans-serif, system-ui, sans-serif";
    hud.fillText("Press R to restart", cx, cy + 54);
    hud.textAlign = "left";
  }
}
