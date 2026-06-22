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
import type { GlyphPalette, PaintedGlyph, GlyphTile } from "./types";

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

  // --- "fabric" tiles: single-layer 8x8 MATERIAL patterns, purpose-built to be
  // tiled/combined into big structures. Pure one-layer, so fully recolourable via
  // the entity (or a tile cell's "color") — drop them into any palette. ---
  brickwork: [["XXXXXXXX", "XXX.XXX.", "XXXXXXXX", ".XXX.XXX", "XXXXXXXX", "XXX.XXX.", "XXXXXXXX", ".XXX.XXX"]], // running-bond brick
  planks: [["XXXXXXXX", "X.XXXX.X", "XXXXXXXX", "XXX.XXXX", "XXXXXXXX", "X.XXXX.X", "XXXXXXXX", "XXX.XXXX"]],     // wood grain
  stone: [["XXXX.XXX", "XXXX.XXX", "XXXX.XXX", "........", "XXX.XXXX", "XXX.XXXX", "XXX.XXXX", "........"]],      // stacked stone blocks
  shingle: [["X.XX.XX.", "XXXXXXXX", "XXXXXXXX", ".XX.XX.X", "XXXXXXXX", "XXXXXXXX", "X.XX.XX.", "XXXXXXXX"]],    // roof shingles
  window: [["XXXXXXXX", "X..XX..X", "X..XX..X", "XXXXXXXX", "XXXXXXXX", "X..XX..X", "X..XX..X", "XXXXXXXX"]],     // 4-pane window frame
  water: [["XX..XX..", "XXXXXXXX", "XXXXXXXX", "..XX..XX", "XXXXXXXX", "XXXXXXXX", "XX..XX..", "XXXXXXXX"]],      // rippled water
  sand: [["XXXXXXXX", "XX.XXXXX", "XXXXXX.X", "XXXXXXXX", "X.XXXXXX", "XXXXX.XX", "XXXXXXXX", "XX.XXXXX"]],        // speckled sand
  arch: [[".XXXXXX.", "XXXXXXXX", "XX....XX", "XX....XX", "XX....XX", "XX....XX", "XX....XX", "XX....XX"]],        // arched doorway
};

/** All preset names (for validation messages + the reference menu). */
export const GLYPH_PRESET_NAMES = Object.keys(GLYPH_PRESETS);

/** The single-layer MATERIAL tiles purpose-built for combining (a subset of the
 *  mono presets). Pure one-layer, so fully recolourable — ideal as `tiles` cells. */
export const FABRIC_PRESET_NAMES = ["brickwork", "planks", "stone", "shingle", "window", "water", "sand", "arch"];

/**
 * Composed, multi-COLOUR presets (glyph lib "v2") — each an INDEXED grid + a small
 * palette (char → colour), 5x5 or 8x8. One frame = static; an array of frames =
 * animated. A grid char with NO palette entry renders in the ENTITY colour, so
 * material presets (brick2/pipe2/...) stay recolourable. Pure data, no assets;
 * usable by name: glyph: "<name>".
 */
