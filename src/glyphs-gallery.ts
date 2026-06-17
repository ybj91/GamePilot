/**
 * The glyph gallery page (/glyphs): renders every built-in GLYPH_PRESETS entry
 * to a small canvas so you can browse the library, with multi-frame presets
 * animating live. Draws the pixel grid the same way the engine renderer does —
 * "on" cells (any char but space/"."/"0") filled in the glyph's color with a
 * subtle glow. Plain DOM, no framework.
 */

import { GLYPH_PRESETS } from "./dsl/glyphs";
import { DSL_VERSION } from "./dsl/version";

/** A fitting color per preset (falls back to a soft green). Visual only. */
const COLORS: Record<string, string> = {
  tank: "#8cb33a", ship: "#9ad0ff", arrow: "#ffd23f", heart: "#ff5d73", star: "#ffd23f",
  diamond: "#7CFFB0", plus: "#9be15d", ring: "#9ad0ff", face: "#ffd23f", skull: "#dfe4f2",
  alien: "#9be15d", invader: "#d24b4b", blob: "#a86bd6", flame: "#ff9a3c", explosion: "#ff9a3c",
  hero: "#e23d3d", coin: "#ffd23f", brick: "#c8743a", flag: "#39d353", mushroom: "#ff5d73",
  pipe: "#2ec16e", goomba: "#b07a3a",
  tree: "#4caf50", flower: "#ff7eb6", cloud: "#dfe7f2", bush: "#5fae5f", mountain: "#9aa0aa",
  sun: "#ffd23f", moon: "#e6e6c0", drop: "#5bb8ff", rock: "#9a9aa2", grass: "#7bc043",
  leaf: "#6fbf4a", snowflake: "#a8e0ff", house: "#d98a4a", bird: "#9ad0ff", key: "#ffd23f",
  crown: "#ffcf3a",
};

const PX = 96; // canvas size

const on = (ch: string) => ch !== " " && ch !== "." && ch !== "0";

function drawFrame(ctx: CanvasRenderingContext2D, rows: string[] | undefined, color: string): void {
  if (!rows) return;
  const nrows = rows.length;
  const ncols = Math.max(...rows.map((r) => r.length));
  if (!nrows || !ncols) return;
  ctx.clearRect(0, 0, PX, PX);
  const pad = PX * 0.16;
  const span = PX - pad * 2;
  const cw = span / ncols;
  const ch = span / nrows;
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = 7;
  ctx.fillStyle = color;
  for (let r = 0; r < nrows; r++) {
    const row = rows[r]!;
    for (let c = 0; c < row.length; c++) {
      if (on(row[c]!)) ctx.fillRect(pad + c * cw, pad + r * ch, cw + 0.5, ch + 0.5);
    }
  }
  ctx.restore();
}

interface Animated { ctx: CanvasRenderingContext2D; frames: string[][]; color: string; }

const gallery = document.getElementById("gallery") as HTMLDivElement;
const countEl = document.getElementById("count") as HTMLSpanElement;
const animated: Animated[] = [];

const names = Object.keys(GLYPH_PRESETS);
countEl.textContent = `${names.length} presets · DSL v${DSL_VERSION}`;

for (const name of names) {
  const frames = GLYPH_PRESETS[name]!;
  const color = COLORS[name] ?? "#9be15d";
  const isAnim = frames.length > 1;

  const card = document.createElement("div");
  card.className = "card";

  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = PX;
  canvas.style.width = canvas.style.height = "84px";
  const ctx = canvas.getContext("2d")!;
  drawFrame(ctx, frames[0]!, color);
  if (isAnim) animated.push({ ctx, frames, color });

  const nameEl = document.createElement("div");
  nameEl.className = "name";
  nameEl.textContent = name;

  const tag = document.createElement("div");
  tag.className = isAnim ? "tag anim" : "tag";
  tag.textContent = isAnim ? `▸ ${frames.length} frames` : `${frames[0]!.length}×${Math.max(...frames[0]!.map((r) => r.length))}`;

  card.append(canvas, nameEl, tag);
  gallery.appendChild(card);
}

// Loop the multi-frame previews at 6 fps (matches the engine's default). A plain
// frame counter keeps the index trivially in range (no timestamp math).
const FPS = 6;
let frame = 0;
if (animated.length) {
  setInterval(() => {
    frame++;
    for (const a of animated) drawFrame(a.ctx, a.frames[frame % a.frames.length], a.color);
  }, 1000 / FPS);
}
