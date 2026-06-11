/**
 * App entry. Wires the DOM together with the engine:
 *
 *   idea input -> MockCompiler.compile() -> GameSpec -> Engine + Renderer
 *
 * Loads the canonical sample on boot so there's always something playable, and
 * lets you type an idea to "recompile" a new game. The compiler is the only AI
 * touch-point; everything else is deterministic runtime.
 */

import { Engine } from "./engine/engine";
import { Renderer } from "./render/renderer";
import { MockCompiler } from "./ai/mockCompiler";
import { growAndSlow } from "./dsl/samples/growAndSlow";
import type { GameSpec } from "./dsl/types";

const gameCanvas = document.getElementById("game") as HTMLCanvasElement;
const hudCanvas = document.getElementById("hud") as HTMLCanvasElement;
const ideaInput = document.getElementById("idea-input") as HTMLInputElement;
const goButton = document.getElementById("idea-go") as HTMLButtonElement;

const compiler = new MockCompiler();

let engine: Engine | null = null;
let currentSpec: GameSpec = growAndSlow;

function load(spec: GameSpec): void {
  engine?.dispose();
  currentSpec = spec;
  engine = new Engine(spec);
  const renderer = new Renderer(gameCanvas, hudCanvas, engine.world);
  engine.attachInput(gameCanvas);
  engine.start((world) => renderer.draw(world));
}

async function generate(): Promise<void> {
  const idea = ideaInput.value.trim();
  goButton.disabled = true;
  goButton.textContent = "Compiling…";
  try {
    const spec = await compiler.compile({ idea });
    load(spec);
  } catch (err) {
    console.error(err);
    alert(`Could not compile that idea:\n${(err as Error).message}`);
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

load(growAndSlow);
