/**
 * The GamePilot DSL/engine version — the contract version of the GameSpec.
 *
 * Semantic versioning (Major.Minor.Patch):
 *  - MAJOR — a breaking change to the GameSpec shape or semantics (old specs may
 *    no longer be valid/playable). Bump rarely.
 *  - MINOR — a backward-compatible addition (a new capability, enum token,
 *    optional field, glyph preset). Old specs still play.
 *  - PATCH — a fix or clarification with no schema change.
 *
 * A saved GameSpec records the version it targets in `spec.version`. The engine
 * plays a spec when its MAJOR is not newer than the engine's (newer-minor
 * features are still caught by the token validator). See docs/dsl.md + CHANGELOG.
 *
 * Single source of truth — keep package.json's "version" in sync.
 */
export const DSL_VERSION = "2.0.0";

export interface SemVer {
  major: number;
  minor: number;
  patch: number;
}

/** Parse "Major.Minor.Patch" into parts, or null if malformed. */
export function parseVersion(v: string): SemVer | null {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(v.trim());
  if (!m) return null;
  return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]) };
}

const ENGINE = parseVersion(DSL_VERSION)!;

/**
 * Can this engine play a spec authored for `version`? True when the spec's MAJOR
 * is not newer than the engine's (the engine stays backward-compatible within a
 * major; a future-major spec is rejected).
 */
export function isVersionSupported(version: string): boolean {
  const v = parseVersion(version);
  return v !== null && v.major <= ENGINE.major;
}
