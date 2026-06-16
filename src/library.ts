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
const importBtn = document.getElementById("import") as HTMLButtonElement;
const importFile = document.getElementById("import-file") as HTMLInputElement;

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
      <a class="btn dl" href="/api/games/${encodeURIComponent(g.id)}/download" title="Download GameSpec (DSL) as JSON" download>⬇</a>
      <button class="btn danger" title="Delete">🗑</button>
    </div>`;
  (card.querySelector(".card-body") as HTMLElement).addEventListener("click", () => {
    location.href = `/play/${encodeURIComponent(g.id)}`;
  });
  (card.querySelector("a.dl") as HTMLAnchorElement).addEventListener("click", (e) => {
    e.stopPropagation(); // don't navigate the card; let the link download
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

// Import an (edited) GameSpec .json -> validate + create -> open it. This is the
// other half of download: hand-edit the DSL, then load it back, no AI needed.
importBtn.addEventListener("click", () => importFile.click());
importFile.addEventListener("change", async () => {
  const file = importFile.files?.[0];
  importFile.value = "";
  if (!file) return;
  let spec: { meta?: { idea?: string } };
  try {
    spec = JSON.parse(await file.text());
  } catch (e) {
    alert(`That's not valid JSON:\n${(e as Error).message}`);
    return;
  }
  const res = await fetch("/api/games", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ spec, idea: spec?.meta?.idea }),
  });
  const data = (await res.json()) as { id?: string; error?: string; errors?: string[] };
  if (!res.ok) {
    alert(`Couldn't import that GameSpec:\n- ${data.errors?.join("\n- ") ?? data.error ?? res.statusText}`);
    return;
  }
  location.href = `/play/${data.id}`;
});

load();
