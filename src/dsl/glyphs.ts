/**
 * Built-in glyph presets — a small library of common shapes so authors can
 * write `glyph: "heart"` instead of hand-drawing a pixel grid every time. Still
 * pure data (no assets): each preset is just one or more bitmap frames.
 *
 * A frame is rows of a tiny bitmap; a cell is "on" for any char except space,
 * "." or "0". Presets are authored FACING UP, so `rotate: true` points them the
 * way the entity moves. Multi-frame presets (invader, blob, flame) cycle over
 * time (see `fps`) — that self-animation is what makes an entity look alive.
 *
 * This is the single source of truth for preset names; validate.ts checks
 * against it, entity.ts resolves through it, reference.ts lists it.
 */
import type { GlyphPart, GlyphTile } from "./types";

export const GLYPH_PRESETS: Record<string, string[][]> = {
  // --- single-frame common shapes ---
  tank: [["..X..", ".XXX.", "XXXXX", "XXXXX", "X.X.X"]],
  ship: [["..X..", "..X..", ".XXX.", "XXXXX", ".X.X."]],
  arrow: [["..X..", ".XXX.", "XXXXX", "..X..", "..X.."]],
  heart: [["XX.XX", "XXXXX", "XXXXX", ".XXX.", "..X.."]],
  star: [["..X..", "..X..", "XXXXX", ".XXX.", ".X.X."]],
  diamond: [["..X..", ".XXX.", "XXXXX", ".XXX.", "..X.."]],
  plus: [["..X..", "..X..", "XXXXX", "..X..", "..X.."]],
  ring: [[".XXX.", "X...X", "X...X", "X...X", ".XXX."]],
  face: [[".....", ".X.X.", ".....", "X...X", ".XXX."]],
  skull: [[".XXX.", "X.X.X", "XXXXX", ".X.X.", ".XXX."]],
  alien: [["X...X", ".XXX.", "XX.XX", "XXXXX", "X.X.X"]],

  // --- multi-frame (animated — they cycle on their own) ---
  // classic invader: the legs flip, so a row of them ripples.
  invader: [
    ["X...X", ".XXX.", "XXXXX", "X.X.X", "X...X"],
    ["X...X", ".XXX.", "XXXXX", ".XXX.", ".X.X."],
  ],
  // a creature that breathes in and out.
  blob: [
    [".....", ".XXX.", "XXXXX", ".XXX.", "....."],
    [".XXX.", "XXXXX", "XXXXX", "XXXXX", ".XXX."],
  ],
  // a flame that flickers.
  flame: [
    ["..X..", ".XXX.", ".XXX.", "XXXXX", "XX.XX"],
    [".X.X.", ".XXX.", "XXXXX", "XXXXX", "X.X.X"],
  ],
  // a one-shot burst: spark -> grow -> peak -> fragment -> embers. Pair with a
  // short `ttl` and `loop: false` so it plays once over its life and despawns.
  explosion: [
    [".....", ".....", "..X..", ".....", "....."],
    [".....", "..X..", ".XXX.", "..X..", "....."],
    ["X.X.X", ".XXX.", "XXXXX", ".XXX.", "X.X.X"],
    ["X...X", "..X..", "X.X.X", "..X..", "X...X"],
    ["X...X", ".....", ".....", ".....", "X...X"],
  ],

  // --- platformer / Mario set (silhouettes; drawn in the entity's color) ---
  hero: [[".XXX.", ".XXX.", "XXXXX", ".X.X.", "XX.XX"]],       // a little character (don't rotate)
  coin: [[".XXX.", "XXXXX", "XX.XX", "XXXXX", ".XXX."]],       // a round coin
  brick: [["XXXXX", "X.X.X", "XXXXX", "XX.XX", "XXXXX"]],      // a brick block / ground
  flag: [["XXXX.", "XXXXX", "XXXX.", "X....", "X...."]],       // a goal flag on a pole
  mushroom: [[".XXX.", "XXXXX", "XXXXX", ".X.X.", ".XXX."]],   // a power-up
  pipe: [["XXXXX", "XXXXX", ".XXX.", ".XXX.", ".XXX."]],       // a Mario pipe
  // a goomba that waddles (feet alternate)
  goomba: [
    [".XXX.", "XXXXX", "X.X.X", "XXXXX", "X...X"],
    [".XXX.", "XXXXX", "X.X.X", "XXXXX", ".X.X."],
  ],

  // --- nature & scenery (decoration; single colour silhouettes) ---
  tree: [[".XXX.", "XXXXX", "XXXXX", "..X..", "..X.."]],
  flower: [["X.X.X", ".XXX.", "..X..", ".X.X.", "..X.."]],
  cloud: [[".....", ".XXX.", "XXXXX", "XXXXX", "....."]],
  bush: [[".X.X.", "XXXXX", "XXXXX", "XXXXX", ".X.X."]],
  mountain: [["..X..", ".XXX.", "XXXXX", "XXXXX", "XXXXX"]],
  sun: [["X.X.X", ".XXX.", "XXXXX", ".XXX.", "X.X.X"]],
  moon: [[".XXX.", "XX...", "XX...", "XX...", ".XXX."]],
  drop: [["..X..", "..X..", ".XXX.", "XXXXX", ".XXX."]],
  rock: [[".....", ".XX..", "XXXXX", "XXXXX", "....."]],
  grass: [[".....", "X...X", "X.X.X", "X.X.X", "XXXXX"]],
  leaf: [["...XX", "..XXX", ".XXX.", "XXX..", "XX..."]],
  snowflake: [["..X..", "X.X.X", ".XXX.", "X.X.X", "..X.."]],
  house: [["..X..", ".XXX.", "XXXXX", "XX.XX", "XX.XX"]],
  bird: [[".....", "XX.XX", ".XXX.", "..X..", "....."]],
  key: [[".XXX.", ".X.X.", ".XXX.", "..X..", "..XX."]],
  crown: [[".....", "X.X.X", "XXXXX", "XXXXX", "....."]],
};

