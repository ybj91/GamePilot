import puppeteer from "puppeteer-core";
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const URL = "http://localhost:4321/play/three-lives-0650b0";
const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox"] });
const page = await browser.newPage();
await page.goto(URL, { waitUntil: "networkidle2" });
await new Promise((r) => setTimeout(r, 500));
const read = () => page.evaluate(() => ({ lives: window.gamepilot?.world?.getVar("lives"), status: window.gamepilot?.world?.status }));
const start = await read();
console.log("start:", JSON.stringify(start));
await page.screenshot({ path: "scripts/shot-lives.png" });   // HUD shows "Lives 3"
// let the chasers hit the stationary player; sample lives over a few seconds
const seen = new Set([start.lives]);
let final = start;
for (let i = 0; i < 16; i++) {
  await new Promise((r) => setTimeout(r, 600));
  final = await read();
  seen.add(final.lives);
  if (final.status !== "playing") break;
}
console.log("lives observed:", [...seen].join(" -> "), "| final status:", final.status);
await browser.close();
