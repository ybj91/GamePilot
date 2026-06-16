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
    const colorOf = (i: string) =>
      ({ green: "#5ad17a", purple: "#b07cff", red: "#ff5a5a", blue: "#4aa3ff",
         yellow: "#ffd23f", cyan: "#46e6d0", orange: "#ff9f43", pink: "#ff7ab8",
         white: "#f0f0f0" } as Record<string, string>)[
        ["green", "purple", "red", "blue", "yellow", "cyan", "orange", "pink", "white"].find((c) =>
          i.includes(c),
        ) ?? ""
      ];
    const bump = (n: number, dir: number, lo: number, hi: number) =>
      Math.max(lo, Math.min(hi, n + dir));

    if (player) {
      player.props ??= { speed: 240 };
      if (has(idea, "faster", "fast", "speedy", "quick")) player.props.speed = bump(player.props.speed ?? 240, 80, 60, 600);
      if (has(idea, "slower", "slow", "heavy")) player.props.speed = bump(player.props.speed ?? 240, -60, 60, 600);
      if (has(idea, "bigger", "larger", "huge")) player.size = bump(player.size, 6, 4, 60);
      if (has(idea, "smaller", "tiny")) player.size = bump(player.size, -4, 4, 60);
      if (has(idea, "arrow", "keyboard", "wasd")) player.control = "arrows";
      if (has(idea, "mouse", "pointer", "cursor")) player.control = "follow-pointer";
      const pc = colorOf(idea);
      if (pc && has(idea, "player", "me", "hero", "blob")) player.color = pc;
      else if (pc && !enemy) player.color = pc;
    }

    if (enemy) {
      enemy.props ??= { speed: 90 };
      if (has(idea, "no enemy", "no enemies", "peaceful", "relaxing")) {
        spec.entities = spec.entities.filter((e) => e.kind !== "enemy");
        spec.rules = spec.rules.filter(
          (r) => !(r.between?.includes("enemy") || r.effects.some((f) => f.target === "enemy")),
        );
      } else {
        if (has(idea, "many enemies", "more enemies", "swarm", "horde")) enemy.spawn.count = bump(enemy.spawn.count ?? 3, 3, 1, 20);
        if (has(idea, "fewer enemies", "less enemies")) enemy.spawn.count = bump(enemy.spawn.count ?? 3, -2, 0, 20);
        if (has(idea, "faster enem", "fast enem", "aggressive")) enemy.props.speed = bump(enemy.props.speed ?? 90, 40, 20, 260);
        if (has(idea, "slower enem", "slow enem")) enemy.props.speed = bump(enemy.props.speed ?? 90, -40, 0, 260);
        if (has(idea, "harder", "difficult")) { enemy.props.speed = bump(enemy.props.speed ?? 90, 30, 20, 260); enemy.spawn.count = bump(enemy.spawn.count ?? 3, 2, 1, 20); }
        if (has(idea, "easier", "chill")) { enemy.props.speed = bump(enemy.props.speed ?? 90, -30, 20, 260); enemy.spawn.count = bump(enemy.spawn.count ?? 3, -1, 1, 20); }
        if (has(idea, "flee", "run away", "scared")) enemy.behavior = "flee:player";
        if (has(idea, "chase", "hunt")) enemy.behavior = "chase:player";
      }
    }

    if (food) {
      if (has(idea, "lots of food", "more food", "abundant")) { food.spawn.count = 30; food.spawn.maintain = 30; }
      if (has(idea, "less food", "fewer food")) { food.spawn.count = bump(food.spawn.count ?? 12, -6, 1, 60); food.spawn.maintain = food.spawn.count; }
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