export const COMPOSED_PRESETS: Record<string, PaintedGlyph> = {
  pinetree: { grid: ["...YY...", "..YYYY..", ".YYYYYY.", "YYYYYYYY", ".YYYYYY.", "..YYYY..", "...ZZ...", "...ZZ..."], palette: { Y: "#2e8b3d", Z: "#7a4a23" } },
  cottage: { grid: ["...YY...", "..YYYY..", ".YYYYYY.", "YYYYYYYY", ".ZZZZZZ.", ".ZZWWZZ.", ".ZZWWZZ.", ".ZZWWZZ."], palette: { Y: "#c0392b", Z: "#e0c089", W: "#6b4423" } },
  daisy: { grid: [".Z.ZZ.Z.", "ZZZWWZZZ", ".ZZWWZZ.", "..ZZZZ..", "...Z....", ".Y.Y....", "...YY...", "...Y...."], palette: { Y: "#4caf50", Z: "#ff7eb6", W: "#ffd23f" } },
  toadstool: { grid: ["..YYYY..", ".YZYYZY.", "YYYYYZYY", "YYZYYYYY", "..WWWW..", "..W..W..", "..W..W..", "..WWWW.."], palette: { Y: "#d23b3b", Z: "#ffffff", W: "#efe6c8" } },

  // --- v2 remakes of iconic v1 monochrome glyphs ---
  tank2: { grid: ["Y.ZWWZ.Y", "Y.ZWWZ.Y", "YZZWWZZY", "YZZWWZZY", "YZZZZZZY", "YZZZZZZY", "Y.ZZZZ.Y", "Y.ZZZZ.Y"], palette: { Y: "#333333", Z: "#5a8a3a", W: "#444444" } },
  heart2: { grid: [".ZY..YY.", "ZZYYYYYY", "YZYYYYYY", "YYYYYYYY", ".YYYYYY.", "..YYYY..", "...YY...", "........"], palette: { Y: "#e0394b", Z: "#ff9aa8" } },
  star2: { grid: ["...YY...", "...YY...", "YYYZZYYY", ".YYZZYY.", "..YYYY..", ".YY..YY.", ".Y....Y.", "........"], palette: { Y: "#ffcf3a", Z: "#fff3b0" } },
  coin2: { grid: ["..YYYY..", ".YZWZZY.", "YZWZZZZY", "YZZZZZZY", "YZZZZZZY", "YZZZZZZY", ".YZZZZY.", "..YYYY.."], palette: { Y: "#b8860b", Z: "#ffd23f", W: "#fffbe6" } },
  face2: { grid: ["..YYYY..", ".YYYYYY.", "YYZYYZYY", "YYZYYZYY", "YYYYYYYY", "YZYYYYZY", ".YZZZZY.", "..YYYY.."], palette: { Y: "#ffd23f", Z: "#3a2d10" } },
  hero2: { grid: ["..YYYY..", ".YYYYYY.", "..ZZZZ..", "..ZZZZ..", "..WWWW..", "..WWWW..", "..WWWW..", "..V..V.."], palette: { Y: "#e23d3d", Z: "#f0b890", W: "#3a5fcd", V: "#333333" } },

  // --- more v2 object/scenery remakes ---
  ship2: { grid: ["...YY...", "..YYYY..", "..YZZY..", ".YYZZYY.", ".YYYYYY.", "YYYYYYYY", "Y.YWWY.Y", "..W..W.."], palette: { Y: "#c8d0d8", Z: "#4a90e2", W: "#ff7a18" } },
  skull2: { grid: [".YYYYYY.", "YZZYYZZY", "YZZYYZZY", "YYYYZYYY", "YYYYYYYY", ".YYYYYY.", ".Y.YY.Y.", "........"], palette: { Y: "#e8e4d8", Z: "#222222" } },
  alien2: { grid: ["..YYYY..", ".YYYYYY.", "YYZYYZYY", "YY.YY.YY", "YYYYYYYY", "Y.YYYY.Y", "Y......Y", "........"], palette: { Y: "#6ee06e", Z: "#1b3a1b" } },
  brick2: { grid: ["YYYYYYYY", "YXXXYXXX", "YYYYYYYY", "XXXYXXXY", "YYYYYYYY", "YXXXYXXX", "YYYYYYYY", "XXXYXXXY"], palette: { Y: "#6b3a1a" } },
  flag2: { grid: ["YZZZZZ..", "YZZZZZZ.", "YZZZZZ..", "YZZZ....", "Y.......", "Y.......", "Y.......", "Y......."], palette: { Y: "#8b6914", Z: "#e23d3d" } },
  pipe2: { grid: ["YYYYYYYY", "YXXXXXXY", ".XXXXXX.", ".XXXXXX.", ".XXXXXX.", ".XXXXXX.", ".XXXXXX.", ".XXXXXX."], palette: { Y: "#1a8a4a" } },
  key2: { grid: [".YYY....", "Y.Z.Y...", "Y.Z.Y...", ".YYY....", "..Y.....", "..Y.....", "..YY....", "..Y.Y..."], palette: { Y: "#ffd23f", Z: "#8b6914" } },
  crown2: { grid: ["........", "Y..Y..Y.", "YY.YY.YY", "YYYZYYYY", "YYYYYYYY", "YYYYYYYY", "........", "........"], palette: { Y: "#ffcf3a", Z: "#e23d3d" } },
  sun2: { grid: ["...ZZ...", "..YYYY..", "ZYYYYYYZ", ".YYYYYY.", ".YYYYYY.", "Z.YYYY.Z", "........", "...ZZ..."], palette: { Y: "#ffd23f", Z: "#ff9a3c" } },
  cloud2: { grid: ["........", "...YY...", "..YYYX..", ".YYYXXX.", "XXXXXXXX", "XXXXXXXX", "........", "........"], palette: { Y: "#ffffff" } },
  bush2: { grid: ["........", "..Y.Y...", ".YYYYY..", "XYYYYXXX", "XXXXXXXX", "XXXXXXXX", ".XXXXXX.", "........"], palette: { Y: "#5fae5f" } },
  mountain2: { grid: ["...YY...", "..YYYY..", ".XYXYXX.", ".XXXXXX.", "XXXXXXXX", "XXXXXXXX", "XXXXXXXX", "XXXXXXXX"], palette: { Y: "#ffffff" } },
  drop2: { grid: ["...X....", "...X....", "..XXX...", ".XYXXX..", ".XYXXX..", ".XXXXX..", "..XXX...", "........"], palette: { Y: "#cfeaff" } },
  leaf2: { grid: ["....YX..", "...YXX..", "..YXXX..", ".YXXX...", "YXXX....", "XXX.....", "X.......", "........"], palette: { Y: "#2e7d32" } },

  // --- animated v2 remakes (frames + a shared palette — colour + keeps moving) ---
  invader2: { grid: [["Y...Y", ".ZYZ.", "YYYYY", "Y.Y.Y", "Y...Y"], ["Y...Y", ".ZYZ.", "YYYYY", ".YYY.", ".Y.Y."]], palette: { Y: "#5fae5f", Z: "#ffffff" } },
  blob2: { grid: [[".....", ".YZY.", "YYYYY", ".YYY.", "....."], [".ZYY.", "YYYYY", "YYYYY", "YYYYY", ".YYY."]], palette: { Y: "#a86bd6", Z: "#e3c6ff" } },
  flame2: { grid: [["..Y..", ".YZY.", ".YZY.", "YZZZY", "YY.YY"], [".Y.Y.", ".ZZZ.", "YYZYY", "YZZZY", "Y.Y.Y"]], palette: { Y: "#ff7a18", Z: "#ffe066" } },
  explosion2: { grid: [[".....", ".....", "..Y..", ".....", "....."], [".....", "..Z..", ".ZWZ.", "..Z..", "....."], ["V.V.V", ".WWW.", "VWWWV", ".WWW.", "V.V.V"], ["V...V", "..V..", "V.V.V", "..V..", "V...V"], ["U...U", ".....", ".....", ".....", "U...U"]], palette: { Y: "#ffd23f", Z: "#ff9a3c", W: "#ffe066", V: "#ff7a18", U: "#c0392b" } },
  goomba2: { grid: [[".YYY.", "YZYZY", "Y.Y.Y", "YYYYY", "Y...Y"], [".YYY.", "YZYZY", "Y.Y.Y", "YYYYY", ".Y.Y."]], palette: { Y: "#9a6324", Z: "#3a2510" } },

  // --- abstract icon v2s (a colour accent on the v1 shape) ---
  arrow2: { grid: ["..Z..", ".YYY.", "YYYYY", "..Y..", "..Y.."], palette: { Y: "#ffd23f", Z: "#fff3b0" } },
  diamond2: { grid: ["..Y..", ".YZY.", "YYYYY", ".YYY.", "..Y.."], palette: { Y: "#4ad7e0", Z: "#ffffff" } },
  plus2: { grid: ["..Y..", "..Y..", "YYZYY", "..Y..", "..Y.."], palette: { Y: "#e23d3d", Z: "#ffffff" } },
  ring2: { grid: [".ZYY.", "Y...Y", "Y...Y", "Y...Y", ".YYY."], palette: { Y: "#ffd23f", Z: "#fff3b0" } },
  moon2: { grid: [".YYY.", "ZY...", "ZY...", "YY...", ".YYY."], palette: { Y: "#e6e6c0", Z: "#fffdf0" } },
  rock2: { grid: [".....", ".XX..", "XXXXX", "YYYYY", "....."], palette: { Y: "#6b6b73" } },
  grass2: { grid: [".....", "Z...Z", "Z.Z.Z", "Y.Y.Y", "YYYYY"], palette: { Y: "#4a9d4a", Z: "#7bc043" } },
  snowflake2: { grid: ["..Y..", "Y.Y.Y", ".YZY.", "Y.Y.Y", "..Y.."], palette: { Y: "#a8e0ff", Z: "#ffffff" } },
  bird2: { grid: [".....", "YY.YY", ".YZY.", "..Y..", "....."], palette: { Y: "#6cb4ff", Z: "#ff9a3c" } },

  // --- TANK FLEET — each a DIFFERENT silhouette (16x16, authored facing UP; use
  // rotate:true). 'X' (no palette entry) = the recolourable HULL → entity colour;
  // 'Y' = tracks, 'Z' = barrel, 'W' = insignia/detail (fixed accents). ---
  tankLight: { // scout: slim hull, short single barrel (fast)
    grid: [
      "................",
      "......ZZ........",
      "......ZZ........",
      "......ZZ........",
      ".YY..XXXX..YY...",
      ".YY.XXXXXX.YY...",
      ".YY.XXXXXX.YY...",
      ".YY.XXWWXX.YY...",
      ".YY.XXWWXX.YY...",
      ".YY.XXXXXX.YY...",
      ".YY.XXXXXX.YY...",
      ".YY.XXXXXX.YY...",
      ".YY..XXXX..YY...",
      ".YY........YY...",
      ".YY........YY...",
      "................",
    ],
    palette: { Y: "#2a2a2a", Z: "#383838", W: "#4a5560" },
  },
  tankMedium: { // standard battle tank: round turret, medium barrel
    grid: [
      ".......ZZ.......",
      ".......ZZ.......",
      ".......ZZ.......",
      "YYY...XXXX...YYY",
      "YYY..XXXXXX..YYY",
      "YYY.XXXXXXXX.YYY",
      "YYY.XXXWWXXX.YYY",
      "YYY.XXWWWWXX.YYY",
      "YYY.XXWWWWXX.YYY",
      "YYY.XXXWWXXX.YYY",
      "YYY.XXXXXXXX.YYY",
      "YYY..XXXXXX..YYY",
      "YYY...XXXX...YYY",
      "YYY..........YYY",
      "YYY..........YYY",
      "................",
    ],
    palette: { Y: "#2a2a2a", Z: "#383838", W: "#4a5560" },
  },
  tankHeavy: { // heavy: wide hull, TWIN barrels symmetric about the centre, turret
    grid: [
      "....ZZ....ZZ....",
      "....ZZ....ZZ....",
      "....ZZ....ZZ....",
      ".YY.XXXXXXXX.YY.",
      ".YY.XXXXXXXX.YY.",
      ".YY.XXXXXXXX.YY.",
      ".YY.XXWWWWXX.YY.",
      ".YY.XWWWWWWX.YY.",
      ".YY.XWWWWWWX.YY.",
      ".YY.XWWWWWWX.YY.",
      ".YY.XXWWWWXX.YY.",
      ".YY.XXXXXXXX.YY.",
      ".YY.XXXXXXXX.YY.",
      ".YY.XXXXXXXX.YY.",
      ".YY..........YY.",
      ".YY..........YY.",
    ],
    palette: { Y: "#2a2a2a", Z: "#383838", W: "#4a5560" },
  },
  tankArty: { // artillery: compact hull, very LONG barrel
    grid: [
      ".......ZZ.......",
      ".......ZZ.......",
      ".......ZZ.......",
      ".......ZZ.......",
      ".......ZZ.......",
      "YYY...XXXX...YYY",
      "YYY..XXXXXX..YYY",
      "YYY.XXXXXXXX.YYY",
      "YYY.XXWWWWXX.YYY",
      "YYY.XXWWWWXX.YYY",
      "YYY.XXXXXXXX.YYY",
      "YYY..XXXXXX..YYY",
      "YYY...XXXX...YYY",
      "YYY..........YYY",
      "YYY..........YYY",
      "................",
    ],
    palette: { Y: "#2a2a2a", Z: "#383838", W: "#4a5560" },
  },
  tankHero: { // the player's tank: medium hull + a bright star insignia
    grid: [
      ".......ZZ.......",
      ".......ZZ.......",
      ".......ZZ.......",
      "YYY...XXXX...YYY",
      "YYY..XXXXXX..YYY",
      "YYY.XXXXXXXX.YYY",
      "YYY.XXX..XXX.YYY",
      "YYY.XX.WW.XX.YYY",
      "YYY.XXWWWWXX.YYY",
      "YYY.XX.WW.XX.YYY",
      "YYY.XXX..XXX.YYY",
      "YYY.XXXXXXXX.YYY",
      "YYY...XXXX...YYY",
      "YYY..........YYY",
      "YYY..........YYY",
      "................",
    ],
    palette: { Y: "#2a2a2a", Z: "#383838", W: "#ffd23f" },
  },

  // --- 16x16 DETAIL SPRITES (one entity each; grid+palette). Authored at 16 wide
  // to show the bigger budget: every row is exactly 16 chars, <=6 palette colours.
  // 'X' (no palette entry) = the entity colour where a recolourable body helps.
  // names end in "16". ---

  // Fantasy / RPG
  knight16: {
    grid: [
      "......XX......XX",
      ".....XCCX....XCX",
      ".....XCCXXXXXCCX",
      "......XCCCCCCCX.",
      ".......XSSSSX...",
      "......XSSSSSSX..",
      ".....XSDSSDSSX..",
      ".....XSSSSSSSX..",
      "......XSSSSSX...",
      ".....XAASSAAX...",
      "....XAAASSAAAX..",
      "...XAAAASSAAAAX.",
      "...XAAAXSSXAAAX.",
      "....XXX.SS.XXX..",
      "......XBBBBX....",
      ".....XB....BX...",
    ],
    palette: { C: "#d23b3b", S: "#c8d0d8", D: "#2a2a2a", A: "#4a78c8", B: "#7a4a23" },
  },
  dragon16: {
    grid: [
      ".G............G.",
      ".GG..........GG.",
      ".GGG.GGGGGG.GGG.",
      "..GGGGEEEEGGGG..",
      "...GGEWHHWEGG...",
      "..GGGEHHHHEGGG..",
      ".GGGGGEHHEGGGGG.",
      "GGGGGGGGGGGGGGGG",
      ".GGGGGGGGGGGGGG.",
      "..GGGGGGGGGGGG..",
      "...RRGGGGGGRR...",
      "..RRRRGGGGRRRR..",
      ".RR..GGGGGG..RR.",
      ".....GG..GG.....",
      "....GG....GG....",
      "...GG......GG...",
    ],
    palette: { G: "#3aa54a", E: "#1b3a1b", W: "#ffd23f", H: "#e2554e", R: "#c0392b" },
  },
  chest16: {
    grid: [
      "................",
      "...WWWWWWWWWW...",
      "..WGGGGGGGGGGW..",
      ".WGGWWWWWWWWGGW.",
      ".WGWLLLLLLLLWGW.",
      ".WGWLLLLLLLLWGW.",
      ".WWWWWWKKWWWWWW.",
      ".BBBBBBKKBBBBBB.",
      ".BWWWWWKKWWWWWB.",
      ".BWLLLLLLLLLLWB.",
      ".BWLLLLLLLLLLWB.",
      ".BWLLLLLLLLLLWB.",
      ".BWWWWWWWWWWWWB.",
      ".BBBBBBBBBBBBBB.",
      "..B..........B..",
      "................",
    ],
    palette: { W: "#8b5a2b", G: "#ffd23f", L: "#c8902b", K: "#fff3b0", B: "#5a3a1a" },
  },
  potion16: {
    grid: [
      "......XXXX......",
      "......X..X......",
      "......X..X......",
      ".......XX.......",
      "......XKKX......",
      ".....XKKKKX.....",
      "....XKKKKKKX....",
      "...XKLLLLLLKX...",
      "..XKLPPPPPPLKX..",
      "..XLPPPPPPPPLX..",
      "..XLPPWPPPPPLX..",
      "..XLPPPPPPPPLX..",
      "..XKLPPPPPPLKX..",
      "...XKLLLLLLKX...",
      "....XKKKKKKX....",
      ".....XXXXXX.....",
    ],
    palette: { X: "#2a2a2a", K: "#9ad0ff", L: "#5bb8ff", P: "#a86bd6", W: "#ffffff" },
  },

  // Sci-fi
  robot16: {
    grid: [
      "....X......X....",
      "....X......X....",
      "...XXXXXXXXXX...",
      "..XGGGGGGGGGGX..",
      "..XGEEGGGGEEGX..",
      "..XGEEGGGGEEGX..",
      "..XGGGGGGGGGGX..",
      "..XGGRRRRRRGGX..",
      "...XGGGGGGGGX...",
      "..XXGGGGGGGGXX..",
      ".XGGXBBBBBBXGGX.",
      ".XGGXBBBBBBXGGX.",
      ".XXX.XBBBBX.XXX.",
      "....XBB..BBX....",
      "....XB....BX....",
      "...XXX....XXX...",
    ],
    palette: { X: "#5a6470", G: "#9aa3b0", E: "#4ad7e0", R: "#e2554e", B: "#383f48" },
  },
  ufo16: {
    grid: [
      "................",
      "................",
      ".....GGGGGG.....",
      "....GWWWWWWG....",
      "...GWHHHHHHWG...",
      "...GWHHHHHHWG...",
      "..SSSSSSSSSSSS..",
      ".SSCSSCSSCSSCSS.",
      ".SSCSSCSSCSSCSS.",
      "..SSSSSSSSSSSS..",
      "...L.L.L.L.L....",
      "..L.L.L.L.L.L...",
      ".L...L...L...L..",
      "................",
      "................",
      "................",
    ],
    palette: { G: "#9aa3b0", W: "#cfeaff", H: "#4ad7e0", S: "#5a6470", C: "#ffd23f", L: "#9be15d" },
  },
  planet16: {
    grid: [
      ".....BBBBBB.....",
      "...BBPPPPPPBB...",
      "..BPPPPCCPPPPB..",
      ".BPPCCPPPPPPPPB.",
      ".BPPPPPPPPCCPPB.",
      "BPPPPCCPPPPPPPPB",
      "RRRRRRRRRRRRRRRR",
      "ORRRRRRRRRRRRRRO",
      "BPPPPPPPPCCPPPPB",
      ".BPPCCPPPPPPPPB.",
      ".BPPPPPPPPCCPPB.",
      "..BPPPPCCPPPPB..",
      "...BBPPPPPPBB...",
      ".....BBBBBB.....",
      "................",
      "................",
    ],
    palette: { B: "#3a5fcd", P: "#5b8bf0", C: "#9ad0ff", R: "#e0a23a", O: "#ffd23f" },
  },

  // Nature / scenery
  bigtree16: {
    grid: [
      ".....GGGGG......",
      "...GGGGGGGGG....",
      "..GGGGGGGGGGG...",
      ".GGGGGDGGGGGGG..",
      ".GGGGGGGGGGGGG..",
      "GGGGGGGGGGGGGGG.",
      "GGGGDGGGGGDGGGG.",
      ".GGGGGGGGGGGGG..",
      "..GGGGGGGGGGG...",
      "...GGGGGGGGG....",
      ".....BBBBB......",
      ".....BBBBB......",
      "....BBBBBBB.....",
      "....BBBBBBB.....",
      "...HHHHHHHHH....",
      "..HHHHHHHHHHH...",
    ],
    palette: { G: "#3aa54a", D: "#2e7d32", B: "#7a4a23", H: "#5a8a3a" },
  },
  campfire16: {
    grid: [
      ".......F........",
      "......FOF.......",
      "......FOF.......",
      ".....FOOOF......",
      ".....FOWOF......",
      "....FOOWOOF.....",
      "....FOWWWOF.....",
      "...FOOWWWOOF....",
      "...FOOWWWOOF....",
      "..FOOOWWWOOOF...",
      "..LLLLLLLLLLLL..",
      ".LBBLLBBLLBBLBL.",
      "LBBLLBBLLBBLLBBL",
      ".LL..LL..LL..LL.",
      "................",
      "................",
    ],
    palette: { F: "#ffd23f", O: "#ff7a18", W: "#ffe066", L: "#7a4a23", B: "#5a3a1a" },
  },

  // Vehicles / mecha
  racecar16: {
    grid: [
      ".......XX.......",
      "......XXXX......",
      "......XCCX......",
      ".....XCCCCX.....",
      ".....XCCCCX.....",
      "....XXCCCCXX....",
      "...XCCCWWCCCX...",
      "..XCCCCWWCCCCX..",
      "..XCCCCWWCCCCX..",
      "..XCCCCCCCCCCX..",
      ".KKXCCCCCCCCXKK.",
      "KBBKXCCCCCCXKBBK",
      "KBBKXCWWWWCXKBBK",
      "KBBKXCCCCCCXKBBK",
      ".KKXCCCCCCCCXKK.",
      "...XX......XX...",
    ],
    palette: { X: "#2a2a2a", C: "#e2554e", W: "#9ad0ff", K: "#383f48", B: "#5a6470" },
  },
};

