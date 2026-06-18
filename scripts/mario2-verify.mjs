import puppeteer from "puppeteer-core";
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const BASE = process.env.BASE || "http://127.0.0.1:4321";
const ID = process.env.ID || "super-mario-737074";
const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox"] });
const page = await browser.newPage();
const errors = []; page.on("pageerror", (e) => errors.push(String(e)));
await page.goto(`${BASE}/play/${ID}`, { waitUntil: "networkidle2" });
await new Promise((r) => setTimeout(r, 900)); // settle (gravity)

const start = await page.evaluate(() => { const w = window.gamepilot.world; return { W: w.width, H: w.height, viewW: w.viewW, ground: w.countOf("ground"), coins: w.countOf("coin"), goombas: w.countOf("goomba"), pipes: w.countOf("pipe"), castle: w.countOf("castle"), trees: w.countOf("tree"), player: w.countOf("player") }; });
const land = await page.evaluate(() => { const p = window.gamepilot.world.firstOf("player"); return { grounded: p.grounded, glyphLayers: p.parts?.length, vy: Math.round(p.vy) }; });
// stomp a goomba: drop the player on one from above
const stomp = await page.evaluate(async () => { const w = window.gamepilot.world; const before = w.countOf("goomba"), sc = w.score; const gb = w.entities.find(e => e.alive && e.type === "goomba"); const p = w.firstOf("player"); p.x = gb.x; p.y = gb.y - 24; p.vx = 0; p.vy = 320; await new Promise(r => setTimeout(r, 120)); return { killed: w.countOf("goomba") === before - 1, scored: w.score > sc, bounced: p.vy < 0 }; });
// camera scroll: move player far right
const cam = await page.evaluate(() => { const w = window.gamepilot.world; const p = w.firstOf("player"); p.x = 900; p.y = 380; w.updateCamera(); return Math.round(w.camX); });
// reach the castle -> win
const win = await page.evaluate(async () => { const w = window.gamepilot.world; const p = w.firstOf("player"); const c = w.firstOf("castle"); p.x = c.x; p.y = c.y; await new Promise(r => setTimeout(r, 100)); return w.status; });
await page.screenshot({ path: "scripts/shot-supermario.png" });
await browser.close();

console.log("no page errors:", errors.length === 0 ? "✓" : "✗ " + errors.join("; "));
console.log("level built (1664x512, scrolling; goombas/coins/pipes/castle/trees):",
  start.W === 1664 && start.viewW === 640 && start.goombas >= 5 && start.coins >= 8 && start.pipes === 2 && start.castle === 1 && start.trees === 2 && start.player === 1 ? "✓" : "✗", JSON.stringify(start));
console.log("Mario is a composed hero2 sprite, lands grounded:", land.glyphLayers === 4 && land.grounded ? "✓" : "✗", JSON.stringify(land));
console.log("stomp a goomba (kill + score + bounce):", stomp.killed && stomp.scored && stomp.bounced ? "✓" : "✗", JSON.stringify(stomp));
console.log("camera scrolls the wide level:", cam > 0 ? "✓" : "✗", `camX=${cam}`);
console.log("reaching the castle wins:", win === "won" ? "✓" : "✗", `status=${win}`);
const ok = errors.length === 0 && start.W === 1664 && start.castle === 1 && land.glyphLayers === 4 && stomp.killed && cam > 0 && win === "won";
console.log(ok ? "\nALL PASS ✓ (Super Mario with the new glyph lib)" : "\nFAILED ✗");
