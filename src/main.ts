/**
 * App entry — the management UI.
 *
 * A game stage (canvas + Pause/Replay/New controls) beside a conversation
 * panel. The chat is the AI seam: each message hits /api/chat, which compiles a
 * new game (or adjusts the current one) via the GameplayCompiler — the real
 * Claude compiler if the backend has a key, else the offline mock — and the
 * stage reloads with the result.
 *
 * On /play/:id the page loads that saved game and live-reloads when an external
 * agent edits it (so you can also drive everything from Claude Code via MCP).
 */

import { Engine } from "./engine/engine";
import { Renderer } from "./render/renderer";
import { growAndSlow } from "./dsl/samples/growAndSlow";
import type { GameSpec } from "./dsl/types";

const gameCanvas = document.getElementById("game") as HTMLCanvasElement;
const hudCanvas = document.getElementById("hud") as HTMLCanvasElement;
const statusEl = document.getElementById("status") as HTMLDivElement;
const chatLog = document.getElementById("chat-log") as HTMLDivElement;
const chatForm = document.getElementById("chat-form") as HTMLFormElement;
const chatText = document.getElementById("chat-text") as HTMLInputElement;
const chatSend = document.getElementById("chat-send") as HTMLButtonElement;
const pauseBtn = document.getElementById("btn-pause") as HTMLButtonElement;
const replayBtn = document.getElementById("btn-replay") as HTMLButtonElement;
const newBtn = document.getElementById("btn-new") as HTMLButtonElement;

let engine: Engine | null = null;
let currentSpec: GameSpec = growAndSlow;
let currentGameId: string | null = null;
let lastUpdatedAt = "";
let liveReloadTimer: number | undefined;

// --- stage -----------------------------------------------------------------

function setStatus(text: string, warn = false): void {
  statusEl.textContent = text;
  statusEl.classList.toggle("warn", warn);
}

function load(spec: GameSpec): void {
  engine?.dispose();
  currentSpec = spec;
  const e = new Engine(spec);
  engine = e;
  const renderer = new Renderer(gameCanvas, hudCanvas, e.world);
  e.attachInput(gameCanvas);
  e.start((world) => renderer.draw(world, e.isPaused));
  pauseBtn.textContent = "⏸ Pause";
  (window as unknown as { gamepilot?: Engine }).gamepilot = e;
}

// --- chat panel ------------------------------------------------------------

function addMsg(role: "user" | "assistant" | "system", text: string, err = false): HTMLDivElement {
  const el = document.createElement("div");
  el.className = `msg ${role}${err ? " err" : ""}`;
  el.textContent = text;
  chatLog.appendChild(el);
  chatLog.scrollTop = chatLog.scrollHeight;
  return el;
}

async function sendMessage(message: string): Promise<void> {
  addMsg("user", message);
  chatText.value = "";
  chatSend.disabled = true;
  const thinking = addMsg("assistant", "…");
  thinking.classList.add("typing");
  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message, gameId: currentGameId }),
    });
    const data = (await res.json()) as {
      reply: string;
      error?: boolean;
      game?: { id: string; spec: GameSpec; title?: string; updatedAt?: string };
    };
    thinking.remove();
    addMsg("assistant", data.reply ?? "(no response)", !!data.error);
    if (data.game) {
      currentGameId = data.game.id;
      lastUpdatedAt = data.game.updatedAt ?? "";
      load(data.game.spec);
      setStatus(`Playing "${data.game.title ?? data.game.id}"`);
    }
  } catch (err) {
    thinking.remove();
    addMsg("assistant", `Network error: ${(err as Error).message}`, true);
  } finally {
    chatSend.disabled = false;
    chatText.focus();
  }
}

chatForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const message = chatText.value.trim();
  if (message) sendMessage(message);
});

// --- controls --------------------------------------------------------------

pauseBtn.addEventListener("click", () => {
  if (!engine) return;
  const paused = engine.togglePause();
  pauseBtn.textContent = paused ? "▶ Resume" : "⏸ Pause";
});

replayBtn.addEventListener("click", () => load(currentSpec));

newBtn.addEventListener("click", () => {
  stopLiveReload();
  currentGameId = null;
  load(growAndSlow);
  chatLog.replaceChildren();
  setStatus("Fresh start — describe a game in the chat.");
  addMsg("system", "Started fresh. Describe a game to create, or tweak this sample.");
  chatText.focus();
});

window.addEventListener("keydown", (e) => {
  if ((e.key === "r" || e.key === "R") && (e.target as HTMLElement)?.tagName !== "INPUT") {
    load(currentSpec);
  }
});

// --- /play/:id live-reload (external agent edits) ---------------------------

function stopLiveReload(): void {
  if (liveReloadTimer) clearInterval(liveReloadTimer);
  liveReloadTimer = undefined;
}

async function fetchGame(id: string) {
  const res = await fetch(`/api/games/${id}`);
  if (!res.ok) throw new Error(`game "${id}" not found`);
  return (await res.json()) as { spec: GameSpec; title?: string; updatedAt?: string };
}

async function loadById(id: string): Promise<void> {
  setStatus(`Loading game ${id}…`);
  try {
    const game = await fetchGame(id);
    currentGameId = id;
    lastUpdatedAt = game.updatedAt ?? "";
    load(game.spec);
    setStatus(`Playing "${game.title ?? id}"`);
    addMsg("system", `Loaded "${game.title ?? id}". Ask for changes below.`);
    startLiveReload(id);
  } catch (err) {
    console.error(err);
    load(growAndSlow);
    setStatus(`Could not load ${id} — playing the sample instead.`, true);
  }
}

function startLiveReload(id: string): void {
  stopLiveReload();
  liveReloadTimer = window.setInterval(async () => {
    try {
      const game = await fetchGame(id);
      const stamp = game.updatedAt ?? "";
      if (stamp && stamp !== lastUpdatedAt) {
        lastUpdatedAt = stamp;
        load(game.spec);
        setStatus(`Updated "${game.title ?? id}" ✓ — reloaded live`);
      }
    } catch {
      /* keep playing what we have */
    }
  }, 1500);
}

// --- boot ------------------------------------------------------------------

const playMatch = location.pathname.match(/^\/play\/([A-Za-z0-9_-]+)/);
if (playMatch?.[1]) {
  loadById(playMatch[1]);
} else {
  load(growAndSlow);
  setStatus("Playing the sample. Chat to create or change a game.");
  addMsg("system", "Welcome! Describe a game (e.g. “a ship that shoots asteroids”), or ask to tweak this sample.");
}