/**
 * Which v1 monochrome presets have a v2 (composed, colour) remake. The gallery
 * shows them side-by-side; both remain usable by name (v1 unchanged).
 */
export const GLYPH_V2_OF: Record<string, string> = {
  tank: "tank2", heart: "heart2", star: "star2", coin: "coin2", face: "face2", hero: "hero2",
  tree: "pinetree", house: "cottage", flower: "daisy", mushroom: "toadstool",
  ship: "ship2", skull: "skull2", alien: "alien2", brick: "brick2", flag: "flag2", pipe: "pipe2",
  key: "key2", crown: "crown2", sun: "sun2", cloud: "cloud2", bush: "bush2", mountain: "mountain2",
  drop: "drop2", leaf: "leaf2",
  invader: "invader2", blob: "blob2", flame: "flame2", explosion: "explosion2", goomba: "goomba2",
  arrow: "arrow2", diamond: "diamond2", plus: "plus2", ring: "ring2", moon: "moon2", rock: "rock2",
  grass: "grass2", snowflake: "snowflake2", bird: "bird2",
};

export const COMPOSED_PRESET_NAMES = Object.keys(COMPOSED_PRESETS);

/** The 16×16 detail-sprite presets shown in their own gallery section — the
 *  ones whose name ends "16", plus the tank fleet (also 16×16 now, kept under
 *  their original names so Tank 1990 keeps working). They showcase the larger
 *  glyph budget. */
