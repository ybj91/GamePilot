/**
 * The GameSpec DSL contract, as prose — the single source of truth for teaching
 * an AI to author a game. Organised as a small CORE (the ~80% every game needs)
 * plus a registry of CAPABILITY slices (advanced features + a worked recipe
 * each), so the agent can load only what a given game needs (progressive
 * disclosure via the MCP get_dsl_reference tool). One-shot compilers that can't
 * fetch on demand use fullReference() (core + all capabilities).
 *
 * HOW TO EXTEND: see docs/extending-the-dsl.md (the "DSL constitution"). In
 * short — prefer a recipe (no schema), then an enum token, then an optional
 * field behind a capability. Keep CORE small; new features become CAPABILITIES.
 * Always keep this in sync with types.ts / validate.ts / the engine.
 */

import { growAndSlow } from "./samples/growAndSlow";
import { GLYPH_PRESET_NAMES, COMPOSED_PRESET_NAMES } from "./glyphs";
import { DSL_VERSION } from "./version";

/** The essentials — entities, rules, effects, conditions, win/lose. */
export const CORE = `A GameSpec is a declarative JSON document a deterministic 2D engine plays directly. Visuals are primitive shapes (no assets) — gameplay is what matters. Emit DATA ONLY: never code.

GameSpec:
{
  "version": "${DSL_VERSION}",  // the DSL version you're authoring against (Major.Minor.Patch)
  "meta": { "title": string, "idea": string },
  "world": { "width": number, "height": number, "background": "#rrggbb", "edges": "wall" | "wrap" },
  "entities": EntitySpec[],     // at least one; exactly one with kind "player"
  "rules": Rule[],
  "win":  { "when": string },   // optional
  "lose": { "when": string }    // optional
}
The current DSL version is ${DSL_VERSION}; include it as "version". (If omitted, it's stamped on save.)

EntitySpec:
{
  "id": string,                 // unique; referenced by rules/behaviors (e.g. "player","food","enemy")
  "kind": "player" | "enemy" | "food" | "obstacle" | string,
  "shape": "circle" | "square" | "dot",
  "color": "#rrggbb",
  "size": number,               // radius (circle/dot) or half-width (square), world units (pixels)
  "spawn": { "x"?: number, "y"?: number, "random"?: boolean, "count"?: number, "maintain"?: number },
  "control": "none" | "follow-pointer" | "arrows",   // optional; the player usually has one
  "behavior": "chase:<id>" | "flee:<id>" | "wander", // optional autonomous movement; "wander" = roam in random directions (doesn't target)
  "props": { "speed": number, ... }                  // speed = units/second; other keys are free numeric state
}
Reserved props: "speed" (units/second), "size" (mirrors the shape size), "ttl" (seconds — entity auto-despawns at 0).

Rule (event -> effects):
{
  "on": "collision" | "tick" | "interval",
  "between": [idA, idB],        // required when on=collision
  "every": number,              // seconds; required when on=interval
  "when": "<condition>",        // optional guard — rule only fires if this holds
  "effects": Effect[]
}

Effect:
{ "op": "add"|"set"|"mul"|"destroy"|"spawn"|"score"|"win"|"gameover", "target"?: string, "value"?: number }
- add/set/mul: target is "<who>.<prop>" where <who> is "self"/"other" (collision only) or an entity id; e.g. "self.size".
- destroy: target is "self" | "other" | "<id>".
- spawn: target is an entity id (creates one instance). NOTE: a type you only create via rules (e.g. bullets) MUST set "spawn": { "count": 0 } so it doesn't pre-spawn.
- score: adds to the global score (default 1). win/gameover: end the game.
In a collision rule "self" = between[0], "other" = between[1]. For one contact the FIRST collision rule (spec order) whose "between" matches and whose "when" passes handles it; later rules for that pair are skipped that hit — so branch with mutually-exclusive "when"s.

Conditions ("when", and win/lose "when"): "<left> <op> <number>". left = "score", "<id>.count", "<id>.<prop>", or "self"/"other".<prop> (collision). ops: >= <= > < == != . Examples: "score >= 20", "food.count == 0", "player.size > 60".
Branch example — a shield that blocks one hit while it's up:
  { "on":"collision","between":["player","enemy"],"when":"player.shield <= 0","effects":[{"op":"gameover"}] },
  { "on":"collision","between":["player","enemy"],"when":"player.shield > 0","effects":[{"op":"destroy","target":"other"},{"op":"set","target":"player.shield","value":0}] }

Rules of thumb:
- Player speed ~200-320, enemy speed ~80-160 (slower than the player, so it's playable). World 800x600 on a dark background.
- Make it winnable AND losable (a score-based win + a collision gameover is typical).
- "maintain" on food/pickups respawns them. Pick colors that read well on dark.
- Only use the tokens listed here, or in a capability you've explicitly loaded. Nothing else.`;

