# The GameSpec DSL

A `GameSpec` is a declarative JSON document a deterministic 2D engine plays directly. Visuals are primitive shapes + colors (and optional pixel glyphs) — never assets. The spec emits **data, never code**, and every spec passes `validateGameSpec` at the seam.

> The **canonical, always-current** source is [`src/dsl/reference.ts`](../src/dsl/reference.ts) — that's what an AI is taught (and what the MCP `get_dsl_reference` tool serves). This page is the human-readable companion; keep them in sync.

## Core

The ~80% every game needs.

```jsonc
GameSpec {
  "meta":     { "title": string, "idea": string },
  "world":    { "width": number, "height": number, "background": "#rrggbb", "edges": "wall" | "wrap" },
  "entities": EntitySpec[],          // ≥1; exactly one with kind "player"
  "rules":    Rule[],
  "vars":     { "<name>": number },  // optional global counters (see Variables)
  "win":      { "when": string },    // optional
  "lose":     { "when": string }     // optional
}

EntitySpec {
  "id":       string,                // unique; referenced by rules/behaviours
  "kind":     "player" | "enemy" | "food" | "obstacle" | string,
  "shape":    "circle" | "square" | "dot",
  "color":    "#rrggbb",
  "size":     number,                // radius (circle/dot) or half-width (square), px
  "spawn":    { "x"?, "y"?, "random"?, "count"?, "maintain"? },
  "control"?: "none" | "follow-pointer" | "arrows",
  "behavior"?:"chase:<id>" | "flee:<id>" | "wander",   // "wander" roams randomly
  "props"?:   { "speed": number, ... }                 // free numeric state
}

Rule {
  "on":      "collision" | "tick" | "interval",   // (+ "input" — see Capabilities)
  "between"? [idA, idB],     // collision
  "every"?:  number,         // interval seconds
  "when"?:   "<condition>",  // optional guard
  "effects": Effect[]
}

Effect { "op": "add"|"set"|"mul"|"destroy"|"spawn"|"score"|"win"|"gameover", "target"?, "value"? }
```

- **Reserved props:** `speed` (units/second), `size` (mirrors the shape size), `ttl` (seconds — the entity auto-despawns at 0).
- **Effects:** `add`/`set`/`mul` target `"<who>.<prop>"` (`who` = `self`/`other` in a collision, or an entity id) — or a bare name for a global var. `destroy` targets `self`/`other`/`<id>`. `spawn` creates one instance of an entity id (a type you only spawn via rules must set `spawn.count: 0`). `score` adds to the global score.
- **Collisions:** `self` = `between[0]`, `other` = `between[1]`. For one contact the **first matching rule whose `when` passes wins** — so branch with mutually-exclusive `when`s.
- **Conditions** (`when`, and win/lose `when`): `<left> <op> <number>` where `left` is `score`, a global var, `<id>.count`, `<id>.<prop>`, or `self`/`other`.<prop>; ops `>= <= > < == !=`. e.g. `"score >= 20"`, `"lives <= 0"`, `"food.count == 0"`.

**Rules of thumb:** player speed ~200–320, enemies slower (~80–160); make it winnable *and* losable; `maintain` respawns pickups; only use tokens listed here or in a capability you've loaded.

## Capabilities

Advanced features, each a self-contained slice with a worked recipe. An agent loads them on demand via `get_dsl_reference("<id>")`; one-shot compilers get them all.

### `shooting` — input triggers & projectiles
- **`on: "input"`** with **`key`** (`"space"`/`"up"`/`"w"`/`"pointer"`…) fires once per press.
- The **`spawn`** effect can fire a projectile: **`from`** (`self`/`other`/`<id>` — spawn at that entity) and **`aim`** (`"pointer"` / a direction / **`"forward"`**·**`"backward"`** along the spawner's facing / `<id>` toward the nearest of that type). Give the projectile `control:"none"`, a short `ttl`, and `spawn.count:0`.
- *Recipe — twin-stick shooter:* player `control:"arrows"`; `input/pointer → spawn bullet from player aim pointer`; `bullet+enemy → destroy both, score`.
- *Recipe — Tank 1990:* `input/space → spawn bullet from player aim forward` (fires the way you face); enemies fire `forward` too.

### `variables` — global counters
- Declare in top-level **`vars`** (`{ "lives": 3, "level": 1 }`); read/write by **bare name** (no dot), shown on the HUD. Undeclared = a validation error.
- *Recipe — 3 lives:* `vars:{lives:3}`; `player+enemy when "lives > 1" → add lives -1, destroy other`; `… when "lives <= 1" → gameover`; `lose: "lives <= 0"`.

### `spawn-areas` — placement
- **`spawn.area`** = `top`/`bottom`/`left`/`right`/`edges`/`center` scatters spawns in a region (overrides `random`/`x,y`).
- *Recipe — base defense:* enemies `spawn:{area:"top",maintain:4}` advancing on a base at the bottom, so a respawn never lands on it.

### `obstacles` — solid bodies
- **`solid: true`** blocks movement. Static walls (`control:"none"` squares — bricks, steel) *and* moving bodies (mark tanks/units solid so they don't overlap/stack). Enemies don't pathfind around solids, so leave open lanes.
- *Recipe:* destructible brick (`bullet+brick → destroy both`) vs. indestructible steel (`bullet+steel → destroy self`); gate steel-breaking on a `power` var for an upgrade.

### `glyphs` — pixel-grid shapes
- **`glyph`**: rows of a small bitmap (a cell is "on" for any char but space/`.`/`0`), drawn scaled in the entity's color instead of the bare shape. **`rotate: true`** turns it to the entity's heading, so it visibly points its direction. Still no assets — just data. Glyph is visual only; collisions use `size`.
- *Recipe — a directional tank:* `glyph:["..X..",".XXX.","XXXXX","XXXXX","X.X.X"], rotate:true`.

### `camera` — world bigger than the screen
- Add **`world.viewport`** (`{ "width": W, "height": H }`) to show only a `W×H` window. When the world is larger, the camera centres on the player and clamps at the world edges; the canvas is the viewport size and the HUD/overlays stay fixed on screen. Pointer aim/control is converted to world coordinates automatically. Defaults to the full world (no scrolling).
- *Recipe — a big arena:* `world:{ width:1600, height:1200, viewport:{ width:800, height:600 } }`; the player starts mid-world and the view follows it.

### `tilemap` — author levels as a grid
- Add a top-level **`map`** (`{ "tile": N, "legend": { "<char>": "<entityId>" }, "rows": [...] }`). Each grid char is looked up in `legend` and that entity is placed at the cell centre; unmapped chars (space/`.`) are empty. The world size comes from the grid (`cols×tile × rows×tile`), so you may omit `world.width/height`. Legend entities are placed by the grid only (`spawn.count:0`); other entities (roaming enemies, randomly-scattered food) still spawn normally.
- *Recipe — a scrolling maze:* draw walls as ASCII (`#`), put the player start in the legend (`P`), size each wall `tile/2`, and pair with `camera`.

## Extending it

New features follow a decision ladder (recipe → enum token → optional field behind a capability) so the DSL grows in capability without growing the AI's working set. See **[Extending the DSL](extending-the-dsl.md)** — the constitution.
