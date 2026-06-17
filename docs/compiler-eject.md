# Compiler / Eject — a held experiment

> Status: **proof-of-concept, intentionally not wired into the product.**
> Code: [`src/export/compile.ts`](../src/export/compile.ts). Repro:
> `npx tsx scripts/eject.ts && node scripts/eject-verify.mjs`.

## The idea

GamePilot's thesis is *"the DSL is the contract."* Today one consumer of that
contract is the **runtime interpreter** (`src/engine`): it reads a `GameSpec` and
plays it. This experiment is a **second consumer** — a **compiler** that turns a
`GameSpec` into a single self-contained HTML file containing *only the code that
one game needs*, with values inlined and no shared engine imported.

```
                      ┌─ interpreter (src/engine)  → plays the spec live   (authoring/runtime)
GameSpec (contract) ──┤
                      └─ compiler  (src/export)     → emits standalone .html (eject/distribution)
```

The PoC compiles the canonical `growAndSlow` to a **~10 KB** HTML file that
plays offline via `file://` with identical semantics (verified headless:
population, eat→score+grow, enemy→game-over). No `import`, no engine reference.

## Framing: it's a *migration*, not a second backend

The right mental model is **source → build artifact**, like `.c → binary` or
"eject" in create-react-app:

- The `GameSpec` is **source**; the standalone HTML is a **build output** you
  *regenerate*, never hand-maintain.
- So this is **not** "two engines kept in lockstep forever." The interpreter
  stays the single source of truth for *authoring* (instant hot-reload,
  introspectable, pausable, deterministic preview — the loop the AI/agent needs).
  The compiler is a terminal, opt-in **eject** for distribution.
- An eject step is allowed to be **partial and honest**: if a game uses a
  feature the compiler can't emit yet, it says so and you fall back to the
  hosted `/play/:id` runtime. (A *core export* must always work; an *eject* need
  not.)

## Why it's held (and the green-light signal)

The **emitter mirrors the engine**, so it's cheapest to write *once* against a
settled DSL surface. Right now the engine is still growing *systems* (camera,
tilemap, the flash effect, animation all landed recently), so an emitter built
today would be rewritten repeatedly to chase it — for an artifact not yet
needed. Re-*emitting* later is cheap; re-*writing the emitter* is not.

**Start the emitter when** `src/dsl/types.ts` (the contract surface — not engine
internals) goes a stretch with only capability-registry additions (new presets,
behaviors, enum tokens) and **no system/shape changes**, *and* a concrete need
for standalone distribution appears. Then: build a parity harness first, extend
coverage feature-by-feature, then add the eject action.

## What to do now: the compilability discipline (near-free insurance)

The real risk of waiting isn't "more features to cover later" (cheap) — it's
**designing a feature in a compiler-hostile way** and only discovering it at
eject time, then having to refactor the DSL and migrate saved games. Avoid that
without building the emitter:

1. Keep [`canCompile(spec)`](../src/export/compile.ts) honest as a **coverage
   ledger** as the DSL grows.
2. When adding a DSL feature, ask: *"could the emitter produce this cleanly?"*
   If the honest answer is "no, because it does something imperative /
   engine-specific," that's a **DSL smell** — the compiler is a *linter for the
   contract*. Fix the design while it's cheap. This pays off **even if the eject
   button never ships.**
3. Optionally keep the `growAndSlow` eject parity canary green.

## Coverage ledger (PoC)

**Emitted:** world (size/background/edges) · shapes (circle/square/dot) · controls
(follow-pointer/arrows) · behaviours (chase/flee/wander) · spawn (x/y · random ·
area · count · maintain) · effects (add/set/mul/destroy/spawn[+from/aim]/score/
win/gameover) · conditions (`when`, win/lose) · triggers (collision/tick/interval/
input) · vars · ttl · seeded RNG · HUD + win/lose overlay.

**Not yet emitted** (reported by `canCompile`, mechanical to add): `glyph` /
`frames` / `loop` / `rotate` / `flashColor` (renderer — easy), `flash` effect,
`solid` (resolveSolids — self-contained), `map` (tilemap) / `world.viewport`
(camera) — mostly setup. None are *hard*; that they're absent is exactly the
"the interpreter races ahead, the compiler covers a subset" reality.

## The next probe, when we pick this up

A **parity harness**: run the interpreter and the compiled game on the same seed
and the same scripted inputs, and assert their state trajectories match. It
proves the compiler is trustworthy, doubles as the coverage spec, and pairs with
`canCompile` so the UI/agent always knows whether a game is ejectable.
