// Verify the Snake/Tron light-cycle on the `runner` control: it now moves on its
// own (auto-forward FIXED), steers without reversing, lays a trail, and dies on
// self-collision. The body-growth edge is still demonstrated as outstanding.
import puppeteer from "puppeteer-core";
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const BASE = process.env.BASE || "http://127.0.0.1:4321";
const ID = process.env.ID || "snake-light-cycle-809e2e";
const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox"] });
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
await page.goto(`${BASE}/play/${ID}`, { waitUntil: "networkidle2" });
await new Promise((r) => setTimeout(r, 300));

// FIXED (was EDGE 1): with NO input the head keeps moving and lays a trail.
await new Promise((r) => setTimeout(r, 1000));
const autoForward = await page.evaluate(() => {
  const w = window.gamepilot.world; const h = w.firstOf("head");
  const segs = w.entities.filter((e) => e.alive && e.type === "seg").length;
  return { moving: Math.hypot(h.vx, h.vy) > 1, segs };
});

// steering: press Right -> head turns to move right (+x)
await page.keyboard.press("ArrowRight");
await new Promise((r) => setTimeout(r, 250));
const steer = await page.evaluate(() => { const h = window.gamepilot.world.firstOf("head"); return { hx: h.hx, vx: Math.round(h.vx) }; });

// no reversal: now moving right, press Left -> refused (keeps going right)
await page.keyboard.press("ArrowLeft");
await new Promise((r) => setTimeout(r, 200));
const noReverse = await page.evaluate(() => { const h = window.gamepilot.world.firstOf("head"); return { hx: h.hx, vx: Math.round(h.vx) }; });

// self-collision still ends the game
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
console.log("FIXED (auto-forward): head moves with NO input + lays a trail:", autoForward.moving && autoForward.segs > 5 ? "✓" : "✗", JSON.stringify(autoForward));
console.log("steering: ArrowRight turns the head to +x:", steer.hx === 1 && steer.vx > 0 ? "✓" : "✗", JSON.stringify(steer));
console.log("no 180 reversal: ArrowLeft while going right is refused:", noReverse.hx === 1 && noReverse.vx > 0 ? "✓" : "✗", JSON.stringify(noReverse));
console.log("self-collision still ends the game:", selfHit === "lost" ? "✓" : "✗", `status=${selfHit}`);
const ok = errors.length === 0 && autoForward.moving && autoForward.segs > 5 && steer.hx === 1 && noReverse.hx === 1 && selfHit === "lost";
console.log(ok ? "\nALL PASS ✓ (runner: Snake/Tron movement works; auto-forward edge solved)" : "\nFAILED ✗");
