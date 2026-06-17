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
};

/** All preset names (for validation messages + the reference menu). */
export const GLYPH_PRESET_NAMES = Object.keys(GLYPH_PRESETS);

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