export interface Capability {
  /** id passed to get_dsl_reference(capability). */
  id: string;
  title: string;
  /** One line shown in the core's capability menu. */
  summary: string;
  /** The reference text + a worked recipe. */
  doc: string;
}

/** Advanced features, each loadable on demand. Keep CORE the default; add here. */
export const CAPABILITIES: Capability[] = [
  {
    id: "shooting",
    title: "Input triggers & projectiles",
    summary: "key/pointer presses; fire bullets aimed at the cursor / a direction / the nearest target",
    doc: `Input triggers + projectiles (shooters, jump, dash).
- Rule trigger "input": { "on":"input", "key":"<key>", "effects":[...] } fires ONCE per press (down-edge). key: "space"|"up"|"down"|"left"|"right"|"w"|"a"|"s"|"d"|"pointer" (mouse button).
- The "spawn" effect can fire a projectile:
    "from": "self"|"other"|"<id>"  — spawn at that entity's position (instead of the type's spawn config)
    "aim":  "pointer"|"up"|"down"|"left"|"right"|"forward"|"backward"|"<id>"  — initial velocity (= its speed):
            "pointer" toward the cursor; "up/down/left/right" fixed; "forward"/"backward" the way the spawner (its "from" entity) is FACING (the direction it last moved, snapped to a cardinal); "<id>" toward the nearest of that type.
  Give the projectile "control":"none" + a short "ttl" so it flies straight and despawns, and "spawn":{"count":0} so it doesn't pre-spawn.
Recipe — twin-stick shooter (drive with keys, aim+fire with the mouse):
  player: "control":"arrows"   // NOT "follow-pointer" — it'd sit on the cursor and bullets would have no direction
  bullet: { "id":"bullet","kind":"obstacle","shape":"dot","color":"#dff0ff","size":4,"control":"none","spawn":{"count":0},"props":{"speed":520,"ttl":1.4} }
  { "on":"input","key":"pointer","effects":[{"op":"spawn","target":"bullet","from":"player","aim":"pointer"}] },
  { "on":"collision","between":["bullet","enemy"],"effects":[{"op":"destroy","target":"self"},{"op":"destroy","target":"other"},{"op":"score","value":1}] }
Recipe — Tank 1990 (drive with arrows, SPACE fires the way you're facing; enemies fire forward too):
  player: "control":"arrows"   // faces the way it moves; "forward" fires that way
  bullet: { ..., "control":"none","spawn":{"count":0},"props":{"speed":480,"ttl":1.6} }
  { "on":"input","key":"space","effects":[{"op":"spawn","target":"bullet","from":"player","aim":"forward"}] },
  { "on":"interval","every":1.3,"effects":[{"op":"spawn","target":"shell","from":"enemy","aim":"forward"}] }
  (destructible brick walls: solid squares + { "on":"collision","between":["bullet","brick"],"effects":[{"op":"destroy","target":"self"},{"op":"destroy","target":"other"}] })`,
  },
  {
    id: "variables",
    title: "Global variables",
    summary: "game-wide counters (lives/level/ammo/wave) shown on the HUD",
    doc: `Global variables — game-wide named counters (lives, level, ammo, wave, ...).
- Declare with starting values in a top-level "vars": { "lives": 3, "level": 1 }.
- Read/write by BARE NAME (no dot), the same places that take "score": effect { "op":"add","target":"lives","value":-1 }; condition "lives <= 0". They show on the HUD. You MUST declare a var in "vars" before using it (undeclared = validation error); "score" is built-in.
Recipe — 3 lives (each enemy hit costs one and removes that enemy; game over at zero):
  "vars": { "lives": 3 },
  { "on":"collision","between":["player","enemy"],"when":"lives > 1","effects":[{"op":"add","target":"lives","value":-1},{"op":"destroy","target":"other"}] },
  { "on":"collision","between":["player","enemy"],"when":"lives <= 1","effects":[{"op":"gameover"}] },
  "lose": { "when": "lives <= 0" }
Other uses: "ammo" spent per shot ("when":"ammo > 0", then add ammo -1) and refilled by a pickup; a "level"/"wave" raised on an interval to gate harder spawns.`,
  },
  {
    id: "spawn-areas",
    title: "Spawn placement",
    summary: "scatter spawns within a region (top/bottom/left/right/edges/center)",
    doc: `Spawn placement — constrain where scattered entities appear.
- "spawn": { "area": "top"|"bottom"|"left"|"right"|"edges"|"center", "count": N, "maintain": N }. Overrides random/x,y.
Recipe — base defense (enemies pour in from the top and advance on a base at the bottom, so a respawn never lands on the base):
  base:  { "id":"base","kind":"obstacle","shape":"square","color":"#ffd23f","size":17,"control":"none","spawn":{"x":400,"y":560,"count":1} },
  enemy: { "id":"enemy","kind":"enemy","shape":"square","color":"#d24b4b","size":15,"behavior":"chase:base","spawn":{"area":"top","count":4,"maintain":4},"props":{"speed":60} },
  { "on":"collision","between":["enemy","base"],"effects":[{"op":"gameover"}] }`,
  },
  {
    id: "glyphs",
    title: "Glyphs (pixel shapes, animation, hit-flash & composition)",
    summary: "draw entities as a bitmap / named preset / GIF-like animation / composed multi-colour sprite; rotate; flash on hit",
    doc: `Glyphs — represent an entity as a tiny pixel grid instead of a bare shape (still no assets, just data). Ways, cheapest first:
- "glyph": "<preset>"  — a built-in MONOCHROME shape. Presets: ${GLYPH_PRESET_NAMES.join(", ")}. Some (invader, blob, flame) are multi-frame and ANIMATE on their own. Prefer a preset when one fits.
- "glyph": [ "<row>", ... ]  — raw rows of a small bitmap (3x3, 5x5, 8x8, any size) when no preset fits. A cell is "on" for any char except space, "." or "0". Drawn scaled to the entity's box in its color. Author it FACING UP. Bigger grids (8x8+) = more detail.
PREFER a plain single-layer glyph — it's the most flexible (you control its colour via the entity, and can reuse it as a part/tile). Use the two composition forms below ONLY when you genuinely need them, not by default:
- LAYERS (multi-COLOUR at the same spot): "parts": [ { "glyph": <rows or preset>, "color": "#rrggbb" }, ... ]  — a stack of layers drawn back-to-front, so one entity is a little coloured sprite (a tree = brown trunk layer + green canopy layer; a face = yellow + dark features). Each part's "glyph" is inline rows or a monochrome preset name to reuse; "color" defaults to the entity color. Built-in composed presets: ${COMPOSED_PRESET_NAMES.join(", ")} (e.g. "glyph": "pinetree"). Use when an item needs MULTIPLE colours in the same square.
- TILES (assemble a BIG item from small tiles): "tiles": [ [ <cell>, <cell>, ... ], ... ]  — a grid of tile cells forming one big composite sprite on a single entity. Each cell is a preset name (drawn in the entity color), a { "glyph": <preset or rows>, "color": "#rrggbb" } (a tile in its own colour), or null/"."/"" for a gap. Use when you'd build a big structure from repeated/arranged tiles (a castle from "brick" + "door" tiles) as ONE entity. Priority: tiles > parts > glyph/frames.
- "frames": [ [ "<row>", ... ], [ "<row>", ... ], ... ] + "fps": <number>  — explicit GIF-like animation: a list of bitmap frames cycled at fps (default 6). Overrides "glyph". Use it for a walk cycle / pulse / spin so the entity feels alive.
- "loop": false  — play a multi-frame glyph ONCE instead of looping. If the entity also has a "ttl", the frames spread across its lifetime then it despawns — exactly what a one-shot effect (an "explosion") wants. Default true (loop forever).
- "rotate": true  — turn the glyph to the entity's facing (the way it last moved), so it visibly points its direction. Composes with any of the above (the current frame is rotated). Great for tanks/ships.
Hit-flash (works on ANY entity, glyph or bare shape):
- effect { "op":"flash", "target":"self"|"other"|"<id>", "value": <seconds> }  — flashes that entity bright for "value" seconds (default 0.15). Use it in a collision rule for instant "I got hit" feedback, especially on a hit the entity SURVIVES (a multi-hp enemy, the shielded player). target defaults to "self".
- "flashColor": "#rrggbb"  — the color to flash to (on the EntitySpec; default white).
Recipes:
  • preset, animated for free:   { "id":"bug","kind":"enemy","shape":"square","color":"#9be15d","size":14,"behavior":"wander","glyph":"invader","spawn":{"count":5} }
  • a tank that points the way it drives:  { "id":"player","kind":"player","shape":"square","color":"#8cb33a","size":15,"control":"arrows","glyph":"tank","rotate":true,"spawn":{"x":400,"y":520} }
  • a custom 2-frame pulsing pickup:  { "id":"gem","kind":"food","shape":"dot","color":"#ffd23f","size":9,"frames":[["..X..",".XXX.","XXXXX",".XXX.","..X.."],[".....","..X..",".XXX.","..X..","....."]],"fps":4,"spawn":{"random":true,"maintain":6} }
  • a COMPOSED multi-colour tree (one entity, two coloured layers):  { "id":"tree","kind":"obstacle","shape":"square","color":"#2e8b3d","size":24,"control":"none","parts":[{"glyph":["........","........","........","........","........","........","...XX...","...XX..."],"color":"#7a4a23"},{"glyph":["...XX...","..XXXX..",".XXXXXX.","XXXXXXXX",".XXXXXX.","..XXXX..","........","........"],"color":"#2e8b3d"}],"spawn":{"x":200,"y":300} }   (or just "glyph":"pinetree")
  • a BIG castle TILE assembled from small tiles (one entity, 3x3 grid):  { "id":"castle","kind":"obstacle","shape":"square","color":"#9a9aa2","size":48,"control":"none","solid":true,"tiles":[[{"glyph":"crown","color":"#9a9aa2"},"brick",{"glyph":"crown","color":"#9a9aa2"}],["brick","brick","brick"],["brick",{"glyph":"flag","color":"#e23d3d"},"brick"]],"spawn":{"x":400,"y":300} }   (cells = preset names or {glyph,color}; null/"." = a gap)
  • an explosion on a kill (juice): a one-shot effect entity spawned where the enemy died, that plays once and vanishes —
      { "id":"boom","kind":"effect","shape":"dot","color":"#ff9a3c","size":18,"control":"none","glyph":"explosion","loop":false,"spawn":{"count":0},"props":{"ttl":0.4} }
      { "on":"collision","between":["bullet","enemy"],"effects":[{"op":"spawn","target":"boom","from":"other"},{"op":"destroy","target":"self"},{"op":"destroy","target":"other"},{"op":"score","value":1}] }
    (count:0 so it only appears via the rule; loop:false + ttl:0.4 = the 5 explosion frames play once over 0.4s, then it auto-despawns.)
  • a 3-hp armored enemy that FLASHES on a survivable hit and explodes on the kill (branch on hp; first matching rule wins):
      enemy: { ..., "props":{"speed":50,"hp":3}, "flashColor":"#ffd23f" }
      { "on":"collision","between":["bullet","enemy"],"when":"enemy.hp > 1","effects":[{"op":"add","target":"other.hp","value":-1},{"op":"flash","target":"other"},{"op":"destroy","target":"self"}] }
      { "on":"collision","between":["bullet","enemy"],"when":"enemy.hp <= 1","effects":[{"op":"spawn","target":"boom","from":"other"},{"op":"destroy","target":"self"},{"op":"destroy","target":"other"},{"op":"score","value":1}] }
    (the surviving hit flashes the enemy bright so the player sees it connected; the killing hit bursts.)
  (Glyphs are visual only — collisions still use "size". A multi-frame glyph cycles on sim time, so it's deterministic and pauses when paused.)`,
  },
  {
    id: "obstacles",
    title: "Walls & cover",
    summary: "solid entities that block movement (walls, mazes, cover)",
    doc: `Obstacles & physical bodies — solid entities block movement.
- "solid": true blocks other entities from passing through. Two common uses:
  (a) static walls/cover — a "square" with "control":"none" (bricks, steel);
  (b) physical bodies — mark MOVING entities solid too (e.g. tanks/units) so they don't overlap or stack on each other (they push apart; a moving solid is still pushed out of static walls).
- Enemies do NOT pathfind around solids (they roam/chase in straight lines and just stop at walls), so leave open lanes.
Recipe — walls/cover: place a few solid squares at fixed positions:
  { "id":"w1","kind":"obstacle","shape":"square","color":"#6b7280","size":42,"control":"none","solid":true,"spawn":{"x":300,"y":300,"count":1} }
  (repeat with different ids and x/y for more walls / a maze)`,
  },
  {
    id: "bounce",
    title: "Bounce & paddles (Breakout / Pong)",
    summary: "a ball that reflects off walls, bricks, and a paddle — the brick-breaker / paddle genre",
    doc: `Bounce physics — reflect a moving ball off surfaces. Unlocks Breakout, Pong, and ball toys.
- world "edges": "bounce"  — the ball reflects off the LEFT/RIGHT/TOP walls; the BOTTOM is left OPEN so the player can "miss" (put a deadzone strip along the bottom to catch a lost ball).
- effect { "op": "bounce" }  — in a collision rule, reflects "self"'s velocity off "other" along the face it hit (and nudges it clear). Put it FIRST in the effects so it bounces before "other" is destroyed.
- control "follow-pointer-x"  — track only the cursor's X (a paddle pinned to its row); never moves vertically.
- The ball is a projectile: "control":"none", "spawn":{"count":0}, and a "speed". LAUNCH it from the paddle with a spawn effect (aim "up") so it starts moving (a pre-spawned ball has zero velocity). It has NO ttl — it lives until it hits the deadzone.
Recipe — Breakout (mouse paddle; bricks via the tilemap; 3 lives):
  "world": { "width":640, "height":640, "background":"#0b0b12", "edges":"bounce" },
  "vars": { "lives": 3 },
  paddle:  { "id":"paddle","kind":"player","shape":"square","color":"#8cb33a","size":20,"control":"follow-pointer-x","spawn":{"x":320,"y":600,"count":1},"props":{"speed":420} },
  ball:    { "id":"ball","kind":"obstacle","shape":"dot","color":"#dff0ff","size":7,"control":"none","spawn":{"count":0},"props":{"speed":300} },
  brick:   { "id":"brick","kind":"obstacle","shape":"square","color":"#d24b4b","size":18,"spawn":{"count":0} },
  deadzone:{ "id":"deadzone","kind":"obstacle","shape":"square","color":"#1a1a26","size":320,"control":"none","spawn":{"x":320,"y":700,"count":1} },
  // bricks placed by a tilemap grid at the top; '#'->brick. (See the tilemap capability.)
  rules:
  { "on":"input","key":"pointer","when":"ball.count == 0","effects":[{"op":"spawn","target":"ball","from":"paddle","aim":"up"}] },
  { "on":"collision","between":["ball","paddle"],"effects":[{"op":"bounce"}] },
  { "on":"collision","between":["ball","brick"],"effects":[{"op":"bounce"},{"op":"destroy","target":"other"},{"op":"score","value":1}] },
  { "on":"collision","between":["ball","deadzone"],"effects":[{"op":"destroy","target":"self"},{"op":"add","target":"lives","value":-1}] },
  "win": { "when": "brick.count == 0" }, "lose": { "when": "lives <= 0" }
  (bounce is "self" off "other" — self is between[0], so list the BALL first in every bounce rule's "between".)`,
  },
  {
    id: "runner",
    title: "Runner (Snake / Tron constant-forward movement)",
    summary: "an entity that always moves forward and steers with arrows (no reversal) — Snake, Tron light-cycles",
    doc: `Runner — constant forward motion with turn-only steering, for Snake / Tron / endless-runner movement.
- "control": "runner"  — the entity ALWAYS moves forward at its "speed" in its current heading; arrows/WASD steer it to a cardinal direction, but a direct 180° reversal is refused (it can't turn back the way it came — so it won't instantly reverse into its own trail). It never stops. Heading starts "up".
- Pair with "edges": "wrap" so it loops around the screen, and "glyph"+"rotate":true so it visibly points where it's going.
- A trailing BODY: have the head drop short-lived segments behind itself on an interval — spawn a "seg" type with "from":"head","aim":"backward" (placed just behind), the seg having "control":"none","speed":0 (stays put). A head↔seg collision ends the game (you ran into your trail).
- GROWTH: keep a "length" var (trail lifetime in seconds) and spawn each seg with "ttlFrom":"length" so its ttl = the current length. Eating adds to "length", so new segments live longer and the body grows. (Growth is smooth — the body reaches its new length over ~1s as fresh longer-lived segments replace expiring ones.)
Recipe — Snake (grows as you eat):
  "world": { "width":600,"height":600,"background":"#0b0b12","edges":"wrap" },
  "vars": { "length": 0.5 },
  head: { "id":"head","kind":"player","shape":"square","color":"#6fcf52","size":11,"control":"runner","glyph":"arrow","rotate":true,"spawn":{"x":300,"y":300},"props":{"speed":150} },
  seg:  { "id":"seg","kind":"obstacle","shape":"square","color":"#3fa34d","size":9,"control":"none","spawn":{"count":0},"props":{"speed":0} },
  food: { "id":"food","kind":"food","shape":"dot","color":"#ffd23f","size":8,"spawn":{"random":true,"maintain":1} },
  { "on":"interval","every":0.08,"effects":[{"op":"spawn","target":"seg","from":"head","aim":"backward","ttlFrom":"length"}] },
  { "on":"collision","between":["head","food"],"effects":[{"op":"score","value":1},{"op":"add","target":"length","value":0.3},{"op":"destroy","target":"other"}] },
  { "on":"collision","between":["head","seg"],"effects":[{"op":"gameover"}] }`,
  },
  {
    id: "platformer",
    title: "Platformer (gravity, jumping, platforms — Mario)",
    summary: "side-on gravity + a run/jump control that lands on solid platforms (Mario / side-scroller)",
    doc: `Platformer — side-on gravity, running, and jumping onto platforms (Mario-style).
- world "gravity": <number>  — downward acceleration (units/s²) applied to platformer entities. Try 1600–1900. Without it the world is top-down (the default).
- "control": "platformer"  — left/right (arrows/AD) RUN at "speed"; gravity pulls the entity down; ↑/W/space JUMP with an upward impulse of the "jump" prop, but ONLY when grounded (no mid-air double-jumps).
- Platforms/ground are "solid":true squares (control "none"). The player lands on top of them (becomes grounded) and is blocked sideways — standard solid bodies, now with gravity. Best authored as a "tilemap" (legend "#"→ground). Leave GAPS in the ground for pits.
- Pits / falling death: put a "deadzone" strip ("solid":false squares, e.g. a tilemap bottom row "D"→deadzone) below the ground; a player↔deadzone collision → gameover. Coins (collect→score) and a goal (reach→win) are ordinary collision rules.
- Enemies (Goombas): give an enemy "behavior":"walker" — it patrols horizontally at "speed", gravity pulls it down onto the ground, and it reverses at walls and ledges (stays on its platform). Use the "goomba" glyph (it waddles).
- STOMP vs. get hurt: in a collision, "self.vy" (and "vx"/"grounded") are readable in "when". Branch the player↔goomba collision: a falling player (when "self.vy > 40") STOMPS — "bounce" (springs the player up) + destroy the goomba + score; otherwise (a side bump) it's a "gameover". List the stomp rule FIRST (first matching collision rule wins).
- The "camera" capability composes: a viewport narrower than the world scrolls to follow the player.
Goomba + stomp rules:
  goomba: { "id":"goomba","kind":"enemy","shape":"square","color":"#9a6324","size":13,"behavior":"walker","glyph":"goomba","spawn":{"count":0},"props":{"speed":55} },
  { "on":"collision","between":["player","goomba"],"when":"self.vy > 40","effects":[{"op":"bounce"},{"op":"destroy","target":"other"},{"op":"score","value":1}] },
  { "on":"collision","between":["player","goomba"],"when":"self.vy <= 40","effects":[{"op":"gameover"}] }
Recipe — Mario-lite (run, jump, platforms, coins, a flag, pits; level as a tilemap):
  "world": { "background":"#5c94fc","edges":"wall","gravity":1700,"viewport":{ "width":640,"height":448 } },
  player: { "id":"player","kind":"player","shape":"square","color":"#e23d3d","size":13,"control":"platformer","spawn":{"count":0},"props":{"speed":170,"jump":640} },
  ground: { "id":"ground","kind":"obstacle","shape":"square","color":"#7a4a23","size":16,"control":"none","solid":true,"spawn":{"count":0} },
  coin:   { "id":"coin","kind":"food","shape":"dot","color":"#ffd23f","size":7,"control":"none","spawn":{"count":0} },
  goal:   { "id":"goal","kind":"goal","shape":"square","color":"#2e7d32","size":14,"control":"none","spawn":{"count":0} },
  deadzone:{ "id":"deadzone","kind":"obstacle","shape":"square","color":"#5c94fc","size":16,"control":"none","spawn":{"count":0} },
  "map": { "tile":32, "legend":{ "#":"ground","C":"coin","G":"goal","D":"deadzone","P":"player" }, "rows":[ ...ASCII level, ground row with gaps, a deadzone bottom row... ] },
  { "on":"collision","between":["player","coin"],"effects":[{"op":"score","value":1},{"op":"destroy","target":"other"}] },
  { "on":"collision","between":["player","goal"],"effects":[{"op":"win"}] },
  { "on":"collision","between":["player","deadzone"],"effects":[{"op":"gameover"}] }
  (size 16 ground = a 32px tile. The player jump 640 + gravity 1700 clears ~120px up and a ~3-tile pit. Put the player 'P' a row above the ground so it drops onto it.)`,
  },
  {
    id: "camera",
    title: "Camera (world bigger than the screen)",
    summary: "a scrolling viewport that follows the player when the world is larger than the window",
    doc: `Camera — make the world bigger than the visible screen; the view scrolls to follow the player.
- By default the viewport equals the world, so everything is on screen (no scrolling).
- Add "viewport": { "width": W, "height": H } to "world" to show only a W×H window. When the world is bigger than the viewport, the camera centres on the player and clamps at the world edges (no scrolling past the border). The canvas is the viewport size; the HUD/overlays stay fixed on screen.
- Pointer aim/control is automatically converted to world coordinates, so "follow-pointer" and "aim":"pointer" keep working while scrolling.
Recipe — a big arena you explore (1600x1200 world seen through an 800x600 window):
  "world": { "width":1600,"height":1200,"background":"#0b0b12","edges":"wall","viewport":{ "width":800,"height":600 } },
  player: { ...,"control":"arrows","spawn":{ "x":800,"y":600 } }   // starts mid-world; the camera follows it
  (Combine with the tilemap capability to author the whole big level as ASCII art.)`,
  },
  {
    id: "tilemap",
    title: "Tilemap (author levels as a grid)",
    summary: "draw wall-heavy levels as rows of characters; a legend maps each char to an entity",
    doc: `Tilemap — author a level as a grid of characters instead of placing every wall by hand. Best for mazes / wall-heavy levels.
- Add a top-level "map": { "tile": N, "legend": { "<char>": "<entityId>" }, "rows": [ "....", ... ] }.
- "tile" is the world size of one cell. Each character in "rows" is looked up in "legend"; the matching entity is placed at that cell's CENTRE. Characters not in the legend (space or ".") are empty. Use a single character per legend key.
- The world size is taken from the grid: width = (longest row length) x tile, height = (row count) x tile. With a map you may omit world.width/height.
- Entity types used in the legend are placed ONLY by the grid (their own spawn x/y/count is ignored). Other entities (the player, roaming enemies) still spawn normally — give the player a fixed spawn inside the open space, OR put it in the legend too for a precise start cell. Size each wall so it fills a cell (square "size" = tile/2).
Recipe — a scrolling maze (40px tiles, walls from ASCII; pair with the camera capability):
  "world": { "background":"#0b0b12","edges":"wall","viewport":{ "width":640,"height":480 } },
  "map": {
    "tile": 40,
    "legend": { "#": "wall", "P": "player" },
    "rows": [
      "####################",
      "#P.......#.........#",
      "#.######.#.#######.#",
      "#......#...#.......#",
      "######.#####.#####.#",
      "#..................#",
      "####################"
    ]
  },
  wall:   { "id":"wall","kind":"obstacle","shape":"square","color":"#6b7280","size":20,"control":"none","solid":true,"spawn":{"count":0} },
  player: { "id":"player","kind":"player","shape":"square","color":"#8cb33a","size":14,"control":"arrows","spawn":{"count":0},"props":{"speed":200} }
  (Legend entities set "spawn":{"count":0} — the grid places them. size 20 = tile/2 fills the cell; the player is a touch smaller so it slips through gaps.)`,
  },
];

