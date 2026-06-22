/**
 * The glyph gallery page (/glyphs): renders every built-in GLYPH_PRESETS entry
 * to a small canvas so you can browse the library, with multi-frame presets
 * animating live. Draws the pixel grid the same way the engine renderer does —
 * "on" cells (any char but space/"."/"0") filled in the glyph's color with a
 * subtle glow. Plain DOM, no framework.
 */

import { GLYPH_PRESETS, FABRIC_PRESET_NAMES, COMPOSED_PRESETS, BIG16_PRESET_NAMES, GLYPH_V2_OF, TILE_EXAMPLES, resolvePainted, resolveTiles, type ResolvedLayer } from "./dsl/glyphs";
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
  // fabric / material tiles
  brickwork: "#cf8a5a", planks: "#b5793c", stone: "#9aa0aa", shingle: "#c0392b",
  window: "#7ec0ee", water: "#4aa3ff", sand: "#e2c489", arch: "#6b4a2a",
  // 16×16 detail sprites — fallback for their recolourable (X / no-entry) cells
  knight16: "#9aa3b0", dragon16: "#3aa54a", chest16: "#8b5a2b", potion16: "#a86bd6",
  robot16: "#9aa3b0", ufo16: "#9aa3b0", planet16: "#5b8bf0", bigtree16: "#3aa54a",
  campfire16: "#ff7a18", racecar16: "#e2554e",
};

/** The v1 name a composed (v2) preset remakes — to pick a natural fallback colour
 *  for a recolourable (colour-less) base layer in the gallery (in a real game the
 *  entity's own `color` fills it). */
const V1_OF: Record<string, string> = Object.fromEntries(
  Object.entries(GLYPH_V2_OF).map(([v1, v2]) => [v2, v1]),
);
const repColor = (composedName: string): string => COLORS[composedName] ?? COLORS[V1_OF[composedName] ?? ""] ?? "#9be15d";

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

/** Fill a bitmap into the rect (x, y, size) in a color (for laying out tiles). */
function paintInto(ctx: CanvasRenderingContext2D, rows: string[], x: number, y: number, size: number, color: string): void {
  const nrows = rows.length;
  const ncols = Math.max(...rows.map((r) => r.length));
  if (!nrows || !ncols) return;
  const cw = size / ncols;
  const ch = size / nrows;
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = 3;
  ctx.fillStyle = color;
  for (let r = 0; r < nrows; r++) {
    const row = rows[r]!;
    for (let c = 0; c < row.length; c++) {
      if (on(row[c]!)) ctx.fillRect(x + c * cw, y + r * ch, cw + 0.5, ch + 0.5);
    }
  }
  ctx.restore();
}

/** Lay out a resolved tile-grid into the canvas (centred, square tiles). Each cell
 *  is a stack of layers (a recoloured material v2 tile = body + accent). */
function paintTileGrid(ctx: CanvasRenderingContext2D, grid: (ResolvedLayer[] | null)[][]): void {
  ctx.clearRect(0, 0, PX, PX);
  const rows = grid.length;
  const cols = Math.max(...grid.map((r) => r.length));
  if (!rows || !cols) return;
  const pad = PX * 0.1;
  const cell = (PX - pad * 2) / Math.max(rows, cols);
  const ox = (PX - cols * cell) / 2;
  const oy = (PX - rows * cell) / 2;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < (grid[r]?.length ?? 0); c++) {
      const layers = grid[r]![c];
      if (!layers) continue;
      for (const layer of layers) paintInto(ctx, layer.rows, ox + c * cell, oy + r * cell, cell, layer.color ?? "#9be15d");
    }
  }
}

interface Animated { ctx: CanvasRenderingContext2D; frames: string[][]; color: string; }
interface AnimatedComposed { ctx: CanvasRenderingContext2D; frames: ResolvedLayer[][]; color: string; }

const gallery = document.getElementById("gallery") as HTMLDivElement;
const countEl = document.getElementById("count") as HTMLSpanElement;
const animated: Animated[] = [];
const animatedComposed: AnimatedComposed[] = [];

/** Clear then paint one composed frame's layers onto a canvas. A colour-less
 *  (recolourable) base layer falls back to the preset's natural colour here. */
