/**
 * The glyph gallery page (/glyphs): renders every built-in GLYPH_PRESETS entry
 * to a small canvas so you can browse the library, with multi-frame presets
 * animating live. Draws the pixel grid the same way the engine renderer does —
 * "on" cells (any char but space/"."/"0") filled in the glyph's color with a
 * subtle glow. Plain DOM, no framework.
 */

import { GLYPH_PRESETS, COMPOSED_PRESETS, GLYPH_V2_OF, resolveParts, type ResolvedLayer } from "./dsl/glyphs";
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

/** Paint one bitmap layer in a color (does NOT clear — so layers can stack). */
function paint(ctx: CanvasRenderingContext2D, rows: string[] | undefined, color: string): void {
  if (!rows) return;
  const nrows = rows.length;
  const ncols = Math.max(...rows.map((r) => r.length));
  if (!nrows || !ncols) return;
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

/** Clear then paint a single monochrome frame. */
function drawFrame(ctx: CanvasRenderingContext2D, rows: string[] | undefined, color: string): void {
  ctx.clearRect(0, 0, PX, PX);
  paint(ctx, rows, color);
}

interface Animated { ctx: CanvasRenderingContext2D; frames: string[][]; color: string; }
interface AnimatedComposed { ctx: CanvasRenderingContext2D; frames: ResolvedLayer[][]; }

const gallery = document.getElementById("gallery") as HTMLDivElement;
const countEl = document.getElementById("count") as HTMLSpanElement;
const animated: Animated[] = [];
const animatedComposed: AnimatedComposed[] = [];

/** Clear then paint one composed frame's layers onto a canvas. */
function paintComposedFrame(ctx: CanvasRenderingContext2D, layers: ResolvedLayer[] | undefined): void {
  ctx.clearRect(0, 0, PX, PX);
  for (const layer of layers ?? []) paint(ctx, layer.rows, layer.color ?? "#9be15d");
}

const names = Object.keys(GLYPH_PRESETS);
const composedNames = Object.keys(COMPOSED_PRESETS);
countEl.textContent = `${names.length} mono + ${composedNames.length} composed · DSL v${DSL_VERSION}`;

const el = (tag: string, cls: string) => Object.assign(document.createElement(tag), { className: cls });
function newCanvas(px: string): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = c.height = PX;
  c.style.width = c.style.height = px;
  return c;
}
function section(label: string, sub: string): void {
  const h = el("div", "section");
  h.innerHTML = `${label} <span>${sub}</span>`;
  gallery.appendChild(h);
}
/** Paint a v1 monochrome preset onto a fresh canvas (registers animation). */
function monoCanvas(name: string, px: string): HTMLCanvasElement {
  const frames = GLYPH_PRESETS[name]!;
  const color = COLORS[name] ?? "#9be15d";
  const canvas = newCanvas(px);
  const ctx = canvas.getContext("2d")!;
  drawFrame(ctx, frames[0]!, color);
  if (frames.length > 1) animated.push({ ctx, frames, color });
  return canvas;
}
/** Paint a composed (layered) preset onto a fresh canvas (animates if multi-frame). */
function composedCanvas(name: string, px: string): HTMLCanvasElement {
  const canvas = newCanvas(px);
  const ctx = canvas.getContext("2d")!;
  const frames = resolveParts(name) ?? [];
  paintComposedFrame(ctx, frames[0]);
  if (frames.length > 1) animatedComposed.push({ ctx, frames });
  return canvas;
}

// --- Section 1: every v1 monochrome preset ---
section("v1 — monochrome", "single colour, drawn in the entity's color");
for (const name of names) {
  const frames = GLYPH_PRESETS[name]!;
  const isAnim = frames.length > 1;
  const card = el("div", "card");
  const nameEl = el("div", "name");
  nameEl.textContent = name;
  const tag = el("div", isAnim ? "tag anim" : "tag");
  tag.textContent = isAnim ? `▸ ${frames.length} frames` : `${frames[0]!.length}×${Math.max(...frames[0]!.map((r) => r.length))}`;
  card.append(monoCanvas(name, "84px"), nameEl, tag);
  gallery.appendChild(card);
}

// --- Section 2: v2 composed remakes, shown next to their v1 for comparison ---
section("v2 — composed colour", "multi-layer sprites · v1 → v2");
const paired = new Set<string>();
for (const [v1, v2] of Object.entries(GLYPH_V2_OF)) {
  if (!GLYPH_PRESETS[v1] || !COMPOSED_PRESETS[v2]) continue;
  paired.add(v2);
  const card = el("div", "card");
  const pair = el("div", "pair");
  const f1 = document.createElement("figure");
  f1.append(monoCanvas(v1, "60px"), Object.assign(document.createElement("figcaption"), { textContent: "v1" }));
  const arrow = el("div", "arrow");
  arrow.textContent = "→";
  const f2 = document.createElement("figure");
  f2.append(composedCanvas(v2, "60px"), Object.assign(document.createElement("figcaption"), { textContent: "v2" }));
  pair.append(f1, arrow, f2);
  const nameEl = el("div", "name");
  nameEl.textContent = `${v1} → ${v2}`;
  const tag = el("div", "tag");
  tag.textContent = `${(resolveParts(v2) ?? []).length} layers`;
  card.append(pair, nameEl, tag);
  gallery.appendChild(card);
}
// Any composed preset without a v1 remake — show on its own.
for (const name of composedNames) {
  if (paired.has(name)) continue;
  const card = el("div", "card");
  const nameEl = el("div", "name");
  nameEl.textContent = name;
  const tag = el("div", "tag");
  tag.textContent = `◆ ${(resolveParts(name) ?? []).length} layers`;
  card.append(composedCanvas(name, "84px"), nameEl, tag);
  gallery.appendChild(card);
}

// Loop the multi-frame previews at 6 fps (matches the engine's default). A plain
// frame counter keeps the index trivially in range (no timestamp math).
const FPS = 6;
let frame = 0;
if (animated.length || animatedComposed.length) {
  setInterval(() => {
    frame++;
    for (const a of animated) drawFrame(a.ctx, a.frames[frame % a.frames.length], a.color);
    for (const a of animatedComposed) paintComposedFrame(a.ctx, a.frames[frame % a.frames.length]);
  }, 1000 / FPS);
}