/** All preset names (for validation messages + the reference menu). */
export const GLYPH_PRESET_NAMES = Object.keys(GLYPH_PRESETS);

/**
 * Composed, multi-COLOUR presets (glyph lib "v2") — a stack of layers, each its
 * own bitmap + colour, authored at 8x8 for detail. Drawn back-to-front, so each
 * is a little colored sprite (still pure data, no assets). Usable by name via
 * `glyph: "<name>"`, or compose your own with the `parts` field.
 */
export const COMPOSED_PRESETS: Record<string, GlyphPart[]> = {
  pinetree: [
    { glyph: ["...XX...", "..XXXX..", ".XXXXXX.", "XXXXXXXX", ".XXXXXX.", "..XXXX..", "........", "........"], color: "#2e8b3d" },
    { glyph: ["........", "........", "........", "........", "........", "........", "...XX...", "...XX..."], color: "#7a4a23" },
  ],
  cottage: [
    { glyph: ["...XX...", "..XXXX..", ".XXXXXX.", "XXXXXXXX", "........", "........", "........", "........"], color: "#c0392b" },
    { glyph: ["........", "........", "........", "........", ".XXXXXX.", ".XXXXXX.", ".XXXXXX.", ".XXXXXX."], color: "#e0c089" },
    { glyph: ["........", "........", "........", "........", "........", "...XX...", "...XX...", "...XX..."], color: "#6b4423" },
  ],
  daisy: [
    { glyph: ["........", "........", "........", "........", "...X....", ".X.X....", "...XX...", "...X...."], color: "#4caf50" },
    { glyph: [".X.XX.X.", "XXXXXXXX", ".XXXXXX.", "..XXXX..", "...X....", "........", "........", "........"], color: "#ff7eb6" },
    { glyph: ["........", "...XX...", "...XX...", "........", "........", "........", "........", "........"], color: "#ffd23f" },
  ],
  toadstool: [
    { glyph: ["..XXXX..", ".XXXXXX.", "XXXXXXXX", "XXXXXXXX", "........", "........", "........", "........"], color: "#d23b3b" },
    { glyph: ["........", "..X..X..", ".....X..", "..X.....", "........", "........", "........", "........"], color: "#ffffff" },
    { glyph: ["........", "........", "........", "........", "..XXXX..", "..X..X..", "..X..X..", "..XXXX.."], color: "#efe6c8" },
  ],

  // --- v2 remakes of iconic v1 monochrome glyphs (multi-colour, 8x8) ---
  tank2: [
    { glyph: ["X......X", "X......X", "X......X", "X......X", "X......X", "X......X", "X......X", "X......X"], color: "#333333" }, // tracks
    { glyph: ["..XXXX..", "..XXXX..", ".XXXXXX.", ".XXXXXX.", ".XXXXXX.", ".XXXXXX.", "..XXXX..", "..XXXX.."], color: "#5a8a3a" }, // hull
    { glyph: ["...XX...", "...XX...", "...XX...", "...XX...", "........", "........", "........", "........"], color: "#444444" }, // barrel
  ],
  heart2: [
    { glyph: [".XX..XX.", "XXXXXXXX", "XXXXXXXX", "XXXXXXXX", ".XXXXXX.", "..XXXX..", "...XX...", "........"], color: "#e0394b" },
    { glyph: [".X......", "XX......", ".X......", "........", "........", "........", "........", "........"], color: "#ff9aa8" }, // shine
  ],
  star2: [
    { glyph: ["...XX...", "...XX...", "XXXXXXXX", ".XXXXXX.", "..XXXX..", ".XX..XX.", ".X....X.", "........"], color: "#ffcf3a" },
    { glyph: ["........", "........", "...XX...", "...XX...", "........", "........", "........", "........"], color: "#fff3b0" }, // core
  ],
  coin2: [
    { glyph: ["..XXXX..", ".XXXXXX.", "XXXXXXXX", "XXXXXXXX", "XXXXXXXX", "XXXXXXXX", ".XXXXXX.", "..XXXX.."], color: "#b8860b" }, // edge
    { glyph: ["........", "..XXXX..", ".XXXXXX.", ".XXXXXX.", ".XXXXXX.", ".XXXXXX.", "..XXXX..", "........"], color: "#ffd23f" }, // face
    { glyph: ["........", "...X....", "..X.....", "........", "........", "........", "........", "........"], color: "#fffbe6" }, // shine
  ],
  face2: [
    { glyph: ["..XXXX..", ".XXXXXX.", "XXXXXXXX", "XXXXXXXX", "XXXXXXXX", "XXXXXXXX", ".XXXXXX.", "..XXXX.."], color: "#ffd23f" },
    { glyph: ["........", "........", "..X..X..", "..X..X..", "........", ".X....X.", "..XXXX..", "........"], color: "#3a2d10" }, // eyes + smile
  ],
  hero2: [
    { glyph: ["..XXXX..", ".XXXXXX.", "........", "........", "........", "........", "........", "........"], color: "#e23d3d" }, // hat
    { glyph: ["........", "........", "..XXXX..", "..XXXX..", "........", "........", "........", "........"], color: "#f0b890" }, // face
    { glyph: ["........", "........", "........", "........", "..XXXX..", "..XXXX..", "..XXXX..", "........"], color: "#3a5fcd" }, // body
    { glyph: ["........", "........", "........", "........", "........", "........", "........", "..X..X.."], color: "#333333" }, // legs
  ],
};

