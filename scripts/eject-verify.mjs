/**
 * Verify an ejected standalone game actually plays offline (file://) with the
 * right semantics — the feasibility proof for the compiler experiment.
 *   npx tsx scripts/eject.ts && node scripts/eject-verify.mjs
 */
import puppeteer from "puppeteer-core";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const FILE = process.env.FILE || "scripts/out-grow.html";
const url = pathToFileURL(resolve(FILE)).href;
const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox"] });
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
await page.goto(url, { waitUntil: "load" });
await new Promise((r) => setTimeout(r, 400));

const start = await page.evaluate(() => ({ player: window.game.count("player"), food: window.game.count("food"), enemy: window.game.count("enemy") }));
await page.evaluate(() => { const g = window.game.ents(); const p = g.find((e) => e.type === "player"); const f = g.find((e) => e.type === "food"); p.x = f.x; p.y = f.y; });
await new Promise((r) => setTimeout(r, 120));
const afterEat = await page.evaluate(() => ({ score: window.game.score, psize: window.game.ents().find((e) => e.type === "player").props.size }));
await page.evaluate(() => { const g = window.game.ents(); const p = g.find((e) => e.type === "player"); const en = g.find((e) => e.type === "enemy"); p.x = en.x; p.y = en.y; });
await new Promise((r) => setTimeout(r, 120));
const afterHit = await page.evaluate(() => window.game.status);
await page.screenshot({ path: "scripts/shot-eject.png" });

console.log("no page errors:", errors.length === 0 ? "✓" : "✗ " + errors.join("; "));
console.log("populated (1 player, 18 food, 3 enemy):", start.player === 1 && start.food === 18 && start.enemy === 3 ? "✓" : "✗", JSON.stringify(start));
console.log("eating food scored + grew the player:", afterEat.score > 0 && afterEat.psize > 14 ? "✓" : "✗", JSON.stringify(afterEat));
console.log("touching an enemy = game over:", afterHit === "lost" ? "✓" : "✗", afterHit);
const ok = errors.length === 0 && start.player === 1 && start.food === 18 && start.enemy === 3 && afterEat.score > 0 && afterEat.psize > 14 && afterHit === "lost";
console.log(ok ? "\nALL PASS ✓ (standalone compiled game plays offline, no engine)" : "\nFAILED ✗");
await browser.close();
process.exit(ok ? 0 : 1);
