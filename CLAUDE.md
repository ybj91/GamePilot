# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

GamePilot is an **AI gameplay compiler**: it turns a natural-language idea into a playable 2D, no-asset game prototype. The thesis (deliberate, not incidental):

- **Gameplay > visuals.** Visuals are semantic carriers — primitive shapes + colors, never assets.
- **The AI emits *data*, never code.** Its only job is `idea → GameSpec` (a declarative DSL). Everything downstream is deterministic and AI-agnostic.
- **The DSL is the contract** between every layer. If it's well-shaped, the AI just produces valid JSON and the engine "just plays it."

```
idea ─▶ GameplayCompiler ─▶ GameSpec (DSL) ─▶ Engine ─▶ Renderer
        (AI seam)            ★ the contract ★   (sim+rules)  (shapes on canvas)
```

## Direction (agent-driven; in progress)

The intended primary flow is **not** an app that holds an API key. Instead an
**agent the user is already logged into** (Claude Code / Desktop / any MCP
client) supplies the intelligence and drives GamePilot through tools. The agent
emits a `GameSpec` (data, never code); GamePilot validates, stores, and hosts
it. This needs no `ANTHROPIC_API_KEY` anywhere.

Build stages:
1. **Library + management backend** (done) — engine/DSL/renderer as a library
   (`src/index.ts`) plus a standalone server (`server/`) that validates, stores,
   and serves playable games.
2. **MCP server** (done) — `server/mcp.ts` exposes the tools over stdio
   (`server/mcp-stdio.ts`) and Streamable HTTP (`/mcp` on the backend) so any
   agent can author games. `.mcp.json` registers it for Claude Code.
3. **Skills** (next) — teach the agent the DSL (progressive disclosure); reuse
   `src/dsl/reference.ts`.
4. **Agent** — orchestrates idea → game using the skill + MCP tools.

The direct-API `anthropicCompiler` (below) is kept as an **optional fallback**
for anyone who *does* have a key; it is not the primary path.

## Commands

- `npm run dev` — Vite dev server (hot reload) at http://localhost:5173
- `npm run build` — type-check (`tsc --noEmit`) then production build to `dist/`
- `npm run typecheck` — type-check only
- `npm run smoke` — headless runtime test (`src/engine/engine.smoke.ts` via tsx). Tests the non-DOM core: spawning, collision rules, gameover, win conditions. **Run this after any engine/DSL change** — it's the fast feedback loop that doesn't need a browser.
- `npm run serve` — standalone backend (`server/index.ts` via tsx) on `:4321`. Serves the REST API, the MCP-over-HTTP endpoint (`/mcp`), and playable games at `/play/:id`. Requires `dist/` (run `build` first).
- `npm run start` — `build` then `serve` (the full backend with a fresh client).
- `npm run mcp` — the MCP server over **stdio** (`server/mcp-stdio.ts`). This is what an agent client launches; stdout is the JSON-RPC channel (logs go to stderr). For games to actually open, also run `npm run serve` (the play host).

There is no separate lint step; strict TS (`noUncheckedIndexedAccess`, `noUnusedLocals`, `verbatimModuleSyntax`) is the gate. To run a single check during dev, edit `engine.smoke.ts`.

## Architecture

Three layers, strictly separated so the AI layer is swappable and the engine stays testable headlessly:

### `src/dsl/` — the contract
- `version.ts` — `DSL_VERSION` (semver `Major.Minor.Patch`), the **contract version**. Bump it when the DSL changes: **minor** for a backward-compatible capability addition, **major** for a breaking shape/semantics change, **patch** for a fix. Keep `package.json` `version` in sync and add a `CHANGELOG.md` entry. A `GameSpec` records its `version` (stamped on save); `validate.ts` rejects a spec whose major is newer than the engine's.
- `types.ts` — the `GameSpec` shape: `world` + `entities` (typed shapes with `kind`/`color`/`size`/`spawn`/`behavior`/`control`/`props`) + `rules` (`on` trigger → `effects`) + `win`/`lose` (+ optional `version`). **This file is the spec.** Read it first; extending the DSL starts here.
- `validate.ts` — dependency-free runtime validator. This is the guard at the **untrusted-AI-output seam** — keep it in sync with `types.ts` whenever the DSL grows.
- `samples/growAndSlow.ts` — the canonical hand-written game ("eat food → grow + slow; enemies chase"). Exercises every runtime feature; use it as the reference when adding DSL capabilities.
- `reference.ts` — the DSL contract as prose, **single source of truth for teaching an AI the DSL**. Organised as `CORE` (the ~80% every game needs) + a `CAPABILITIES` registry (advanced slices, each with a recipe: `shooting`/`variables`/`spawn-areas`/`obstacles`). Accessors: `coreReference()` (core + capability menu, for progressive disclosure), `capability(id)` (one slice), `fullReference()`/`DSL_REFERENCE` (everything, for one-shot compilers). The MCP `get_dsl_reference(capability?)` tool delivers it on demand; `buildPrompt.ts` uses the full blob. **Adding a feature = a new `CAPABILITIES` entry** — see `docs/extending-the-dsl.md` (the DSL constitution) for the decision ladder.

