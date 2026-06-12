# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

GamePilot is an **AI gameplay compiler**: it turns a natural-language idea into a playable 2D, no-asset game prototype. The thesis (deliberate, not incidental):

- **Gameplay > visuals.** Visuals are semantic carriers — primitive shapes + colors, never assets.
- **The AI emits *data*, never code.** Its only job is `idea → GameSpec` (a declarative DSL). Everything downstream is deterministic and AI-agnostic.
- **The DSL is the contract** between every layer. If it's well-shaped, the AI just produces valid JSON and the engine "just plays it."

```
idea ─▶ GameplayCompiler ─▶ GameSpec (DSL) ─▶ Engine ─▶ Renderer
        (AI seam; mocked)    ★ the contract ★   (sim+rules)  (shapes on canvas)
```

## Commands

- `npm run dev` — Vite dev server (hot reload) at http://localhost:5173
- `npm run build` — type-check (`tsc --noEmit`) then production build to `dist/`
- `npm run typecheck` — type-check only
- `npm run smoke` — headless runtime test (`src/engine/engine.smoke.ts` via tsx). Tests the non-DOM core: spawning, collision rules, gameover, win conditions. **Run this after any engine/DSL change** — it's the fast feedback loop that doesn't need a browser.

There is no separate lint step; strict TS (`noUncheckedIndexedAccess`, `noUnusedLocals`, `verbatimModuleSyntax`) is the gate. To run a single check during dev, edit `engine.smoke.ts`.

## Architecture

Three layers, strictly separated so the AI layer is swappable and the engine stays testable headlessly:

### `src/dsl/` — the contract
- `types.ts` — the `GameSpec` shape: `world` + `entities` (typed shapes with `kind`/`color`/`size`/`spawn`/`behavior`/`control`/`props`) + `rules` (`on` trigger → `effects`) + `win`/`lose`. **This file is the spec.** Read it first; extending the DSL starts here.
- `validate.ts` — dependency-free runtime validator. This is the guard at the **untrusted-AI-output seam** — keep it in sync with `types.ts` whenever the DSL grows.
- `samples/growAndSlow.ts` — the canonical hand-written game ("eat food → grow + slow; enemies chase"). Exercises every runtime feature; use it as the reference when adding DSL capabilities.

### `src/engine/` — deterministic runtime (no DOM except `input.ts`)
Per fixed 60Hz step, the update order is **movement → rules → reap dead → maintain populations → check win/lose** (see `engine.ts`). Respect this order — e.g. respawn happens after reaping so destroyed pickups reappear.
- `engine.ts` — fixed-timestep loop (accumulator, clamps tab-stalls), owns `World` + `Input`, drives a render callback.
- `world.ts` — mutable game state: live entity instances, score, status, spawn/respawn/`maintain` logic.
- `entity.ts` — runtime instance (`Entity`) vs. spec type. **Props are accessed via `getEntityProp`/`setEntityProp`** — `size`/`speed` are mirrored onto first-class fields, so always go through the setter to keep them in sync.
- `movement.ts` — control (`follow-pointer`/`arrows`) + behaviours (`chase`/`flee`/`wander`) → velocity → integrate + edge handling.
- `collision.ts` — O(n²) circle-overlap pairs (fine for prototype entity counts).
- `rules.ts` — the heart: matches contacts/ticks/intervals to rules, binds `self`/`other`, applies `effects` (`add`/`set`/`mul`/`destroy`/`spawn`/`score`/`win`/`gameover`).
- `conditions.ts` — tiny safe expression evaluator for win/lose (`"score >= 20"`, `"food.count == 0"`). **No `eval`** — intentionally limited so AI output stays predictable.
- `rng.ts` — seeded deterministic PRNG. The engine never calls `Math.random` directly, so seed + idea reproduces a playthrough.

### `src/render/` — no-asset renderer
- `renderer.ts` — draws shapes (circle/dot/square) with glow on the game canvas; score + win/lose overlay on a separate HUD canvas.

### `src/ai/` — the AI seam
- `compiler.ts` — `GameplayCompiler` interface: `compile({ idea }) → Promise<GameSpec>`. The single AI touch-point; every implementation's output must pass `validateGameSpec`.
- `anthropicCompiler.ts` — **the real compiler (server-side only)**: `idea → GameSpec` via `@anthropic-ai/sdk` (`claude-opus-4-8`, adaptive thinking). Prompts with the DSL + sample, parses JSON, validates, and retries once with the errors. Runs in the Node process (loaded by the Vite middleware via `ssrLoadModule`) so the SDK never enters the client bundle.
- `buildPrompt.ts` — the system prompt (DSL contract + `growAndSlow` as one-shot), user prompt, and repair prompt. Shared by `anthropicCompiler`.
- `httpCompiler.ts` — browser `GameplayCompiler` that POSTs to `/api/compile`. 503 → `CompilerUnavailableError` (no key) so `main.ts` falls back to the mock.
- `mockCompiler.ts` — keyword-based offline stand-in / test double (no key/network). The fallback when Claude is unavailable.

The key path: browser `httpCompiler` → Vite dev middleware `POST /api/compile` (`vite.config.ts`) → `anthropicCompiler`. The API key (`ANTHROPIC_API_KEY`, from shell or `.env.local`) is read in `vite.config.ts` and **never leaves the Node process**. No key → 503 → app silently uses the mock. There is no production server for `/api/compile` yet — it's a dev-only middleware.

### `src/main.ts`
Wires DOM → compiler → `Engine` + `Renderer`. Tries the Claude `HttpCompiler`, falls back to the `MockCompiler` (showing why in the `#status` line). Loads the sample on boot; typing an idea recompiles a new game; `R` restarts.

## Conventions / gotchas

- **Extensionless internal imports** (`./entity`, not `./entity.ts`) — required by `moduleResolution: bundler`. Vite and tsx resolve them; plain `node --strip-types` will not (that's why `smoke` runs via tsx).
- Adding a DSL feature touches three places in lockstep: `types.ts` (shape) → `validate.ts` (guard) → the relevant engine system (execution). Add a check to `engine.smoke.ts`.
- Time is seconds, distances are world-units (pixels). Entity `speed` is units/second.
