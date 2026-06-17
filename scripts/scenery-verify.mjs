import puppeteer from "puppeteer-core";
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox"] });
const page = await browser.newPage();
await page.goto("http://127.0.0.1:4321/play/scenery-d25730", { waitUntil: "networkidle2" });
await new Promise((r) => setTimeout(r, 400));
const info = await page.evaluate(() => {
  const w = window.gamepilot.world;
  const sz = (t) => w.firstOf(t)?.size;
  return { flower: sz("flower"), bush: sz("bush"), tree: sz("tree"), house: sz("house"), mountain: sz("mountain"), stones: w.countOf("stone") };
});
await page.screenshot({ path: "scripts/shot-scenery.png" });
await browser.close();
console.log(JSON.stringify(info));
const ordered = info.flower < info.bush && info.bush < info.tree && info.tree < info.house && info.house < info.mountain;
console.log("sizes increase flower<bush<tree<house<mountain:", ordered ? "✓" : "✗");
console.log("castle composed of multiple stone tiles:", info.stones > 10 ? "✓" : "✗", `(${info.stones} stones)`);
