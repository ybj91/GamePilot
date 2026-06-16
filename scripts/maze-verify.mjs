import puppeteer from "puppeteer-core";
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const URL = "http://localhost:4321/play/walled-arena-753ca7";
const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox"] });
const page = await browser.newPage();
await page.goto(URL, { waitUntil: "networkidle2" });
await new Promise((r) => setTimeout(r, 400));
await page.screenshot({ path: "scripts/shot-maze.png" });
const box = await page.$eval("#game", (el) => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
const px = () => page.evaluate(() => Math.round(window.gamepilot.world.firstOf("player").x));
console.log("player x at start:", await px(), "(wall column at x=258..342)");
// aim the mouse far to the RIGHT of the wall column (world ~720,300) and hold ~2.2s
const cx = box.x + (720 / 800) * box.w, cy = box.y + (300 / 600) * box.h;
for (let i = 0; i < 22; i++) { await page.mouse.move(cx, cy); await new Promise((r) => setTimeout(r, 100)); }
const finalX = await px();
console.log("player x after driving right into the wall:", finalX);
console.log(finalX < 250 ? "BLOCKED ✓ (stopped before the wall at 258)" : "PASSED THROUGH ✗");
await browser.close();
