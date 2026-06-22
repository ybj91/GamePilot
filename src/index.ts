/**
 * GamePilot library — the public surface for "creating a game".
 *
 * Everything needed to build, validate, and run a GameSpec, with no DOM
 * dependency except the Renderer. The backend, the MCP server, and the browser
 * client all import from here so there's one canonical API.
 *
 *   import { validateGameSpec, Engine, type GameSpec } from "gamepilot";
 */

export type {
  GameSpec,
  World as WorldSpec,
  EntitySpec,
  Rule,
  Effect,
  EffectOp,
  Trigger,
  Shape,
  Control,
  Behavior,
  BehaviorSpec,
  WinCondition,
  Spawn,
  EntityKind,
  TileMap,
} from "./dsl/types";

export { validateGameSpec } from "./dsl/validate";
export type { ValidationResult } from "./dsl/validate";

export { DSL_VERSION, parseVersion, isVersionSupported } from "./dsl/version";
export type { SemVer } from "./dsl/version";

export { GLYPH_PRESETS, GLYPH_PRESET_NAMES, FABRIC_PRESET_NAMES, COMPOSED_PRESETS, COMPOSED_PRESET_NAMES, BIG16_PRESET_NAMES, GLYPH_V2_OF, TILE_EXAMPLES, TILE_EXAMPLE_NAMES, resolveFrames, resolvePainted, resolveTiles } from "./dsl/glyphs";
export type { GlyphPalette, PaintedGlyph, GlyphTile } from "./dsl/types";

export { growAndSlow } from "./dsl/samples/growAndSlow";

// Runtime (engine has no DOM dependency; Renderer needs a canvas).
export { Engine } from "./engine/engine";
export type { RenderFn } from "./engine/engine";
export { World } from "./engine/world";
export type { GameStatus } from "./engine/world";
export { Renderer } from "./render/renderer";
