import puppeteer from "puppeteer-core";
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox"] });
const page = await browser.newPage();
await page.goto("http://localhost:4321/play/tank-1990-076bdc", { waitUntil: "networkidle2" });
await new Promise((r) => setTimeout(r, 600));

const read = () => page.evaluate(() => {
  const w = window.gamepilot.world, p = w.firstOf("player");
  return { speed: Math.round(p.speed), power: w.getVar("power"), bolt: !!w.firstOf("bolt"), star: !!w.firstOf("star") };
});
const teleportOnto = (item) => page.evaluate((item) => {
  const w = window.gamepilot.world, p = w.firstOf("player"), it = w.firstOf(item);
  if (it) { p.x = it.x; p.y = it.y; }
  return !!it;
}, item);

console.log("start:", JSON.stringify(await read()));
await teleportOnto("bolt");
await new Promise((r) => setTimeout(r, 250));
console.log("after eating BOLT:", JSON.stringify(await read()), "(speed should rise)");
await teleportOnto("star");
await new Promise((r) => setTimeout(r, 250));
console.log("after eating STAR:", JSON.stringify(await read()), "(power should be 1)");
await page.screenshot({ path: "scripts/shot-powerups.png" });
await browser.close();