### `src/engine/` — deterministic runtime (no DOM except `input.ts`)
Per fixed 60Hz step, the update order is **movement → rules → expire ttl → reap dead → resolve solids → maintain populations → check win/lose** (see `engine.ts`). Respect this order — e.g. respawn happens after reaping so destroyed pickups reappear, and solid push-out runs *after* rules so a collision rule (bullet destroys a brick) still sees the overlap first.
- `engine.ts` — fixed-timestep loop (accumulator, clamps tab-stalls), owns `World` + `Input`, drives a render callback. `pause()`/`resume()`/`togglePause()` freeze the sim while still rendering (renderer draws a PAUSED overlay).
- `world.ts` — mutable game state: live entity instances, score, **spawn placement** (`spawn.area` = top/bottom/left/right/edges/center via `areaPoint`, else random/fixed), **global `vars`** (named counters from `spec.vars`, accessed via `getVar`/`setVar`; `score` is unified into these), status, spawn/respawn/`maintain` logic, `nearestOf` (aim targeting), and `stepLifetimes` (decrements the reserved `ttl` prop and reaps projectiles). **Entity types created only via rules (bullets) must set `spawn.count: 0`** or they pre-spawn at start.
- `entity.ts` — runtime instance (`Entity`) vs. spec type. **Props are accessed via `getEntityProp`/`setEntityProp`** — `size`/`speed` are mirrored onto first-class fields, so always go through the setter to keep them in sync.
- `input.ts` — pointer + held keys (for `arrows`) + **edge-detected presses** (`justPressed`, for `on:"input"` rules); exposes a plain `InputEnv` so rules stay headlessly testable. `frameEnv()`/`endFrame()` are driven by the loop.
- `movement.ts` — control (`follow-pointer`/`arrows`) + behaviours (`chase`/`flee`/`wander`) → velocity → integrate + edge handling. Entities with `control:"none"` keep whatever velocity a spawn set (how projectiles travel straight). `resolveSolids` pushes non-solid movers out of `solid:true` entities (circle-vs-AABB) so walls/obstacles block movement (no pathfinding around them).
- `collision.ts` — O(n²) circle-overlap pairs (fine for prototype entity counts).
- `rules.ts` — the heart: matches input/contacts/ticks/intervals to rules, gates on `when`, binds `self`/`other`, applies `effects` (`add`/`set`/`mul`/`destroy`/`spawn`/`score`/`win`/`gameover`). `add`/`set`/`mul` on a **dot-less target** hit a global var; with a `.` they hit an entity prop. `spawn` supports `from` (spawn at an entity) + `aim` (initial velocity toward pointer/direction/nearest target) for projectiles. **Per contact, the first matching collision rule whose `when` passes wins** (later rules for that pair are skipped) — so branching patterns (shield up/down, `lives>1`/`lives<=1`) don't double-fire on one hit.
- `conditions.ts` — tiny safe expression evaluator for `when` + win/lose (`"score >= 20"`, `"self.shield > 0"`), with an optional self/other context. **No `eval`** — intentionally limited so AI output stays predictable.
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

### `src/index.ts` — the library barrel
Public API for "create a game": `GameSpec` types, `validateGameSpec`, `Engine`, `World`, `Renderer`, `growAndSlow`. The backend and (future) MCP server import the engine/DSL through here.