const TANK_FLEET = ["tankLight", "tankMedium", "tankHeavy", "tankArty", "tankHero"];
export const BIG16_PRESET_NAMES = COMPOSED_PRESET_NAMES.filter((n) => n.endsWith("16") || TANK_FLEET.includes(n));

/** One resolved layer: concrete bitmap rows + optional colour (else entity colour). */
export interface ResolvedLayer {
  rows: string[];
  color?: string;
}

/** Rows for a tile cell's glyph: inline rows, or the first frame of a monochrome preset. */
function monoRows(g: string[] | string): string[] | undefined {
  if (typeof g === "string") return GLYPH_PRESETS[g]?.[0];
  return g.length ? g : undefined;
}

const ON_CELL = (ch: string): boolean => ch !== "." && ch !== " " && ch !== "0";

/**
 * Resolve ONE indexed frame into non-overlapping layers — one per distinct grid
 * char. A char with a palette entry gets that colour; a char with NO entry gets
 * colour undefined (= the entity colour, so it stays recolourable).
 */
function paintFrame(grid: string[], palette: GlyphPalette): ResolvedLayer[] {
  const chars = new Set<string>();
  for (const row of grid) for (const ch of row) if (ON_CELL(ch)) chars.add(ch);
  const layers: ResolvedLayer[] = [];
  for (const ch of chars) {
    const rows = grid.map((row) => {
      let s = "";
      for (const c of row) s += c === ch ? "X" : ".";
      return s;
    });
    layers.push({ rows, color: palette[ch] });
  }
  return layers;
}

