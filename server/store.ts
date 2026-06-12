/**
 * File-based GameSpec store.
 *
 * Persists each game as a JSON file under data/games/<id>.json. Deliberately
 * tiny and dependency-free (just node:fs) so it can be shared verbatim by the
 * HTTP backend and the MCP server. Every save runs validateGameSpec — the store
 * is a write-side guard at the seam, same contract as everywhere else.
 *
 * The id-generation and timestamps use node:crypto / Date here on purpose: this
 * is server code, not the deterministic engine (which avoids them by design).
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { GameSpec } from "../src/dsl/types";
import { validateGameSpec } from "../src/dsl/validate";

const DATA_DIR = path.resolve(process.cwd(), "data", "games");

export interface StoredGame {
  id: string;
  title: string;
  idea?: string;
  createdAt: string;
  spec: GameSpec;
}

export type GameSummary = Omit<StoredGame, "spec">;

export class InvalidSpecError extends Error {
  constructor(public readonly errors: string[]) {
    super(`Invalid GameSpec:\n- ${errors.join("\n- ")}`);
    this.name = "InvalidSpecError";
  }
}

function slugify(s: string): string {
  const base = s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
  return base || "game";
}

async function ensureDir(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

function fileFor(id: string): string {
  // Guard against path traversal — ids are slugs we generate, but never trust.
  const safe = id.replace(/[^a-z0-9-]/gi, "");
  return path.join(DATA_DIR, `${safe}.json`);
}

/**
 * Validate and persist a spec. Throws InvalidSpecError if it doesn't pass the
 * DSL validator. Returns the stored record (with its generated id).
 */
export async function saveGame(
  spec: GameSpec,
  opts: { idea?: string } = {},
): Promise<StoredGame> {
  const result = validateGameSpec(spec);
  if (!result.ok) throw new InvalidSpecError(result.errors);

  await ensureDir();
  const title = spec.meta?.title ?? "Untitled";
  const id = `${slugify(title)}-${randomUUID().slice(0, 6)}`;
  const game: StoredGame = {
    id,
    title,
    idea: opts.idea ?? spec.meta?.idea,
    createdAt: new Date().toISOString(),
    spec,
  };
  await fs.writeFile(fileFor(id), JSON.stringify(game, null, 2), "utf8");
  return game;
}

export async function getGame(id: string): Promise<StoredGame | null> {
  try {
    const raw = await fs.readFile(fileFor(id), "utf8");
    return JSON.parse(raw) as StoredGame;
  } catch {
    return null;
  }
}

export async function listGames(): Promise<GameSummary[]> {
  await ensureDir();
  const files = await fs.readdir(DATA_DIR);
  const games: GameSummary[] = [];
  for (const f of files) {
    if (!f.endsWith(".json")) continue;
    try {
      const raw = await fs.readFile(path.join(DATA_DIR, f), "utf8");
      const { id, title, idea, createdAt } = JSON.parse(raw) as StoredGame;
      games.push({ id, title, idea, createdAt });
    } catch {
      // Skip unreadable/corrupt files rather than failing the whole list.
    }
  }
  return games.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function deleteGame(id: string): Promise<boolean> {
  try {
    await fs.unlink(fileFor(id));
    return true;
  } catch {
    return false;
  }
}
