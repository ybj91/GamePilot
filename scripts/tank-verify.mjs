import puppeteer from "puppeteer-core";
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const URL = "http://localhost:4321/play/tank-battle-3e3646";
const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox"], defaultViewport: { width: 1100, height: 760 } });
const page = await browser.newPage();
const errs = [];
page.on("pageerror", (e) => errs.push(e.message));
await page.goto(URL, { waitUntil: "networkidle2" });
await new Promise((r) => setTimeout(r, 500));
await page.screenshot({ path: "scripts/shot-tank.png" });

const snap = () => page.evaluate(() => {
  const w = window.gamepilot?.world;
  const en = w?.entities?.find((e) => e.alive && e.type === "enemy");
  return { score: w?.score, lives: w?.getVar("lives"), enemies: w?.countOf("enemy"),
           bullets: w?.countOf("bullet"), status: w?.status, ex: en?.x, ey: en?.y };
});
const box = await page.$eval("#game", (el) => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });

console.log("start:", JSON.stringify(await snap()));

// fire at enemy tanks a few times (aim at a live enemy each shot)
let killedAny = false;
for (let i = 0; i < 10; i++) {
  const s = await snap();
  if (s.status !== "playing") break;
  if (s.ex != null) {
    const cx = box.x + (s.ex / 800) * box.w;
    const cy = box.y + (s.ey / 600) * box.h;
    await page.mouse.move(cx, cy);
    await page.mouse.click(cx, cy);
  }
  await new Promise((r) => setTimeout(r, 250));
  const after = await snap();
  if (after.score > s.score) killedAny = true;
}
const final = await snap();
console.log("final:", JSON.stringify(final), "| killed an enemy by shooting:", killedAny);
console.log("pageerrors:", errs.length ? errs.join("; ") : "none");
await browser.close();