function paintComposedFrame(ctx: CanvasRenderingContext2D, layers: ResolvedLayer[] | undefined, fallback: string): void {
  ctx.clearRect(0, 0, PX, PX);
  for (const layer of layers ?? []) paint(ctx, layer.rows, layer.color ?? fallback);
}

const fabricSet = new Set(FABRIC_PRESET_NAMES);
const big16Set = new Set(BIG16_PRESET_NAMES);
const names = Object.keys(GLYPH_PRESETS).filter((n) => !fabricSet.has(n)); // fabric tiles get their own section
const composedNames = Object.keys(COMPOSED_PRESETS).filter((n) => !big16Set.has(n)); // 16×16 sprites get their own section
countEl.textContent = `${names.length} mono + ${composedNames.length} composed + ${BIG16_PRESET_NAMES.length} 16×16 + ${FABRIC_PRESET_NAMES.length} fabric · DSL v${DSL_VERSION}`;

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
/** A tag showing a composed preset's colour count, or its frame count if animated. */
function composedTag(name: string): HTMLDivElement {
  const f = resolvePainted(name);
  const anim = !!f && f.length > 1;
  const div = el("div", anim ? "tag anim" : "tag") as HTMLDivElement;
  div.textContent = anim ? `▸ ${f!.length} frames` : `${f?.[0]?.length ?? 0} colours`;
  return div;
}

/** Paint a composed (painted) preset onto a fresh canvas (animates if multi-frame). */
function composedCanvas(name: string, px: string): HTMLCanvasElement {
  const canvas = newCanvas(px);
  const ctx = canvas.getContext("2d")!;
  const frames = resolvePainted(name) ?? [];
  const color = repColor(name);
  paintComposedFrame(ctx, frames[0], color);
  if (frames.length > 1) animatedComposed.push({ ctx, frames, color });
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
section("v2 — composed colour", "indexed-palette sprites · v1 → v2");
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
  card.append(pair, nameEl, composedTag(v2));
  gallery.appendChild(card);
}
// Any composed preset without a v1 remake — show on its own.
for (const name of composedNames) {
  if (paired.has(name)) continue;
  const card = el("div", "card");
  const nameEl = el("div", "name");
  nameEl.textContent = name;
  card.append(composedCanvas(name, "84px"), nameEl, composedTag(name));
  gallery.appendChild(card);
}

// --- Section 3: 16×16 detail sprites — the larger glyph budget, one entity each ---
section("16×16 — detail sprites", "one entity · grid + palette at 16×16 · X = entity colour");
for (const name of BIG16_PRESET_NAMES) {
  const card = el("div", "card");
  const nameEl = el("div", "name");
  nameEl.textContent = name;
  const tag = el("div", "tag");
  const pal = COMPOSED_PRESETS[name]?.palette ?? {};
  tag.textContent = `16×16 · ${Object.keys(pal).length} colours`;
  card.append(composedCanvas(name, "108px"), nameEl, tag);
  gallery.appendChild(card);
}

// --- Section 4: "fabric" material tiles — single-layer, recolourable, made to combine ---
section("fabric — tileable", "single-layer material patterns · recolour & combine");
for (const name of FABRIC_PRESET_NAMES) {
  const card = el("div", "card");
  const nameEl = el("div", "name");
  nameEl.textContent = name;
  const tag = el("div", "tag");
  tag.textContent = "1 layer · recolour";
  card.append(monoCanvas(name, "84px"), nameEl, tag);
  gallery.appendChild(card);
}

// --- Section 5: combined-tile examples (one big sprite assembled from tiles) ---
section("tiles — combined", "a big item built from small tiles · one entity");
for (const [name, grid] of Object.entries(TILE_EXAMPLES)) {
  const card = el("div", "card");
  const canvas = newCanvas("84px");
  paintTileGrid(canvas.getContext("2d")!, resolveTiles(grid) ?? []);
  const nameEl = el("div", "name");
  nameEl.textContent = name;
  const tag = el("div", "tag");
  tag.textContent = `${grid.length}×${Math.max(...grid.map((r) => r.length))} tiles`;
  card.append(canvas, nameEl, tag);
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
    for (const a of animatedComposed) paintComposedFrame(a.ctx, a.frames[frame % a.frames.length], a.color);
  }, 1000 / FPS);
}
