import puppeteer from "puppeteer-core";
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const BASE = process.env.BASE || "http://127.0.0.1:4321";
const ID = process.env.ID || "mario-lite-1db968";
const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox"] });
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
await page.goto(`${BASE}/play/${ID}`, { waitUntil: "networkidle2" });
await new Promise((r) => setTimeout(r, 300));

const start = await page.evaluate(() => { const w = window.gamepilot.world; return { W: w.width, H: w.height, viewW: w.viewW, ground: w.countOf("ground"), coins: w.countOf("coin"), player: w.countOf("player") }; });

// fall + land: after a moment under gravity the player rests on the ground (grounded, vy~0)
await new Promise((r) => setTimeout(r, 900));
const land = await page.evaluate(() => { const p = window.gamepilot.world.firstOf("player"); return { grounded: p.grounded, vy: Math.round(p.vy), y: Math.round(p.y) }; });

// jump: a tap of Up launches the grounded player upward (vy < 0)
await page.keyboard.down("ArrowUp");
await new Promise((r) => setTimeout(r, 70));
const jump = await page.evaluate(() => Math.round(window.gamepilot.world.firstOf("player").vy));
await page.keyboard.up("ArrowUp");
await new Promise((r) => setTimeout(r, 500));

// run + collect a coin: hold Right briefly (stay before the first pit at col 13)
const sc0 = await page.evaluate(() => window.gamepilot.world.score);
await page.keyboard.down("ArrowRight");
await new Promise((r) => setTimeout(r, 700));
await page.keyboard.up("ArrowRight");
const run = await page.evaluate(() => { const p = window.gamepilot.world.firstOf("player"); return { movedRight: p.x > 80, score: window.gamepilot.world.score }; });

// camera follows: drop the player mid-level (on ground) -> camX scrolls > 0
const cam = await page.evaluate(() => { const w = window.gamepilot.world; const p = w.firstOf("player"); p.x = 640; p.y = 339; p.vx = p.vy = 0; w.updateCamera(); return Math.round(w.camX); });

// pit / fall death: drop the player onto the bottom deadzone -> gameover
const pit = await page.evaluate(async () => { const w = window.gamepilot.world; const p = w.firstOf("player"); const d = w.entities.find((e) => e.alive && e.type === "deadzone"); p.x = d.x; p.y = d.y; await new Promise((r) => setTimeout(r, 100)); return w.status; });

await page.screenshot({ path: "scripts/shot-mario.png" });

// reload fresh, then reach the flag -> win
await page.goto(`${BASE}/play/${ID}`, { waitUntil: "networkidle2" });
await new Promise((r) => setTimeout(r, 500));
const winStatus = await page.evaluate(async () => { const w = window.gamepilot.world; const p = w.firstOf("player"); const g = w.entities.find((e) => e.alive && e.type === "goal"); p.x = g.x; p.y = g.y; await new Promise((r) => setTimeout(r, 100)); return w.status; });
await browser.close();

console.log("no page errors:", errors.length === 0 ? "✓" : "✗ " + errors.join("; "));
console.log("level built from tilemap (1280x448, viewport 640, ground+coins+player):",
  start.W === 1280 && start.H === 448 && start.viewW === 640 && start.ground > 20 && start.coins >= 6 && start.player === 1 ? "✓" : "✗", JSON.stringify(start));
console.log("gravity: player falls and LANDS on the ground (grounded, fall stopped):", land.grounded && Math.abs(land.vy) < 2 ? "✓" : "✗", JSON.stringify(land));
console.log("grounded JUMP launches upward (vy < 0):", jump < 0 ? "✓" : "✗", `vy=${jump}`);
console.log("run + collect a coin (moved right, score up):", run.movedRight && run.score > sc0 ? "✓" : "✗", JSON.stringify(run));
console.log("camera scrolls to follow the player:", cam > 0 ? "✓" : "✗", `camX=${cam}`);
console.log("falling into a pit (deadzone) = game over:", pit === "lost" ? "✓" : "✗", `status=${pit}`);
console.log("reaching the flag = win:", winStatus === "won" ? "✓" : "✗", `status=${winStatus}`);
const ok = errors.length === 0 && start.ground > 20 && land.grounded && jump < 0 && run.score > sc0 && cam > 0 && pit === "lost" && winStatus === "won";
console.log(ok ? "\nALL PASS ✓ (platformer cluster: gravity + jump + platforms + scroll = Mario-lite)" : "\nFAILED ✗");