/**
 * Resolve a PAINTED (indexed multi-colour) glyph — a COMPOSED_PRESETS name in
 * `glyph`, or inline `glyph` rows + a `palette` — into FRAMES of layers (one frame
 * = static; many = animated, cycled like `frames`). Returns undefined for a plain
 * monochrome glyph (no palette, not a composed preset) — those use resolveFrames.
 */
export function resolvePainted(
  glyph?: string[] | string,
  palette?: GlyphPalette,
): ResolvedLayer[][] | undefined {
  let grids: string[][];
  let pal: GlyphPalette;
  if (typeof glyph === "string") {
    const preset = COMPOSED_PRESETS[glyph];
    if (!preset) return undefined;
    grids = (Array.isArray(preset.grid[0]) ? preset.grid : [preset.grid]) as string[][];
    pal = preset.palette;
  } else if (Array.isArray(glyph) && palette && Object.keys(palette).length) {
    grids = [glyph]; // inline rows + palette = one painted frame
    pal = palette;
  } else {
    return undefined;
  }
  const frames = grids.map((g) => paintFrame(g, pal)).filter((l) => l.length);
  return frames.length ? frames : undefined;
}

/**
 * Resolve one tile-grid cell into its LAYERS (bottom-first), or null (a gap). A
 * cell may name a painted (multi-colour) v2 preset as well as a mono one; an
 * object cell's `color` sets the MAIN colour — it fills any colour-less layer
 * (the recolourable body of a material v2) while fixed accent layers (mortar,
 * highlights) keep theirs. That's what lets the same tile drop into any palette.
 */
