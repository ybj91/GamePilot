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

## 1.3.0 — tank fleet + projectiles pass through solids

- **MINOR** (backward-compatible): a **tank fleet** of composed glyph presets, each
  a different 8×8 silhouette so a tank's TYPE reads from its SHAPE, not just its
  colour: `tankLight`, `tankMedium`, `tankHeavy` (twin barrels), `tankArty` (long
  gun), `tankHero` (insignia). The hull layer is recolourable (omits its colour →
  inherits the entity colour); tracks + barrel are fixed dark accents.
- **Engine fix** — a **free-flying projectile** (control `none` + a velocity, no
  behaviour: a bullet/shell/ball) now **passes through solids**, leaving its fate
  to collision rules. Before, the solid resolver pushed it out of a solid square's
  AABB — whose corners reach past the entity's hit circle — so projectiles
  *ricocheted* off corners or *piled up* instead of being destroyed on contact.
  This mirrors the existing "a flying projectile leaves the world at an edge" rule.
  Controlled/behaviour movers (the player, walkers) are still blocked by solids;
  nothing solid changes for Breakout (its ball bounces via the `bounce` op).
- **Tank 1990 recreated** on this foundation: walls placed on a tilemap grid (no
  overlap), tanks the same size (shape tells them apart), non-solid player (so it
  no longer shoves pickups it should collect), hit-flash on a survived hit, and an
  explosion burst on every kill.
- Existing specs are unaffected (no schema change).

## 1.2.0 — recolourable tiles (fabric materials + composed cells)

- **MINOR** (backward-compatible): make composition *combine* well by keeping the
  building blocks recolourable.
  - **Fabric material tiles** — 8 single-layer, fully recolourable 8×8 patterns
    purpose-built for tiling: `brickwork`, `planks`, `stone`, `shingle`, `window`,
    `water`, `sand`, `arch`. Pure one-layer, so the entity (or a tile cell's
    `color`) tints them to any palette. Browsable in the new **fabric — tileable**
    `/glyphs` section.
  - **`tiles` cells can be composed (v2) glyphs** — a cell may name a multi-layer
    preset (e.g. `brick2`), not just a mono one. A cell `color` sets the MAIN
    colour, filling any colour-less layer; fixed accent layers keep theirs.
  - **Recolourable material v2s** — the body layer of the material composed presets
    (`brick2`, `pipe2`, `leaf2`, `bush2`, `mountain2`, `rock2`, `cloud2`, `drop2`)
    now OMITS its colour, so it inherits the entity/cell colour (a `brick2` can be
    grey stone or tan brick while its mortar accent stays fixed). Authoring rule:
    **omit a layer's `color` to make it recolourable.** Character-sprite v2s
    (`hero2`/`tank2`/`coin2`/…) keep their baked colours.
- The `/glyphs` gallery now has four sections — v1 monochrome, v2 composed colour,
  **fabric — tileable**, and **tiles — combined** (worked castle/house/tower
  examples now assembled from fabric materials + a recoloured `brick2` course).
- Existing specs are unaffected. Note: games that used a *material* v2 (`brick2`
  etc.) now render that glyph in the entity's `color` instead of the old baked
  colour — set the entity `color` to the material's tone to match.

## 1.1.0 — composed glyphs (layers + tiles)

- **MINOR** (backward-compatible): two opt-in ways to compose richer glyphs from
  the single-layer primitive — *use as needed, not by default*:
  - **`parts`** — a stack of glyph LAYERS, each its own bitmap + `color`, drawn
    back-to-front. One entity becomes a **multi-colour sprite** (a tree = brown
    trunk + green canopy). For multiple colours in the same square.
  - **`tiles`** — a 2D GRID of small tiles assembled into one big composite sprite
    on a single entity (a castle from `brick`/`door` tiles). Each cell is a preset
    name, a `{ glyph, color }`, or null/empty. For building big items from tiles.
  - Priority: `tiles` > `parts` > `glyph`/`frames`. A plain single-layer glyph
    stays the flexible default (controllable colour, reusable as a part/tile).
  - Composed glyphs can also **animate** (a composed preset can be frames of
    layers), so the animated remakes (`invader2`/`blob2`/`flame2`/`explosion2`/
    `goomba2`) keep moving in colour.
- **All 38** v1 glyphs now have a v2 colour remake (the gallery shows every one
  as a v1 → v2 pair). v1 monochrome presets are unchanged — v2s are options.
- Built-in **composed presets** (glyph lib "v2", 8×8 multi-colour): nature
  (`pinetree`, `cottage`, `daisy`, `toadstool`) + colour remakes of 20 iconic v1
  glyphs (`tank2`/`heart2`/`star2`/`coin2`/`face2`/`hero2`/`ship2`/`skull2`/
  `alien2`/`brick2`/`flag2`/`pipe2`/`key2`/`crown2`/`sun2`/`cloud2`/`bush2`/
  `mountain2`/`drop2`/`leaf2`). Usable via `glyph: "<name>"`. The v1 monochrome
  presets are unchanged — these are colour *options*, not replacements.
- The `/glyphs` gallery now has two sections — **v1 monochrome** and **v2
  composed colour**, the latter showing each remake next to its v1 (the
  `GLYPH_V2_OF` map) for comparison. The v1 presets are unchanged and stay usable.
- Existing specs are unaffected (1.0.0 games still validate and play).

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
