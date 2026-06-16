import puppeteer from "puppeteer-core";
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const URL = "http://localhost:4321/play/tank-1990-076bdc";
const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox"], defaultViewport: { width: 900, height: 760 } });
const page = await browser.newPage();
await page.goto(URL, { waitUntil: "networkidle2" });
await new Promise((r) => setTimeout(r, 400));
// drive the player right so its tank points right
await page.keyboard.down("d"); await new Promise((r) => setTimeout(r, 450)); await page.keyboard.up("d");
await new Promise((r) => setTimeout(r, 150));
const h = await page.evaluate(() => { const p = window.gamepilot.world.firstOf("player"); return { hx: p.hx, hy: p.hy }; });
console.log("player heading after driving right:", JSON.stringify(h), "(expect hx=1,hy=0 -> glyph points right)");
await page.screenshot({ path: "scripts/shot-glyph.png" });
await browser.close();