function resolveTile(cell: GlyphTile): ResolvedLayer[] | null {
  if (cell == null) return null;
  if (typeof cell === "string") {
    if (cell === "" || cell === "." || cell === " ") return null;
    const painted = resolvePainted(cell); // a composed preset name → its layers
    if (painted) return painted[0] ?? null; // tiles are static: take frame 0
    const rows = GLYPH_PRESETS[cell]?.[0]; // else a mono preset → one layer
    return rows ? [{ rows }] : null;
  }
  if (typeof cell.glyph === "string") {
    const painted = resolvePainted(cell.glyph); // {glyph:"brick2",color} → recoloured layers
    if (painted) return (painted[0] ?? []).map((l) => ({ rows: l.rows, color: l.color ?? cell.color }));
  }
  const rows = monoRows(cell.glyph);
  return rows ? [{ rows, color: cell.color }] : null;
}

/**
 * Resolve a tile-grid glyph (the `tiles` field) into a 2D grid where each cell is
 * a stack of layers (or null for a gap). The renderer lays the cells out in a
 * grid to form one big composite sprite. Returns undefined when there are no
 * tiles at all.
 */
export function resolveTiles(tiles?: GlyphTile[][]): (ResolvedLayer[] | null)[][] | undefined {
  if (!tiles || !tiles.length) return undefined;
  const grid = tiles.map((row) => row.map(resolveTile));
  return grid.some((row) => row.some(Boolean)) ? grid : undefined;
}

