/**
 * Prompt construction for the Claude-backed gameplay compiler.
 *
 * GamePilot's thesis: the AI's only job is `idea -> GameSpec` (data, never
 * code). So the system prompt's whole purpose is to teach the model the DSL
 * precisely enough that it emits valid JSON our `validateGameSpec` accepts. We
 * keep the contract description here (mirroring src/dsl/types.ts) and use the
 * canonical sample as a one-shot example.
 */

import { DSL_REFERENCE, exampleSpecJson } from "../dsl/reference";
import { growAndSlow } from "../dsl/samples/growAndSlow";

export const SYSTEM_PROMPT = `You are GamePilot's gameplay compiler. You turn a short natural-language game idea into a GameSpec. Output ONLY the JSON object — no markdown fences, no commentary.

${DSL_REFERENCE}

Here is a complete, valid example for the idea "${growAndSlow.meta?.idea}":

${exampleSpecJson()}`;

export function buildUserPrompt(idea: string, base?: unknown): string {
  const trimmed = idea.trim();
  // Adjustment turn: edit an existing game rather than creating from scratch.
  if (base) {
    return `Here is the current game as a GameSpec. Apply the requested change and return the FULL updated GameSpec JSON only — keep everything else the same.\n\nCurrent game:\n${JSON.stringify(base, null, 2)}\n\nChange: ${trimmed || "make it more fun"}`;
  }
  if (!trimmed) {
    return "Compile a fun, simple game of your choice. Return only the GameSpec JSON.";
  }
  return `Compile this game idea into a GameSpec. Return only the JSON.\n\nIdea: ${trimmed}`;
}

/** Build a follow-up message that asks the model to fix validation errors. */
export function buildRepairPrompt(badJson: string, errors: string[]): string {
  return `That GameSpec failed validation:\n- ${errors.join(
    "\n- ",
  )}\n\nReturn a corrected GameSpec as JSON only (no prose). Here is what you returned:\n${badJson}`;
}
