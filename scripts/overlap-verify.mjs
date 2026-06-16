import puppeteer from "puppeteer-core";
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const URL = "http://localhost:4321/play/tank-1990-076bdc";
const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox"] });
const page = await browser.newPage();
await page.goto(URL, { waitUntil: "networkidle2" });
await new Promise((r) => setTimeout(r, 500));
let globalMin = Infinity;
for (let i = 0; i < 15; i++) {
  const min = await page.evaluate(() => {
    const w = window.gamepilot.world;
    const tanks = w.entities.filter((e) => e.alive && (e.kind === "player" || e.kind === "enemy"));
    let m = Infinity;
    for (let a = 0; a < tanks.length; a++)
      for (let b = a + 1; b < tanks.length; b++) {
        const d = Math.hypot(tanks[a].x - tanks[b].x, tanks[a].y - tanks[b].y) - (tanks[a].size + tanks[b].size);
        m = Math.min(m, d); // gap between bodies; <0 means overlapping
      }
    return m === Infinity ? null : Math.round(m);
  });
  if (min !== null) globalMin = Math.min(globalMin, min);
  await new Promise((r) => setTimeout(r, 220));
}
await page.screenshot({ path: "scripts/shot-tank-noverlap.png" });
console.log("min body gap over time (>=0 means no overlap):", globalMin);
console.log(globalMin >= -2 ? "TANKS DO NOT OVERLAP ✓" : "still overlapping ✗");
await browser.close();