### `src/export/` — compiler/eject experiment (NOT wired into the product)
A **second consumer of the DSL contract**: `compile.ts` turns a `GameSpec` into a single self-contained standalone HTML game (only this game's code, no shared engine import) — framed as a one-way **eject/migration** (source → build artifact), not a maintained second backend. It's a **held proof-of-concept**; nothing in the product imports it. Its `canCompile(spec)` is a **coverage ledger** — keep it honest as the DSL grows, and treat "hard to compile cleanly" as a DSL smell (the compiler is a *linter for the contract*). See `docs/compiler-eject.md` for the rationale, the green-light signal for actually building it, and the repro (`npx tsx scripts/eject.ts && node scripts/eject-verify.mjs`). Do not wire it in until the DSL surface (`types.ts`) stops changing systems.

### `server/` — management backend + MCP server (stages 1–2)
Standalone, runs independently of Vite so the MCP server / agent can drive it as a separate process.
- `store.ts` — file-based GameSpec store (`data/games/<id>.json`, gitignored; dir overridable via `GAMEPILOT_DATA_DIR`). `saveGame` (new) and `updateGame` (edit in place — keeps id/createdAt, bumps `updatedAt`) both validate before writing — the write-side guard at the seam. Shared by the HTTP server AND the MCP server. Uses `node:crypto`/`Date` for ids/timestamps (fine — server code, not the deterministic engine).
- `http.ts` — Fastify app: REST API (`POST /api/validate`, `POST /api/games`, `PUT /api/games/:id` [update], `GET /api/games`, `GET /api/games/:id`, `DELETE /api/games/:id`), **`POST /api/chat`** (one conversational turn → create-from-message or adjust-current-game via a `GameplayCompiler`: real Claude if `ANTHROPIC_API_KEY` is set, else the mock), MCP-over-HTTP (`POST /mcp`, stateless Streamable HTTP — fresh server+transport per request via `reply.hijack()`), and the built client with `/play/:id` for deep links.
- `index.ts` — HTTP entry; `PORT`/`HOST` env (default `127.0.0.1:4321`).
- `mcp.ts` — `buildMcpServer()`: the `@modelcontextprotocol/sdk` `McpServer` with tools `get_dsl_reference`, `validate_game`, `create_game`, `update_game`, `list_games`, `get_game`, `delete_game`. The single place tools are defined; both transports use it. Tools go through the same `validateGameSpec` + store. **Iterative design is the intended flow**: `create_game` once (new id), then `get_game` → edit → `update_game` (same id) to refine — `get_dsl_reference` includes this workflow. `create_game`/`update_game` return a `play_url` built from `GAMEPILOT_BASE_URL` (default `http://localhost:4321`).
- `mcp-stdio.ts` — stdio transport entry (`npm run mcp`).

### `games.html` + `src/library.ts` — the games library
A second client page (Vite multi-page: `rollupOptions.input` = `index.html` + `games.html` + `glyphs.html`) listing all saved games as cards from `GET /api/games`; each links to `/play/:id`, with delete. The backend serves it at the extensionless `/games` route. The main UI links to it via the fixed `.topnav`.

### `glyphs.html` + `src/glyphs-gallery.ts` — the glyph library gallery
A third client page (served at `/glyphs`) that renders every `GLYPH_PRESETS` entry to a small canvas — the same pixel-grid the engine renderer draws, in a thematic color with glow, with multi-frame presets animating live (a frame-counter `setInterval` at 6fps). Imports the preset data straight from `src/dsl/glyphs.ts`, so the gallery is always in sync with the library. Linked from the `.topnav`/toolbars. Verify: `scripts/glyphs-verify.mjs`.

### `src/main.ts` + `index.html` — the management UI
A two-pane workspace: a game **stage** (canvas + **Pause/Replay/New** buttons + status) beside a **conversation panel**. Chat messages POST to `/api/chat` and the stage reloads with the created/adjusted game (`currentGameId` tracks the working game; **New** clears it to start fresh). On `/play/:id` it loads that saved game and **polls `updatedAt` (every 1.5s) to hot-reload** external agent edits (`startLiveReload`). Pause/Replay drive the engine; `R` also restarts. The live `Engine` is exposed as `window.gamepilot` for debugging/automated verification. The full UI needs the Fastify backend (`npm start`); `npm run dev` proxies `/api` to it.

## Conventions / gotchas

- **Extensionless internal imports** (`./entity`, not `./entity.ts`) — required by `moduleResolution: bundler`. Vite and tsx resolve them; plain `node --strip-types` will not (that's why `smoke` runs via tsx).
- Adding a DSL feature is governed by `docs/extending-the-dsl.md` (the constitution): prefer a recipe → an enum token → an optional field behind a capability. It lands lockstep across `types.ts` (shape) → `validate.ts` (guard) → the relevant engine system (execution) → a `CAPABILITIES` slice + recipe in `reference.ts` → a check in `engine.smoke.ts`. Keep CORE small; new features go in the capability registry.
- Time is seconds, distances are world-units (pixels). Entity `speed` is units/second.
