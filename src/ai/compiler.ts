/**
 * The AI seam.
 *
 * GamePilot's thesis is that the AI is a *gameplay compiler*: natural language
 * in, a validated GameSpec out -- never engine code. Everything downstream of
 * this interface (engine, renderer) is deterministic and AI-agnostic, so we can
 * swap a mock for a real LLM (or a local model, or a server proxy) without
 * touching the runtime.
 *
 * Contract:
 *  - input:  a free-text idea + the DSL the model must emit.
 *  - output: a GameSpec that passes validateGameSpec(), or a thrown error.
 */

import type { GameSpec } from "../dsl/types";

export interface CompileRequest {
  idea: string;
  /** Optional seed spec to mutate ("make the enemies faster"), for later. */
  base?: GameSpec;
}

export interface GameplayCompiler {
  readonly name: string;
  compile(req: CompileRequest): Promise<GameSpec>;
}
