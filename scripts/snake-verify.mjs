// Probe the Snake approximation and DEMONSTRATE the DSL edges it hits.
import puppeteer from "puppeteer-core";
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const BASE = process.env.BASE || "http://127.0.0.1:4321";
const ID = process.env.ID || "snake-edge-probe-1f1165";
const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox"] });
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
await page.goto(`${BASE}/play/${ID}`, { waitUntil: "networkidle2" });
await new Promise((r) => setTimeout(r, 300));

// drive the head right for ~1.5s -> a trail should form BEHIND it (to the left)
await page.keyboard.down("ArrowRight");
await new Promise((r) => setTimeout(r, 1500));
const trailing = await page.evaluate(() => {
  const w = window.gamepilot.world; const h = w.firstOf("head");
  const segs = w.entities.filter((e) => e.alive && e.type === "seg");
  const behind = segs.filter((s) => s.x < h.x).length;
  return { segCount: segs.length, behind, headMoving: Math.abs(h.vx) > 1 };
});

// WORKS visually? now show the edges:
// EDGE 1 — no auto-forward: release the key and the head STOPS dead.
await page.keyboard.up("ArrowRight");
await new Promise((r) => setTimeout(r, 200));
const stops = await page.evaluate(() => { const h = window.gamepilot.world.firstOf("head"); return { vx: Math.round(h.vx), vy: Math.round(h.vy) }; });

// EDGE 2 — no body growth: eat food, body length doesn't change.
const grow = await page.evaluate(async () => {
  const w = window.gamepilot.world; const h = w.firstOf("head");
  const lenBefore = w.entities.filter((e) => e.alive && e.type === "seg").length;
  const sc = w.score;
  const food = w.entities.find((e) => e.alive && e.type === "food"); h.x = food.x; h.y = food.y;
  await new Promise((r) => setTimeout(r, 600));
  const lenAfter = w.entities.filter((e) => e.alive && e.type === "seg").length;
  return { ate: w.score > sc, lenBefore, lenAfter };
});

// Self-collision DOES work: drop the head onto one of its own segments.
const selfHit = await page.evaluate(async () => {
  const w = window.gamepilot.world; const h = w.firstOf("head");
  const seg = w.entities.find((e) => e.alive && e.type === "seg");
  if (seg) { h.x = seg.x; h.y = seg.y; }
  await new Promise((r) => setTimeout(r, 100));
  return w.status;
});
await page.screenshot({ path: "scripts/shot-snake.png" });
await browser.close();

console.log("no page errors:", errors.length === 0 ? "✓" : "✗ " + errors.join("; "));
console.log("WORKS: a trail of body segments forms behind the head:", trailing.segCount > 5 && trailing.behind > 3 ? "✓" : "✗", JSON.stringify(trailing));
console.log("WORKS: running into your own trail ends the game:", selfHit === "lost" ? "✓" : "✗", `status=${selfHit}`);
console.log("EDGE 1 (no auto-forward): head STOPS on key release:", stops.vx === 0 && stops.vy === 0 ? "confirmed — real snake never stops" : "?", JSON.stringify(stops));
console.log("EDGE 2 (no body growth): eating does NOT lengthen the body:", grow.ate && Math.abs(grow.lenAfter - grow.lenBefore) <= 3 ? "confirmed — body length is fixed (ttl-bound)" : "?", JSON.stringify(grow));
