# Changelog

The GamePilot **DSL/engine contract** is versioned with [Semantic Versioning](https://semver.org)
(`Major.Minor.Patch`). The single source of truth is [`src/dsl/version.ts`](src/dsl/version.ts)
(`DSL_VERSION`), kept in sync with `package.json`. A saved `GameSpec` records the
version it targets in `spec.version`.

Bump policy:
- **MAJOR** — a breaking change to the `GameSpec` shape or semantics (old specs may
  no longer validate/play). The validator rejects a spec whose major is newer than
  the engine's.
- **MINOR** — a backward-compatible addition (a new capability, enum token, optional
  field, or glyph preset). Old specs keep playing; new specs may use new tokens.
- **PATCH** — a fix or clarification with no schema change.

## 1.0.0 — baseline

First versioned release of the contract. The DSL covers, as composable capabilities
on a small core (`world` + `entities` + `rules` + optional `vars`/`win`/`lose`):

- **Core** — typed shape entities (circle/square/dot), `control` (none/follow-pointer/
  follow-pointer-x/arrows/runner/platformer), behaviours (chase/flee/wander/walker),
  spawn placement, rules (collision/tick/interval/input → effects), conditions
  (incl. live `vx`/`vy`/`grounded`), win/lose.
- **Capabilities** — input & projectiles, global variables, spawn areas, obstacles
  (solid bodies), glyphs (pixel presets + GIF-like animation + hit-flash + one-shot),
  a scrolling **camera**, **tilemap** levels, **bounce** physics, **runner** movement,
  a **platformer** cluster (gravity + grounded jump + Goomba `walker` + stomp), and
  `spawn ttlFrom` (a spawned entity's lifetime from a var).
- **Glyph library** — 38 built-in presets (shapes, a platformer set, a nature/scenery
  set, plus animated invader/blob/flame/explosion/goomba), browsable at `/glyphs`.

Genres reachable today: collectors, shooters/tank battles, scrolling mazes, Breakout,
Frogger lane-crossers, Snake/Tron, and side-scrolling Mario-style platformers.
