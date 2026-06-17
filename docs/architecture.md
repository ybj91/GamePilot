# Architecture

GamePilot is a **framework** for AI-authored games, hosting one **paradigm** (real-time 2D arcade). The framework — the AI seam, validation, the store, the backend, the library, the MCP server, the iterative loop — is game-agnostic. Only the DSL + engine + renderer is specific to the arcade paradigm.

```
idea ─▶ AI / you ─▶ GameSpec (DSL) ─▶ Engine ─▶ Renderer
        (the seam)   ★ the contract ★  (sim+rules)  (shapes + glyphs)
```

## The three layers (the arcade paradigm)

### `src/dsl/` — the contract
- **`types.ts`** — the `GameSpec` shape (`world` + `entities` + `rules` + optional `vars`/`win`/`lose`). This file *is* the spec; read it first.
- **`validate.ts`** — a dependency-free runtime validator. The guard at the **untrusted-output seam** — every path (chat, MCP, hand-edit) passes through it.
- **`reference.ts`** — the DSL written as prose, the single source of truth for teaching an AI. Organized as **CORE** (the ~80% every game needs) + a **CAPABILITIES** registry (advanced slices, each with a recipe). See [the DSL reference](dsl.md).
- **`samples/growAndSlow.ts`** — the canonical worked example.

### `src/engine/` — deterministic runtime (no DOM except `input.ts`)
Per fixed **60 Hz** step the order is **movement → rules → expire ttl → reap dead → resolve solids → maintain populations → check win/lose**. The order matters (e.g. solid push-out runs *after* rules so a "bullet destroys brick" rule still sees the overlap).
- **`engine.ts`** — fixed-timestep loop (accumulator, clamps tab-stalls); `pause`/`resume`.
- **`world.ts`** — mutable state: entities, `score`, global **`vars`** (`getVar`/`setVar`), spawn/`maintain`/`area` placement, `nearestOf`, `stepLifetimes` (ttl).
- **`entity.ts`** — runtime instance: position, velocity, **heading** (`hx`/`hy`), props, `solid`, `glyph`. Props go through `getEntityProp`/`setEntityProp` (`size`/`speed` are mirrored).
- **`movement.ts`** — control (`follow-pointer`/`arrows`) + behaviours (`chase`/`flee`/`wander`) → velocity → heading → integrate. `resolveSolids` keeps bodies from overlapping (circle-vs-AABB; tanks push apart, static walls stay put).
- **`collision.ts`** — O(n²) circle-overlap pairs.
- **`rules.ts`** — the heart: matches input/collision/tick/interval, gates on `when`, binds `self`/`other`, applies effects. First matching collision rule wins per contact. `spawn` supports `from` + `aim` (incl. `forward`/`backward` via heading) for projectiles.
- **`conditions.ts`** — a tiny safe expression evaluator (`"score >= 20"`, `"lives <= 0"`, `"self.shield > 0"`). No `eval`.
- **`rng.ts`** — seeded PRNG; the engine never calls `Math.random`, so seed + idea reproduces a playthrough.

### `src/render/` — no-asset renderer
- **`renderer.ts`** — shapes (circle/square/dot) with glow, **glyphs** (a pixel grid scaled to the entity, optionally rotated to its heading), and a HUD (score + vars, win/lose/paused overlays).

## The AI seam (`src/ai/`)
The single, swappable touch-point: `idea → GameSpec`.
- **`compiler.ts`** — the `GameplayCompiler` interface.
- **`mockCompiler.ts`** — an offline keyword stand-in (no key/network).
- **`anthropicCompiler.ts`** — the real Claude compiler (`claude-opus-4-8`, adaptive thinking), base-aware so it can *adjust* an existing game. Server-side only.
- **`buildPrompt.ts`** — assembles the system prompt from the DSL reference.

The compiler is selected by the backend: the Claude compiler when `ANTHROPIC_API_KEY` is set, otherwise the mock. **But the most capable path needs no key at all** — your own agent drives GamePilot over MCP (below).

## The framework (`server/` + client)

### `server/store.ts` — the store
File-based `GameSpec` store (`data/games/<id>.json`). `saveGame`/`updateGame` validate before writing — the write-side guard. Shared by the HTTP backend and the MCP server.

### `server/http.ts` — the backend (Fastify)
- REST: `POST /api/validate`, `POST /api/games`, `PUT /api/games/:id`, `GET /api/games`, `GET /api/games/:id`, `GET /api/games/:id/download`, `DELETE /api/games/:id`.
- `POST /api/chat` — one conversational turn → create or adjust via the compiler.
- `POST /mcp` — MCP over stateless Streamable HTTP.
- Serves the built client; `/play/:id` and `/games` deep-link into it.

### `server/mcp.ts` — the MCP server
Exposes game authoring as MCP tools so any agent can drive GamePilot **without an API key**:
`get_dsl_reference(capability?)` · `validate_game` · `create_game` · `update_game` · `list_games` · `get_game` · `delete_game`. `get_dsl_reference` does **progressive disclosure** — returns the CORE DSL + a menu of capabilities; pass a capability id to load just that slice. Transports: **stdio** (`server/mcp-stdio.ts`, `npm run mcp`) and **HTTP** (`/mcp`). `.mcp.json` registers the stdio server for Claude Code.

### The client (`index.html` + `src/main.ts`)
A two-pane workspace: a game **stage** (canvas + Pause/Replay/New) beside a **conversation panel**. Chat messages hit `/api/chat`; the stage reloads with the result. On `/play/:id` it loads a saved game and polls for external edits to **hot-reload**. The live `Engine` is exposed as `window.gamepilot` for debugging.

### The games library (`games.html` + `src/library.ts`)
A second page at `/games`: every saved game as a card — **play/edit**, **download** the GameSpec (`/api/games/:id/download`), or **delete** — plus **Import DSL** to load an edited `.json` back. Built as a Vite multi-page bundle.

## Framework vs. paradigm

The arcade paradigm (continuous space, real-time sim, collisions) is one of a few possible runtime models. The framework was built so a *different* paradigm (turn-based board, card) could be hosted later without touching the seam, store, MCP, or UI — only a new DSL + engine + renderer. That option is preserved but **not built**: scope is intentionally arcade-only. See [Extending the DSL → Scope](extending-the-dsl.md#scope-the-hard-boundary).

## Commands

| Command | What |
|---|---|
| `npm start` | build the client, then serve everything on `:4321` (the canonical run) |
| `npm run dev` | Vite dev server with HMR (proxies `/api` to the backend — run `serve` alongside) |
| `npm run serve` | the standalone backend (REST + `/mcp` + `/play`) |
| `npm run mcp` | the MCP server over stdio (what an agent launches) |
| `npm run build` | type-check (strict) + production build |
| `npm run smoke` | headless engine test — run after any engine/DSL change |

There's no separate lint step; strict TypeScript is the gate. The smoke test (`src/engine/engine.smoke.ts`) covers the non-DOM core; browser behaviour is verified with the puppeteer scripts under `scripts/`.
