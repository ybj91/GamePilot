// Verify the full Snake loop: runner auto-forward + steering (no reversal), the
// body GROWS as you eat (ttlFrom:"length"), and self-collision ends the game.
import puppeteer from "puppeteer-core";
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const BASE = process.env.BASE || "http://127.0.0.1:4321";
const ID = process.env.ID || "snake-d9ae58";
const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox"] });
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
await page.goto(`${BASE}/play/${ID}`, { waitUntil: "networkidle2" });
await new Promise((r) => setTimeout(r, 300));

await new Promise((r) => setTimeout(r, 800));
const autoForward = await page.evaluate(() => {
  const w = window.gamepilot.world; const h = w.firstOf("head");
  return { moving: Math.hypot(h.vx, h.vy) > 1, segs: w.entities.filter((e) => e.alive && e.type === "seg").length };
});

await page.keyboard.press("ArrowRight");
await new Promise((r) => setTimeout(r, 200));
const steer = await page.evaluate(() => { const h = window.gamepilot.world.firstOf("head"); return { hx: h.hx, vx: Math.round(h.vx) }; });
await page.keyboard.press("ArrowLeft");
await new Promise((r) => setTimeout(r, 150));
const noReverse = await page.evaluate(() => window.gamepilot.world.firstOf("head").hx);

// GROWTH: eat several dots, then let the trail reach its new length.
const grow = await page.evaluate(async () => {
  const w = window.gamepilot.world;
  const segBefore = w.entities.filter((e) => e.alive && e.type === "seg").length;
  const lenBefore = w.getVar("length");
  for (let k = 0; k < 6 && w.status === "playing"; k++) {
    const h = w.firstOf("head"); const f = w.entities.find((e) => e.alive && e.type === "food");
    if (h && f) { h.x = f.x; h.y = f.y; }
    await new Promise((r) => setTimeout(r, 130));
  }
  await new Promise((r) => setTimeout(r, 1600)); // body grows smoothly to new length
  return { lenBefore, lenAfter: Math.round(w.getVar("length") * 100) / 100, segBefore, segAfter: w.entities.filter((e) => e.alive && e.type === "seg").length, status: w.status };
});

// self-collision still ends the game
const selfHit = await page.evaluate(async () => {
  const w = window.gamepilot.world; const h = w.firstOf("head");
  const seg = w.entities.find((e) => e.alive && e.type === "seg"); if (seg) { h.x = seg.x; h.y = seg.y; }
  await new Promise((r) => setTimeout(r, 100));
  return w.status;
});
await page.screenshot({ path: "scripts/shot-snake.png" });
await browser.close();

console.log("no page errors:", errors.length === 0 ? "✓" : "✗ " + errors.join("; "));
console.log("runner auto-forward + trail:", autoForward.moving && autoForward.segs > 4 ? "✓" : "✗", JSON.stringify(autoForward));
console.log("tap-steering + no reversal:", steer.hx === 1 && noReverse === 1 ? "✓" : "✗", `steer=${JSON.stringify(steer)} afterLeft.hx=${noReverse}`);
console.log("eating GROWS the body (length up + more segments):",
  grow.lenAfter > grow.lenBefore && grow.segAfter > grow.segBefore + 3 ? "✓" : "✗", JSON.stringify(grow));
console.log("self-collision ends the game:", selfHit === "lost" ? "✓" : "✗", `status=${selfHit}`);
const ok = errors.length === 0 && autoForward.moving && steer.hx === 1 && noReverse === 1 && grow.lenAfter > grow.lenBefore && grow.segAfter > grow.segBefore + 3 && selfHit === "lost";
console.log(ok ? "\nALL PASS ✓ (full Snake: runner + growth + self-collision)" : "\nFAILED ✗");
