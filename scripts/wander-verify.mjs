import puppeteer from "puppeteer-core";
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const URL = "http://localhost:4321/play/tank-1990-076bdc";
const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox"] });
const page = await browser.newPage();
await page.goto(URL, { waitUntil: "networkidle2" });
await new Promise((r) => setTimeout(r, 500));
// sample one enemy's distance-to-player + its movement direction over ~3.5s
const samples = [];
for (let i = 0; i < 12; i++) {
  samples.push(await page.evaluate(() => {
    const w = window.gamepilot.world;
    const p = w.firstOf("player");
    const e = w.entities.find((x) => x.alive && x.type === "basic");
    if (!e) return null;
    return { dist: Math.round(Math.hypot(e.x - p.x, e.y - p.y)), dir: `${Math.sign(Math.round(e.vx))},${Math.sign(Math.round(e.vy))}` };
  }));
  await new Promise((r) => setTimeout(r, 300));
}
await page.screenshot({ path: "scripts/shot-tank-wander.png" });
const valid = samples.filter(Boolean);
const dists = valid.map((s) => s.dist);
const dirs = new Set(valid.map((s) => s.dir));
const up = dists.some((d, i) => i && d > dists[i - 1]); // distance to player sometimes INCREASES => not beelining
const down = dists.some((d, i) => i && d < dists[i - 1]);
console.log("enemy distance-to-player samples:", dists.join(" "));
console.log("distinct move directions:", [...dirs].join(" | "));
console.log("roaming (distance both rises & falls, multiple directions):", up && down && dirs.size >= 2);
await browser.close();
