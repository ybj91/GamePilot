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

### `bounce` — ball & paddle games (Breakout / Pong)
- **`world.edges: "bounce"`** reflects a moving entity off the left/right/top walls; the **bottom is left open** so paddle games can "miss" (catch a lost ball with a deadzone strip).
- **`{op:"bounce"}` effect** — in a collision rule, reflects `self`'s velocity off `other` along the face it hit (list the ball first in `between`; put `bounce` before any `destroy`).
- **`control:"follow-pointer-x"`** — a paddle that tracks only the cursor's X.
- *Recipe — Breakout:* `edges:"bounce"`; a `follow-pointer-x` paddle; a `control:"none"` ball launched from the paddle (`spawn` `aim:"up"`, `count:0`); bricks (a tilemap grid) that `bounce`+`destroy`+`score`; a bottom deadzone that costs a life; win on `brick.count == 0`.

### `glyphs` — pixel shapes, animation & hit-flash
- **`glyph`**: a **preset name** (a built-in common shape — `tank`, `ship`, `arrow`, `heart`, `star`, `diamond`, `plus`, `ring`, `face`, `skull`, `alien`; a platformer set `hero`/`coin`/`brick`/`flag`/`mushroom`/`pipe`; a nature/scenery set `tree`/`flower`/`cloud`/`bush`/`mountain`/`sun`/`moon`/`drop`/`rock`/`grass`/`leaf`/`snowflake`/`house`/`bird`/`key`/`crown`; plus the self-animating `invader`, `blob`, `flame`, `explosion`, `goomba`) *or* raw rows of a small bitmap (a cell is "on" for any char but space/`.`/`0`). Drawn scaled in the entity's color instead of the bare shape. **Browse them all at `/glyphs`.** Still no assets — just data.
- **`frames`** + **`fps`**: a GIF-like animation — a list of bitmap frames cycled at `fps` (default 6); overrides `glyph`. Multi-frame presets animate automatically. Cycling runs on sim time, so it's deterministic and freezes on pause; a small per-entity phase keeps a crowd from moving in lockstep.
- **`loop: false`**: play a multi-frame glyph once instead of looping. With a `ttl`, the frames spread across the entity's lifetime then it despawns — a one-shot effect. Default `true`.
- **`rotate: true`** turns the (current frame of the) glyph to the entity's heading, so it visibly points its direction. Glyphs are visual only; collisions use `size`.
- **`flash` effect** (`{op:"flash", target:"self"|"other"|"<id>", value:<seconds>}`, default 0.15s) flashes any entity bright for instant hit feedback — best on a hit the entity *survives*. **`flashColor`** on the EntitySpec sets the color (default white). Works on bare shapes too.
- *Recipe — a directional tank:* `glyph:"tank", rotate:true`. *Animated enemy for free:* `glyph:"invader"`. *Custom pulse:* `frames:[[...],[...]], fps:4`. *Explosion on a kill:* a `glyph:"explosion", loop:false, props:{ttl:0.4}` effect with `spawn.count:0`, spawned `from:"other"` in the collision rule — it plays once where the enemy died, then vanishes.

### `runner` — Snake / Tron constant-forward movement
- **`control: "runner"`** — the entity always moves forward at `speed` in its heading; arrows/WASD steer it to a cardinal, but a direct 180° reversal is refused (it can't turn back into its own trail). Never stops; heading starts "up". Pair with `edges:"wrap"` + `glyph`+`rotate`.
- *Trailing body:* drop short-lived segments behind the head on an `interval` (`spawn from:"head" aim:"backward"`, seg `control:"none" speed:0`); a head↔seg collision ends the game.
- *Growth:* spawn each seg with **`ttlFrom:"length"`** (a var) so its lifetime = the current `length`; eating adds to `length`, so new segments live longer and the body grows. `ttlFrom` sets a spawned entity's `ttl` from a var instead of its type's fixed `ttl` — the primitive that makes a body grow with game state.

### `platformer` — gravity, jumping, platforms (Mario)
- **`world.gravity`** (e.g. `1700`) applies downward acceleration to `control:"platformer"` entities — a side-on platformer.
- **`control:"platformer"`** — left/right run at `speed`, gravity pulls down, ↑/W/space **jump** (impulse = the `jump` prop) but only when **grounded** (no double-jumps).
- Stand on **`solid`** platforms/ground (best authored as a `tilemap`; leave gaps for **pits**). A bottom **deadzone** strip + `player↔deadzone → gameover` handles falling deaths; coins (`→ score`) and a goal (`→ win`) are ordinary collision rules. Composes with the `camera` for a scrolling level.
- **Goombas:** an enemy with **`behavior:"walker"`** patrols horizontally under gravity and reverses at walls/ledges (`goomba` glyph waddles). **Stomp:** conditions can read **`self.vy`** (`vx`/`grounded` too), so branch `player↔goomba` — `when:"self.vy > 40"` (falling) → `bounce` + destroy + score; else → `gameover`. Stomp rule first.
- *Recipe — Mario-lite:* `world.gravity:1700`; a `platformer` player with `props:{speed,jump}`; `solid` ground with gaps; coins, a goal, a bottom deadzone; viewport narrower than the world.

### `camera` — world bigger than the screen
- Add **`world.viewport`** (`{ "width": W, "height": H }`) to show only a `W×H` window. When the world is larger, the camera centres on the player and clamps at the world edges; the canvas is the viewport size and the HUD/overlays stay fixed on screen. Pointer aim/control is converted to world coordinates automatically. Defaults to the full world (no scrolling).
- *Recipe — a big arena:* `world:{ width:1600, height:1200, viewport:{ width:800, height:600 } }`; the player starts mid-world and the view follows it.

### `tilemap` — author levels as a grid
- Add a top-level **`map`** (`{ "tile": N, "legend": { "<char>": "<entityId>" }, "rows": [...] }`). Each grid char is looked up in `legend` and that entity is placed at the cell centre; unmapped chars (space/`.`) are empty. The world size comes from the grid (`cols×tile × rows×tile`), so you may omit `world.width/height`. Legend entities are placed by the grid only (`spawn.count:0`); other entities (roaming enemies, randomly-scattered food) still spawn normally.
- *Recipe — a scrolling maze:* draw walls as ASCII (`#`), put the player start in the legend (`P`), size each wall `tile/2`, and pair with `camera`.

## Extending it

New features follow a decision ladder (recipe → enum token → optional field behind a capability) so the DSL grows in capability without growing the AI's working set. See **[Extending the DSL](extending-the-dsl.md)** — the constitution.
