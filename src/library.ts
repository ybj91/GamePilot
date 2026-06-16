/**
 * The games library page (/games): lists every saved game from the backend as
 * a card grid. Clicking a card opens its play/edit view (/play/:id); each card
 * can also be deleted. Plain DOM, no framework.
 */

interface GameSummary {
  id: string;
  title: string;
  idea?: string;
  createdAt: string;
  updatedAt?: string;
}

const grid = document.getElementById("library") as HTMLDivElement;
const countEl = document.getElementById("count") as HTMLSpanElement;
const refreshBtn = document.getElementById("refresh") as HTMLButtonElement;

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

async function fetchGames(): Promise<GameSummary[]> {
  const res = await fetch("/api/games");
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return ((await res.json()) as { games: GameSummary[] }).games;
}

async function deleteGame(id: string): Promise<void> {
  await fetch(`/api/games/${id}`, { method: "DELETE" });
}

function renderCard(g: GameSummary): HTMLDivElement {
  const card = document.createElement("div");
  card.className = "card";
  card.innerHTML = `
    <div class="card-body">
      <div class="card-title">${escapeHtml(g.title || g.id)}</div>
      <div class="card-idea">${escapeHtml(g.idea ?? "")}</div>
      <div class="card-date">${fmtDate(g.updatedAt ?? g.createdAt)}</div>
    </div>
    <div class="card-actions">
      <a class="btn primary play" href="/play/${encodeURIComponent(g.id)}">▶ Play / Edit</a>
      <button class="btn danger" title="Delete">🗑</button>
    </div>`;
  (card.querySelector(".card-body") as HTMLElement).addEventListener("click", () => {
    location.href = `/play/${encodeURIComponent(g.id)}`;
  });
  (card.querySelector("button.danger") as HTMLButtonElement).addEventListener("click", async (e) => {
    e.stopPropagation();
    if (!confirm(`Delete "${g.title || g.id}"? This can't be undone.`)) return;
    await deleteGame(g.id);
    load();
  });
  return card;
}

async function load(): Promise<void> {
  try {
    const games = await fetchGames();
    countEl.textContent = `${games.length} game${games.length === 1 ? "" : "s"}`;
    grid.replaceChildren();
    if (!games.length) {
      grid.innerHTML = `<div class="empty">No games yet. <a href="/">Create one →</a></div>`;
      return;
    }
    for (const g of games) grid.appendChild(renderCard(g));
  } catch {
    countEl.textContent = "";
    grid.innerHTML = `<div class="empty">Couldn't load games — is the backend running (<code>npm start</code>)?</div>`;
  }
}

refreshBtn.addEventListener("click", load);
load();
