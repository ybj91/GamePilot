/**
 * Claude-backed GameplayCompiler (server-side only).
 *
 * This is the real implementation of the AI seam: idea -> GameSpec via the
 * Anthropic API. It runs in the Node process (the Vite dev middleware loads it
 * with ssrLoadModule), so the API key never reaches the browser. The browser
 * talks to it over POST /api/compile (see vite.config.ts + httpCompiler.ts).
 *
 * Contract: whatever the model returns must pass `validateGameSpec`. We give it
 * the DSL in the system prompt, parse the JSON it returns, validate, and retry
 * once with the errors if it's wrong — keeping validate.ts as the single guard
 * at the untrusted-output seam.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { GameSpec } from "../dsl/types";
import type { CompileRequest, GameplayCompiler } from "./compiler";
import { validateGameSpec } from "../dsl/validate";
import { SYSTEM_PROMPT, buildUserPrompt, buildRepairPrompt } from "./buildPrompt";

const MODEL = "claude-opus-4-8";

/** Pull the text out of a Messages response (ignores thinking blocks). */
function textOf(message: Anthropic.Message): string {
  return message.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
}

/** Extract a JSON object from model text, tolerating ```json fences. */
function extractJson(text: string): unknown {
  let s = text.trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) s = fence[1].trim();
  else {
    // Fall back to the outermost {...} span.
    const start = s.indexOf("{");
    const end = s.lastIndexOf("}");
    if (start !== -1 && end > start) s = s.slice(start, end + 1);
  }
  return JSON.parse(s);
}

class AnthropicCompiler implements GameplayCompiler {
  readonly name = "claude";
  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async compile(req: CompileRequest): Promise<GameSpec> {
    const messages: Anthropic.MessageParam[] = [
      { role: "user", content: buildUserPrompt(req.idea, req.base) },
    ];

    // One initial attempt + one repair attempt.
    for (let attempt = 0; attempt < 2; attempt++) {
      const message = await this.client.messages.create({
        model: MODEL,
        max_tokens: 16000,
        thinking: { type: "adaptive" },
        system: SYSTEM_PROMPT,
        messages,
      });

      const raw = textOf(message);
      let spec: GameSpec;
      try {
        spec = extractJson(raw) as GameSpec;
      } catch (e) {
        // Couldn't even parse JSON — feed it back as a validation-style error.
        if (attempt === 1) {
          throw new Error(`Claude did not return valid JSON: ${(e as Error).message}`);
        }
        messages.push({ role: "assistant", content: raw });
        messages.push({
          role: "user",
          content: buildRepairPrompt(raw, ["response was not valid JSON"]),
        });
        continue;
      }

      const result = validateGameSpec(spec);
      if (result.ok) {
        spec.meta = { ...spec.meta, idea: req.idea || spec.meta?.idea };
        return spec;
      }

      if (attempt === 1) {
        throw new Error(`Claude produced an invalid GameSpec:\n- ${result.errors.join("\n- ")}`);
      }
      // Ask the model to fix exactly what failed.
      messages.push({ role: "assistant", content: raw });
      messages.push({ role: "user", content: buildRepairPrompt(raw, result.errors) });
    }

    // Unreachable: the loop returns or throws on attempt 1.
    throw new Error("Claude compile failed");
  }
}

/** Factory used by the Vite middleware (keeps construction off the import path). */
export function createAnthropicCompiler(apiKey: string): GameplayCompiler {
  return new AnthropicCompiler(apiKey);
}
