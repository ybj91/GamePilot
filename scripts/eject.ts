/**
 * Eject a GameSpec to a standalone, self-contained HTML game (experiment).
 *
 *   npx tsx scripts/eject.ts [spec.json] [out.html]
 *
 * With no args it ejects the canonical growAndSlow sample to scripts/out-grow.html.
 * The output imports no shared engine — it's a one-way "source -> build artifact"
 * migration (see docs/compiler-eject.md). Reports cleanly if the game uses a
 * feature the PoC compiler can't emit yet (canCompile ledger).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { compileGameToHtml, canCompile, UnsupportedFeatureError } from "../src/export/compile";
import { growAndSlow } from "../src/dsl/samples/growAndSlow";
import type { GameSpec } from "../src/dsl/types";

const [specPath, outPath] = process.argv.slice(2);
const spec: GameSpec = specPath ? (JSON.parse(readFileSync(specPath, "utf8")) as GameSpec) : growAndSlow;
const out = outPath ?? "scripts/out-grow.html";

const cover = canCompile(spec);
if (!cover.ok) {
  console.error("Can't eject — unsupported features:\n - " + cover.unsupported.join("\n - "));
  console.error("\n(Fall back to the hosted /play/:id runtime for this game.)");
  process.exit(1);
}

try {
  const html = compileGameToHtml(spec);
  writeFileSync(out, html);
  console.log(`Ejected "${spec.meta?.title ?? "game"}" -> ${out}  (${html.length} bytes, no engine import)`);
} catch (e) {
  if (e instanceof UnsupportedFeatureError) console.error(e.message);
  else throw e;
}
