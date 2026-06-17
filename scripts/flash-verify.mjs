import puppeteer from "puppeteer-core";
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const BASE = process.env.BASE || "http://127.0.0.1:4321";
const ID = process.env.ID || "flash-range-2fe3ef";
const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox"] });
const page = await browser.newPage();
await page.goto(`${BASE}/play/${ID}`, { waitUntil: "networkidle2" });
await new Promise((r) => setTimeout(r, 400));
// (no canvas click — it would fire a pointer-bullet; keys are listened on window.)

// Park an armored enemy just above the tank (faces up) and fire forward.
await page.evaluate(() => {
  const w = window.gamepilot.world;
  const p = w.firstOf("player");
  const e = w.firstOf("enemy");
  e.x = p.x; e.y = p.y - 70; e.vx = 0; e.vy = 0; e.behavior = undefined; // hold still
});
const hpBefore = await page.evaluate(() => window.gamepilot.world.firstOf("enemy").props.hp);
await page.keyboard.press("Space");

// Sample the enemy: catch the flash going positive on the hit, confirm it
// survives with hp-1, then watch the flash decay back to zero.
let flashed = false, peakFlash = 0, hpAfter = hpBefore, stillAlive = false, decayed = false;
for (let i = 0; i < 30; i++) {
  const s = await page.evaluate(() => {
    const e = window.gamepilot.world.firstOf("enemy");
    return e ? { flash: e.flash, hp: e.props.hp, alive: e.alive } : null;
  });
  if (!s) break;
  if (s.flash > 0) { flashed = true; peakFlash = Math.max(peakFlash, s.flash); hpAfter = s.hp; stillAlive = s.alive; }
  if (flashed && s.flash === 0) { decayed = true; hpAfter = s.hp; stillAlive = s.alive; break; }
  await new Promise((r) => setTimeout(r, 40));
}
await page.screenshot({ path: "scripts/shot-flash.png" });

const survived = hpAfter === hpBefore - 1 && stillAlive;
console.log("hp:", hpBefore, "->", hpAfter, "(survivable hit)", survived ? "✓" : "✗");
console.log("enemy flashed on the hit:", flashed ? "✓" : "✗", `(peak ${Math.round(peakFlash * 1000)}ms)`);
console.log("flash decayed back to zero (entity still alive):", decayed && stillAlive ? "✓" : "✗");
console.log(survived && flashed && decayed && stillAlive ? "\nALL PASS ✓" : "\nFAILED ✗");
await browser.close();
