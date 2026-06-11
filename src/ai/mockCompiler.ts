/**
 * Mock gameplay compiler.
 *
 * Stands in for a real LLM so v0 runs with no API key or network. It does crude
 * keyword matching over the idea to tweak a base spec -- just enough to make the
 * "type an idea -> play it" loop feel real and to prove the seam. When we plug
 * in an LLM, it implements the same GameplayCompiler interface and this file
 * stays as the offline fallback / test double.
 */

import type { GameSpec } from "../dsl/types";
import type { CompileRequest, GameplayCompiler } from "./compiler";
import { growAndSlow } from "../dsl/samples/growAndSlow";
import { validateGameSpec } from "../dsl/validate";

// Structured-clone the base so each compile returns an independent spec.
function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

function has(idea: string, ...words: string[]): boolean {
  const s = idea.toLowerCase();
  return words.some((w) => s.includes(w));
}

export class MockCompiler implements GameplayCompiler {
  readonly name = "mock";

  async compile(req: CompileRequest): Promise<GameSpec> {
    const idea = req.idea.trim();
    const spec = clone(req.base ?? growAndSlow);
    spec.meta = { ...spec.meta, idea: idea || spec.meta?.idea, title: titleFrom(idea) };

    const player = spec.entities.find((e) => e.kind === "player");
    const enemy = spec.entities.find((e) => e.kind === "enemy");
    const food = spec.entities.find((e) => e.kind === "food");

    // --- crude "understanding" of the idea, mapped onto DSL knobs ---
    if (player) {
      if (has(idea, "fast", "speedy", "quick")) player.props!.speed = 360;
      if (has(idea, "slow", "heavy")) player.props!.speed = 180;
      if (has(idea, "arrow", "keyboard", "wasd")) player.control = "arrows";
      if (has(idea, "green")) player.color = "#5ad17a";
      if (has(idea, "purple")) player.color = "#b07cff";
    }

    if (enemy) {
      if (has(idea, "no enemy", "no enemies", "peaceful", "relaxing")) {
        spec.entities = spec.entities.filter((e) => e.kind !== "enemy");
        spec.rules = spec.rules.filter(
          (r) => !(r.between?.includes("enemy") || r.effects.some((f) => f.target === "enemy")),
        );
      } else {
        if (has(idea, "many enemies", "swarm", "horde")) enemy.spawn.count = 8;
        if (has(idea, "fast enemy", "fast enemies", "aggressive")) enemy.props!.speed = 150;
        if (has(idea, "flee", "run away", "scared")) enemy.behavior = "flee:player";
      }
    }

    if (food && has(idea, "lots of food", "abundant")) {
      food.spawn.count = 30;
      food.spawn.maintain = 30;
    }

    // Simulate model latency so the UI's loading state is exercised.
    await new Promise((r) => setTimeout(r, 250));

    const result = validateGameSpec(spec);
    if (!result.ok) {
      throw new Error(`Mock produced an invalid spec:\n- ${result.errors.join("\n- ")}`);
    }
    return spec;
  }
}

function titleFrom(idea: string): string {
  if (!idea) return "Grow & Slow";
  const words = idea.split(/\s+/).slice(0, 4).join(" ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}
