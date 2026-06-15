/**
 * App entry. Wires the DOM together with the engine:
 *
 *   idea input -> compiler -> GameSpec -> Engine + Renderer
 *
 * The compiler is the AI seam. We try the real Claude-backed compiler (via the
 * dev server's /api/compile), and fall back to the offline keyword mock when no
 * API key is configured or the call fails — so the app is always usable.
 */

import { Engine } from "./engine/engine";
import { Renderer } from "./render/renderer";
import { HttpCompiler, CompilerUnavailableError } from "./ai/httpCompiler";
import { MockCompiler } from "./ai/mockCompiler";
import { growAndSlow } from "./dsl/samples/growAndSlow";
import type { GameSpec } from "./dsl/types";

const gameCanvas = document.getElementById("game") as HTMLCanvasElement;
const hudCanvas = document.getElementById("hud") as HTMLCanvasElement;
const ideaInput = document.getElementById("idea-input") as HTMLInputElement;
const goButton = document.getElementById("idea-go") as HTMLButtonElement;
const statusEl = document.getElementById("status") as HTMLDivElement;

const claude = new HttpCompiler();
const mock = new MockCompiler();

let engine: Engine | null = null;
let currentSpec: GameSpec = growAndSlow;

function setStatus(text: string, warn = false): void {
  statusEl.textContent = text;
  statusEl.classList.toggle("warn", warn);
}

function load(spec: GameSpec): void {
  engine?.dispose();
  currentSpec = spec;
  engine = new Engine(spec);
  const renderer = new Renderer(gameCanvas, hudCanvas, engine.world);
  engine.attachInput(gameCanvas);
  engine.start((world) => renderer.draw(world));
}

/** Try Claude; fall back to the mock so the loop never dead-ends. */
async function compile(idea: string): Promise<{ spec: GameSpec; via: string }> {
  try {
    const spec = await claude.compile({ idea });
    return { spec, via: "claude" };
  } catch (err) {
    if (err instanceof CompilerUnavailableError) {
      const spec = await mock.compile({ idea });
      return { spec, via: "mock-nokey" };
    }
    console.error("Claude compile failed; falling back to mock:", err);
    const spec = await mock.compile({ idea });
    return { spec, via: "mock-error" };
  }
}

async function generate(): Promise<void> {
  // Explicit user action overrides any live-reload polling on a /play/:id tab.
  if (liveReloadTimer) {
    clearInterval(liveReloadTimer);
    liveReloadTimer = undefined;
  }
  const idea = ideaInput.value.trim();
  goButton.disabled = true;
  goButton.textContent = "Compiling…";
  setStatus("Compiling with Claude…");
  try {
    const { spec, via } = await compile(idea);
    load(spec);
    if (via === "claude") setStatus(`Compiled by Claude — "${spec.meta?.title ?? "game"}"`);
    else if (via === "mock-nokey")
      setStatus("Offline mock (set ANTHROPIC_API_KEY to compile with Claude)", true);
    else setStatus("Claude unavailable — used offline mock (see console)", true);
  } catch (err) {
    setStatus(`Could not compile that idea: ${(err as Error).message}`, true);
  } finally {
    goButton.disabled = false;
    goButton.textContent = "Generate";
  }
}

goButton.addEventListener("click", generate);
ideaInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") generate();
});

// R restarts the current game (handy after win/lose).
window.addEventListener("keydown", (e) => {
  if (e.key === "r" || e.key === "R") {
    const target = e.target as HTMLElement | null;
    if (target?.tagName !== "INPUT") load(currentSpec);
  }
});

interface StoredGameResponse {
  spec: GameSpec;
  title?: string;
  updatedAt?: string;
}

let liveReloadTimer: number | undefined;
let lastUpdatedAt = "";

async function fetchGame(id: string): Promise<StoredGameResponse> {
  const res = await fetch(`/api/games/${id}`);
  if (!res.ok) throw new Error(`game "${id}" not found`);
  return (await res.json()) as StoredGameResponse;
}

/** Load a saved game by id from the backend (used on /play/:id routes). */
async function loadById(id: string): Promise<void> {
  setStatus(`Loading game ${id}…`);
  try {
    const game = await fetchGame(id);
    lastUpdatedAt = game.updatedAt ?? "";
    load(game.spec);
    setStatus(`Playing "${game.title ?? game.spec.meta?.title ?? id}"`);
    ideaInput.value = game.spec.meta?.idea ?? "";
    startLiveReload(id);
  } catch (err) {
    console.error(err);
    load(growAndSlow);
    setStatus(`Could not load ${id} — playing the sample instead.`, true);
  }
}

/**
 * Poll the backend for changes to this game and hot-reload it into the same
 * tab — this is what makes iterative editing feel live: an agent calls
 * update_game, and a few seconds later the running game reflects the change
 * without the user navigating or losing their place.
 */
function startLiveReload(id: string): void {
  if (liveReloadTimer) clearInterval(liveReloadTimer);
  const check = async () => {
    try {
      const game = await fetchGame(id);
      const stamp = game.updatedAt ?? "";
      if (stamp && stamp !== lastUpdatedAt) {
        lastUpdatedAt = stamp;
        load(game.spec);
        ideaInput.value = game.spec.meta?.idea ?? "";
        setStatus(`Updated "${game.title ?? id}" ✓ — reloaded live`);
      }
    } catch {
      // Backend hiccup — keep playing what we have and try again next tick.
    }
  };
  liveReloadTimer = window.setInterval(check, 1500);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) check();
  });
}

// /play/:id (served by the backend) loads a saved game; otherwise the sample.
const playMatch = location.pathname.match(/^\/play\/([A-Za-z0-9_-]+)/);
if (playMatch?.[1]) {
  loadById(playMatch[1]);
} else {
  load(growAndSlow);
  setStatus("Playing the sample. Type an idea and hit Generate to compile a new game.");
}