// Example tile-grids for the gallery / docs — big items built by tiling small
// RECOLOURABLE tiles together (the `tiles` field). Mostly single-layer "fabric"
// material tiles, plus a recoloured material v2 (brick2 = body + mortar accent) to
// show a painted material tile dropping into a palette. Same tiles, different colours.
const St: GlyphTile = { glyph: "stone", color: "#9aa0aa" };     // grey stone
const Bk: GlyphTile = { glyph: "brick2", color: "#c8743a" };    // recoloured v2 brick (body + dark mortar)
const Bw: GlyphTile = { glyph: "brickwork", color: "#cf8a5a" }; // tan brick wall
const Sh: GlyphTile = { glyph: "shingle", color: "#c0392b" };   // red roof shingles
const Wn: GlyphTile = { glyph: "window", color: "#7ec0ee" };    // window
const Ar: GlyphTile = { glyph: "arch", color: "#5a3a1a" };      // arched doorway
const F: GlyphTile = { glyph: "flag", color: "#e23d3d" };       // flag (sits ON TOP)
const _: GlyphTile = null;

/** Worked `tiles` examples (one big sprite per entry), shown at /glyphs. */
export const TILE_EXAMPLES: Record<string, GlyphTile[][]> = {
  castle: [
    [_, _, F, _, _],         // flag on TOP, above the wall
    [St, _, St, _, St],      // stone crenellations
    [St, St, St, St, St],
    [Bk, Bk, Bk, Bk, Bk],    // a recoloured brick2 course (body recolours; mortar stays)
    [St, St, Ar, St, St],    // stone wall + arched doorway
  ],
  house: [
    [_, Sh, Sh, Sh, _],      // shingle roof
    [Sh, Sh, Sh, Sh, Sh],
    [Bw, Wn, Bw, Wn, Bw],    // brick wall + windows
    [Bw, Bw, Ar, Bw, Bw],    // brick wall + door
  ],
  tower: [
    [_, F, _],               // flag on top
    [St, St, St],
    [St, Wn, St],            // window
    [Bk, Bk, Bk],            // brick band
    [St, Wn, St],
    [St, Ar, St],            // doorway
  ],
};

export const TILE_EXAMPLE_NAMES = Object.keys(TILE_EXAMPLES);

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
