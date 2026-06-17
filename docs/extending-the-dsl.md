# Extending the DSL — the constitution

GamePilot's bet is that the **AI emits constrained data, never code**. That only
holds if the DSL stays small enough for an AI to author and edit reliably. As
capability grows, two things grow with it — and they must be kept apart:

- **Capability** — what games are expressible. *Grow this.*
- **The AI's working set** — how much it must hold in its head to author/edit
  *one* game. *Keep this roughly constant.*

This document is the rule set that keeps them apart. Read it before adding
anything to the DSL.

## Scope (the hard boundary)

In scope: **real-time, continuous-space, no-asset 2D arcade games** — shapes
moving in 2D governed by rules (collision / tick / interval / input). Out of
scope (a *different runtime paradigm*, not a missing feature): turn-based / board
(Go, chess), card / hidden-information (Poker), text/narrative, 3D, anything
asset-dependent. Don't try to express these in the arcade engine; decline and
redirect to an arcade idea.

### Edge finding: trailing-body / auto-runner games (Snake, Tron, Centipede)

A deliberate probe (`scripts/seed-snake.mjs` + `snake-verify.mjs`) tested whether
**Snake** is expressible. Result: a passable *approximation* exists — the head
drops short-lived `seg` segments behind itself (`spawn from:"head" aim:"backward"`,
segment `speed:0` so it stays put + a `ttl` so the tail fades), which **looks**
like a snake and whose **self-collision works** (run into a `seg` → game over).
But it hits three real edges of the movement model:

1. **No auto-forward motion.** `arrows` is *direct velocity* — release the keys
   and the head stops. A runner needs *persistent forward motion + turn-only
   steering*; there's no control for it.
2. **No body growth tied to state.** A spawned entity's `ttl` is fixed by its
   type; it can't be parametrized from a `length` var, so the body length is
   constant. Eating can't lengthen the snake — the defining progression is gone.
3. **The body is a timed-ghost trail, not a true linked chain.** There's no
   "follow the leader's path" primitive (`chase` clumps onto the target, it
   doesn't trail); spacing is an artifact of `speed × tick`.

**Diagnosis:** the engine computes *velocity from control/behaviour each frame* —
it has no notion of persistent motion-state or path-replay/segmented bodies. So
trailing-body / auto-runner is a **movement paradigm at the edge**, not a missing
recipe. **Recommendation:** treat it as a scope edge for now. If these games
become a priority, it's a real *capability cluster* (not free composition): a
`runner` control (constant forward + steer), a way to parametrize a spawned
entity's lifetime/count from a var, and optionally a `follow`/path-trail
behaviour — land them via the ladder below. (Snake is also a useful signal for
the [compiler experiment](compiler-eject.md): the movement model still has genuine
gaps, i.e. the engine isn't settled yet.)

## The decision ladder (try these in order)

When you want a new capability, take the **first** option that works — do not
jump to "add a field".

1. **Can existing primitives + a rule express it?**
   → Add a **recipe** (a worked example in the relevant capability's `doc`), not
   schema. Most "new behaviors" are just new *rules*. The rule system **is** the
   action system: "enemy shoots every 2s and flees when you're close" is two
   rules, not new schema.
2. **If not, is the smallest addition a new enum token on a uniform structure?**
   → Add a new `effect op`, `trigger`, `behavior` verb, or a boolean flag. Cheap
   for the AI: it already understands the `effects`/`rules` shape; it just learns
   one more word. (`solid: true` and `spawn.area` were this.)
3. **Only if neither**, add a new **optional field / small structure** — and put
   it behind a **capability** (see below), documented in its own slice.

Hard constraints on any addition:

- **Never required.** Always optional with a sensible default, so the *minimal
  valid spec stays tiny* and old games keep validating.
- **Prefer enum-extension over new structure.** A new token in an existing list
  is far cheaper for the AI than a new nested shape.
- **Compose, don't enumerate.** Add orthogonal primitives that combine (one
  `solid` flag → walls + mazes + cover), never genre features ("a maze type").
- **Land lockstep + a test + a recipe**: `types.ts` (shape) → `validate.ts`
  (guard, with a precise error) → engine system (execution) → `reference.ts`
  (a capability slice with a recipe) → a check in `engine.smoke.ts`.

## How features are organised (core + capabilities)

`src/dsl/reference.ts` is split so the AI's working set stays small:

- **CORE** — the ~80% every game needs (entities, rules, effects, conditions,
  win/lose). Always in context.
- **CAPABILITIES** — a registry of advanced slices, each with a one-line summary
  and a worked recipe (`shooting`, `variables`, `spawn-areas`, `obstacles`, …).

**Progressive disclosure** delivers them: the MCP `get_dsl_reference()` returns
CORE + the capability menu; `get_dsl_reference("obstacles")` returns just that
slice. So an agent authoring a maze loads `obstacles` and nothing else — core +
one slice, not the whole growing surface. (One-shot compilers with no fetch use
`fullReference()`.)

A new capability is therefore: a new entry in the `CAPABILITIES` array (id,
summary, doc + recipe). That's the *home* for every feature past the core.

## Editability (not just authoring)

Complex specs get hard to *edit* when a change requires understanding the whole.
Keep specs **flat, named (stable ids), one-concern-per-rule**, and favour
small rules over big ones. Prefer targeted edit tools (set a prop, add/remove a
rule) over "rewrite the whole spec" so an adjustment touches one place.

## The smell test

If a proposed addition makes you write "if the game is a shooter…" or "for tank
games…", stop — you're enumerating genres. Find the orthogonal primitive, or
write a recipe. If the minimal valid spec grows, or the AI has to learn a new
*shape* (not just a word), think again.
