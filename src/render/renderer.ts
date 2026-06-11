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
    gameCanvas.width = world.width;
    gameCanvas.height = world.height;
    hudCanvas.width = world.width;
    hudCanvas.height = world.height;
    const ctx = gameCanvas.getContext("2d");
    const hud = hudCanvas.getContext("2d");
    if (!ctx || !hud) throw new Error("2D canvas context unavailable");
    this.ctx = ctx;
    this.hud = hud;
  }

  draw(world: World): void {
    const ctx = this.ctx;
    ctx.fillStyle = world.spec.world.background ?? "#0b0b12";
    ctx.fillRect(0, 0, world.width, world.height);

    for (const e of world.entities) {
      if (e.alive) this.drawEntity(e);
    }

    this.drawHud(world);
  }

  private drawEntity(e: Entity): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.shadowColor = e.color;
    ctx.shadowBlur = e.shape === "dot" ? 8 : 14;
    ctx.fillStyle = e.color;
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

  private drawHud(world: World): void {
    const hud = this.hud;
    hud.clearRect(0, 0, world.width, world.height);

    hud.fillStyle = "rgba(232,232,240,0.9)";
    hud.font = "600 16px ui-sans-serif, system-ui, sans-serif";
    hud.textBaseline = "top";
    hud.fillText(`Score ${world.score}`, 14, 12);

    const title = world.spec.meta?.title;
    if (title) {
      hud.textAlign = "right";
      hud.fillStyle = "rgba(232,232,240,0.45)";
      hud.fillText(title, world.width - 14, 12);
      hud.textAlign = "left";
    }

    if (world.status !== "playing") this.drawOverlay(world, world.status);
  }

  private drawOverlay(world: World, status: GameStatus): void {
    const hud = this.hud;
    hud.fillStyle = "rgba(7,7,13,0.62)";
    hud.fillRect(0, 0, world.width, world.height);

    const cx = world.width / 2;
    const cy = world.height / 2;
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
