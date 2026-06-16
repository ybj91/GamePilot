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

/** The essentials — entities, rules, effects, conditions, win/lose. */
export const CORE = `A GameSpec is a declarative JSON document a deterministic 2D engine plays directly. Visuals are primitive shapes (no assets) — gameplay is what matters. Emit DATA ONLY: never code.

GameSpec:
{
  "meta": { "title": string, "idea": string },
  "world": { "width": number, "height": number, "background": "#rrggbb", "edges": "wall" | "wrap" },
  "entities": EntitySpec[],     // at least one; exactly one with kind "player"
  "rules": Rule[],
  "win":  { "when": string },   // optional
  "lose": { "when": string }    // optional
}

EntitySpec:
{
  "id": string,                 // unique; referenced by rules/behaviors (e.g. "player","food","enemy")
  "kind": "player" | "enemy" | "food" | "obstacle" | string,
  "shape": "circle" | "square" | "dot",
  "color": "#rrggbb",
  "size": number,               // radius (circle/dot) or half-width (square), world units (pixels)
  "spawn": { "x"?: number, "y"?: number, "random"?: boolean, "count"?: number, "maintain"?: number },
  "control": "none" | "follow-pointer" | "arrows",   // optional; the player usually has one
  "behavior": "chase:<id>" | "flee:<id>" | "wander", // optional autonomous movement (target is an entity id)
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
    id: "obstacles",
    title: "Walls & cover",
    summary: "solid entities that block movement (walls, mazes, cover)",
    doc: `Obstacles — walls and cover that block movement.
- "solid": true on an entity (usually a "square" with "control":"none") blocks other entities from passing through it.
- Enemies do NOT pathfind around solids (they "chase" in a straight line and just stop at walls), so leave open lanes.
Recipe — walls/cover: place a few solid squares at fixed positions:
  { "id":"w1","kind":"obstacle","shape":"square","color":"#6b7280","size":42,"control":"none","solid":true,"spawn":{"x":300,"y":300,"count":1} }
  (repeat with different ids and x/y for more walls / a maze)`,
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