/**
 * Which v1 monochrome presets have a v2 (composed, colour) remake. The gallery
 * shows them side-by-side; both remain usable by name (v1 unchanged).
 */
export const GLYPH_V2_OF: Record<string, string> = {
  tank: "tank2", heart: "heart2", star: "star2", coin: "coin2", face: "face2", hero: "hero2",
  tree: "pinetree", house: "cottage", flower: "daisy", mushroom: "toadstool",
};

export const COMPOSED_PRESET_NAMES = Object.keys(COMPOSED_PRESETS);

/** One resolved layer: concrete bitmap rows + optional colour (else entity colour). */
export interface ResolvedLayer {
  rows: string[];
  color?: string;
}

/** Rows for a part's glyph: inline rows, or the first frame of a monochrome preset. */
function partRows(g: string[] | string): string[] | undefined {
  if (typeof g === "string") return GLYPH_PRESETS[g]?.[0];
  return g.length ? g : undefined;
}

/**
 * Resolve a composed glyph (the `parts` field, or a COMPOSED_PRESETS name in
 * `glyph`) into concrete layers. Returns undefined for plain/monochrome glyphs
 * (those go through resolveFrames instead).
 */
export function resolveParts(
  glyph?: string[] | string,
  parts?: GlyphPart[],
): ResolvedLayer[] | undefined {
  const src = parts && parts.length ? parts : typeof glyph === "string" ? COMPOSED_PRESETS[glyph] : undefined;
  if (!src) return undefined;
  const layers: ResolvedLayer[] = [];
  for (const p of src) {
    const rows = partRows(p.glyph);
    if (rows) layers.push({ rows, color: p.color });
  }
  return layers.length ? layers : undefined;
}

/** Resolve one tile-grid cell into a tile (rows + optional colour), or null (gap). */
function resolveTile(cell: GlyphTile): ResolvedLayer | null {
  if (cell == null) return null;
  if (typeof cell === "string") {
    if (cell === "" || cell === "." || cell === " ") return null;
    const rows = GLYPH_PRESETS[cell]?.[0];
    return rows ? { rows } : null;
  }
  const rows = partRows(cell.glyph);
  return rows ? { rows, color: cell.color } : null;
}

/**
 * Resolve a tile-grid glyph (the `tiles` field) into a 2D grid of tiles (each a
 * bitmap + optional colour, or null for a gap). The renderer lays them out in a
 * grid to form one big composite sprite. Returns undefined when there are no
 * tiles at all.
 */
export function resolveTiles(tiles?: GlyphTile[][]): (ResolvedLayer | null)[][] | undefined {
  if (!tiles || !tiles.length) return undefined;
  const grid = tiles.map((row) => row.map(resolveTile));
  return grid.some((row) => row.some(Boolean)) ? grid : undefined;
}

/**
 * Resolve an entity's `glyph`/`frames` spec into a concrete frame list (each a
 * bitmap). Priority: explicit `frames` → a named preset → raw `glyph` rows.
 * Returns undefined when there's no glyph at all (draw the bare shape).
 */
export function resolveFrames(
  glyph?: string[] | string,
  frames?: string[][],
): string[][] | undefined {
  if (frames && frames.length) return frames;
  if (typeof glyph === "string") return GLYPH_PRESETS[glyph];
  if (Array.isArray(glyph) && glyph.length) return [glyph];
  return undefined;
}
