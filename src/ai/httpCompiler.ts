/**
 * Browser-side GameplayCompiler that calls the dev server's /api/compile
 * endpoint (which runs the real Claude compiler). This keeps the API key out
 * of the client entirely. The returned spec is validated here too — defense in
 * depth at the seam, and it lets the caller fall back to the mock on failure.
 */

import type { GameSpec } from "../dsl/types";
import type { CompileRequest, GameplayCompiler } from "./compiler";
import { validateGameSpec } from "../dsl/validate";

/** Thrown when the server has no API key configured (HTTP 503). */
export class CompilerUnavailableError extends Error {}

export class HttpCompiler implements GameplayCompiler {
  readonly name = "claude";

  async compile(req: CompileRequest): Promise<GameSpec> {
    const res = await fetch("/api/compile", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ idea: req.idea }),
    });

    if (res.status === 503) {
      const { error } = await res.json().catch(() => ({ error: "compiler unavailable" }));
      throw new CompilerUnavailableError(error);
    }
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(error);
    }

    const spec = (await res.json()) as GameSpec;
    const result = validateGameSpec(spec);
    if (!result.ok) {
      throw new Error(`Server returned an invalid GameSpec:\n- ${result.errors.join("\n- ")}`);
    }
    return spec;
  }
}