/** A complete, valid GameSpec (core-only), pretty-printed — the worked example. */
export function exampleSpecJson(): string {
  return JSON.stringify(growAndSlow, null, 2);
}

const capabilityMenu = () => CAPABILITIES.map((c) => `  - ${c.id} — ${c.summary}`).join("\n");

/** Core + worked example + the menu of capabilities to load on demand. */
export function coreReference(): string {
  return `${CORE}

Worked example (idea: "${growAndSlow.meta?.idea}"):
${exampleSpecJson()}

EXTENSIONS — the core above covers most games. For more, call get_dsl_reference(capability) to load one slice when your game needs it:
${capabilityMenu()}`;
}

/** Look up one capability's full doc by id. */
export function capability(id: string): Capability | undefined {
  return CAPABILITIES.find((c) => c.id === id);
}

/** Core + every capability in one blob — for one-shot compilers (no progressive disclosure). */
export function fullReference(): string {
  return [CORE, ...CAPABILITIES.map((c) => `--- CAPABILITY: ${c.title} (${c.id}) ---\n${c.doc}`)].join("\n\n");
}

/** Back-compat alias: the full reference (used by the one-shot Claude system prompt). */
export const DSL_REFERENCE = fullReference();

/** Full reference + worked example, for tools/skills that want everything at once. */
export function dslReferenceWithExample(): string {
  return `${fullReference()}\n\nComplete example for the idea "${growAndSlow.meta?.idea}":\n\n${exampleSpecJson()}`;
}
