/**
 * The GameSpec DSL contract, as prose — the single source of truth for teaching
 * an AI how to author a game. Shared by:
 *   - the Claude compiler's system prompt (src/ai/buildPrompt.ts),
 *   - the MCP server's get_dsl_reference tool (server/mcp.ts),
 *   - the (future) agent skill.
 * Keep this in sync with types.ts / validate.ts when the DSL grows.
 */

import { growAndSlow } from "./samples/growAndSlow";

export const DSL_REFERENCE = `A GameSpec is a declarative JSON document a deterministic 2D engine plays directly. Visuals are primitive shapes (no assets) — gameplay is what matters. Emit DATA ONLY: never code.

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
  "behavior": "chase:<id>" | "flee:<id>" | "wander", // optional autonomous movement
  "props": { "speed": number, ... }                  // speed is units/second; other keys are free numeric state
}
Reserved props: "speed" (movement units/second), "size" (mirrors the shape size), and "ttl" (seconds — the entity auto-despawns when it reaches 0; use it for projectiles/temporary things).
IMPORTANT: an entity type you only create via rules (e.g. bullets) MUST set "spawn": { "count": 0 } so it doesn't pre-spawn at start.

Rule (event -> effects):
{
  "on": "collision" | "tick" | "interval" | "input",
  "between": [idA, idB],        // required when on=collision
  "every": number,              // seconds; required when on=interval
  "key": "<key>",               // required when on=input: "space"|"up"|"down"|"left"|"right"|"w"|"a"|"s"|"d"|"pointer" (mouse)
  "when": "<condition>",        // optional guard — rule only fires if this holds
  "effects": Effect[]
}
An "input" rule fires once per press (down-edge), e.g. jump on "space", shoot on "pointer".

A rule's "when" uses the SAME expression grammar as win/lose (left side: "score", "<id>.count", "<id>.<prop>", or "self"/"other".<prop> in collisions; operators >= <= > < == != ; right side a number). Use it to branch the same trigger on state. Example — a shield that makes enemy hits harmless while it's up:
  { "on": "collision", "between": ["player","enemy"], "when": "player.shield <= 0", "effects": [ { "op": "gameover" } ] },
  { "on": "collision", "between": ["player","enemy"], "when": "player.shield > 0",
    "effects": [ { "op": "destroy", "target": "other" }, { "op": "set", "target": "player.shield", "value": 0 } ] }
A power-up could grant the shield: collision player+shieldItem -> set player.shield 1, destroy other.

Shooter pattern (move with keys, aim+shoot with the mouse): give the player "control": "arrows", add a fast "bullet" entity ("control": "none", short "ttl"), then:
  { "on": "input", "key": "pointer", "effects": [ { "op": "spawn", "target": "bullet", "from": "player", "aim": "pointer" } ] },
  { "on": "collision", "between": ["bullet","enemy"], "effects": [ { "op": "destroy", "target": "self" }, { "op": "destroy", "target": "other" }, { "op": "score", "value": 1 } ] }
(Don't give a shooter player "follow-pointer" — it'd sit on the cursor and bullets would have no direction. Use "arrows" so the mouse is free to aim.)

Effect:
{ "op": "add"|"set"|"mul"|"destroy"|"spawn"|"score"|"win"|"gameover", "target"?: string, "value"?: number }
- add/set/mul: target is "<who>.<prop>" where <who> is "self"/"other" (collision only) or an entity id; e.g. "self.size".
- destroy: target is "self" | "other" | "<id>".
- spawn: target is an entity id (creates one instance). For projectiles, also use:
    "from": "self"|"other"|"<id>"   spawn at that entity's position (instead of the type's spawn config)
    "aim":  "pointer"|"up"|"down"|"left"|"right"|"<id>"   give it an initial velocity (= its speed) in that direction
            ("<id>" aims at the nearest entity of that type). Give the projectile a short "ttl" so it despawns.
- score: value added to global score (default 1). win/gameover: end the game.
In a collision rule, "self" = between[0], "other" = between[1].

win/lose "when" is a tiny expression: left side is "score", "<id>.count", or "<id>.<prop>"; operators >= <= > < == != ; right side a number. Examples: "score >= 20", "food.count == 0", "player.size > 60".

Rules of thumb:
- Player speed ~200-320, enemy speed ~80-160 (slower than player so it's playable), world 800x600.
- Make it winnable and losable: usually a score-based win and a collision-based gameover.
- Use "maintain" on food/pickups so they respawn. Pick colors that read well on a dark (#0b0b12) background.
- Only use the shapes, controls, behaviors, triggers, ops, and target tokens listed above. Nothing else.`;

/** A complete, valid GameSpec, pretty-printed — the canonical worked example. */
export function exampleSpecJson(): string {
  return JSON.stringify(growAndSlow, null, 2);
}

/** Reference + worked example, for tools/skills that want both in one blob. */
export function dslReferenceWithExample(): string {
  return `${DSL_REFERENCE}\n\nComplete example for the idea "${growAndSlow.meta?.idea}":\n\n${exampleSpecJson()}`;
}
