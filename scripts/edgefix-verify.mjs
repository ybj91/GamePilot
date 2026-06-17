// Confirms the boundary fix in a real game: a Frogger car driven into the far
// wall now DESPAWNS (flies off) instead of clamping + lingering ("stuck then
// vanish"), while the player still clamps.
import puppeteer from "puppeteer-core";
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const BASE = process.env.BASE || "http://127.0.0.1:4321";
const ID = process.env.ID || "frogger-f8f66d";
const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox"] });
const page = await browser.newPage();
await page.goto(`${BASE}/play/${ID}`, { waitUntil: "networkidle2" });
await new Promise((r) => setTimeout(r, 500));

const car = await page.evaluate(async () => {
  const w = window.gamepilot.world;
  const c = w.spawn("car0"); c.x = w.width - c.size - 2; c.y = 220; c.vx = 200; c.vy = 0; // moving INTO the right wall
  const id = c.iid;
  for (let i = 0; i < 30; i++) { await new Promise((r) => setTimeout(r, 16)); if (!w.entities.some((e) => e.iid === id && e.alive)) return { despawned: true }; }
  const still = w.entities.find((e) => e.iid === id);
  return { despawned: !still || !still.alive, x: still ? Math.round(still.x) : null };
});
const frog = await page.evaluate(async () => {
  const w = window.gamepilot.world; const f = w.firstOf("frog");
  f.x = w.width - 2; // shove the frog past the right edge
  await new Promise((r) => setTimeout(r, 80));
  const f2 = w.firstOf("frog");
  return { clamped: !!f2 && f2.x <= w.width - f2.size + 0.5, alive: !!f2 };
});
await browser.close();
console.log("projectile (car) despawns at the wall, no pile-up:", car.despawned ? "✓" : "✗", JSON.stringify(car));
console.log("player (frog) still clamps at the wall (doesn't vanish):", frog.clamped && frog.alive ? "✓" : "✗", JSON.stringify(frog));
console.log(car.despawned && frog.clamped ? "\nFIX CONFIRMED ✓" : "\nFAILED ✗");
