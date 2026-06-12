import { defineConfig, loadEnv, type PluginOption } from "vite";
import type { IncomingMessage } from "node:http";

/**
 * Dev-only API plugin: exposes POST /api/compile so the browser can ask Claude
 * to compile an idea into a GameSpec without ever seeing the API key. The key
 * is read from the environment (.env / .env.local / shell) and stays in this
 * Node process; the real compiler is loaded on demand via ssrLoadModule so the
 * Anthropic SDK never ends up in the client bundle.
 */
function gamepilotApi(env: Record<string, string>): PluginOption {
  const apiKey = env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY || "";

  return {
    name: "gamepilot-api",
    configureServer(server) {
      server.middlewares.use("/api/compile", (req, res) => {
        const json = (code: number, body: unknown) => {
          res.statusCode = code;
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify(body));
        };

        if (req.method !== "POST") {
          json(405, { error: "Method Not Allowed" });
          return;
        }
        if (!apiKey) {
          // Signal the client to fall back to the offline mock compiler.
          json(503, { error: "ANTHROPIC_API_KEY is not set on the server." });
          return;
        }

        void (async () => {
          try {
            const body = await readJsonBody(req);
            const mod = await server.ssrLoadModule("/src/ai/anthropicCompiler.ts");
            const compiler = mod.createAnthropicCompiler(apiKey);
            const spec = await compiler.compile({ idea: String(body.idea ?? "") });
            json(200, spec);
          } catch (err) {
            server.config.logger.error(`[gamepilot-api] ${(err as Error).stack ?? err}`);
            json(500, { error: (err as Error).message });
          }
        })();
      });
    },
  };
}

async function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
}

export default defineConfig(({ mode }) => {
  // Load all env vars (no VITE_ prefix filter) for the server side only.
  const env = loadEnv(mode, process.cwd(), "");
  return {
    root: ".",
    plugins: [gamepilotApi(env)],
    build: {
      target: "es2022",
      outDir: "dist",
    },
  };
});
