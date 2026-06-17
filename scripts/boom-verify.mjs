import puppeteer from "puppeteer-core";
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const BASE = process.env.BASE || "http://127.0.0.1:4321";
const ID = process.env.ID || "boom-range-19f1c1";
const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox"] });
const page = await browser.newPage();
await page.goto(`${BASE}/play/${ID}`, { waitUntil: "networkidle2" });
await new Promise((r) => setTimeout(r, 400));
await (await page.$("#game")).click(); // focus for keys

// Line an invader up right above the tank (which faces up by default) and fire
// forward, so a bullet kills it deterministically and spawns the explosion.
await page.evaluate(() => {
  const w = window.gamepilot.world;
  const p = w.firstOf("player");
  const inv = w.firstOf("invader");
  inv.x = p.x; inv.y = p.y - 70; inv.vx = 0; inv.vy = 0;
});
const scoreBefore = await page.evaluate(() => window.gamepilot.world.score);
await page.keyboard.press("Space");

// Sample the world ~every 50ms: catch the boom, track its computed frame index
// (same formula as the renderer) across its ttl, and confirm it despawns.
const frameIdx = `(e)=>{const n=e.frames?e.frames.length:0; if(n<=1)return 0; if(e.loop){return Math.floor(0)%n;} const t=e.ttl0>0?1-(e.props.ttl??0)/e.ttl0:0; return Math.min(n-1,Math.max(0,Math.floor(t*n)));}`;
const seenIdx = new Set();
let everSawBoom = false, boomFrames = 0, despawned = false, scoreAfter = scoreBefore;
for (let i = 0; i < 24; i++) {
  const s = await page.evaluate((fi) => {
    const w = window.gamepilot.world;
    const f = eval("(" + fi + ")");
    const b = w.firstOf("boom");
    return { boom: w.countOf("boom"), score: w.score, idx: b ? f(b) : null, frames: b ? b.frames.length : 0, loop: b ? b.loop : null, ttl: b ? Math.round((b.props.ttl ?? 0) * 1000) : null };
  }, frameIdx);
  scoreAfter = s.score;
  if (s.boom > 0) { everSawBoom = true; boomFrames = s.frames; if (s.idx !== null) seenIdx.add(s.idx); }
  if (everSawBoom && s.boom === 0) { despawned = true; break; }
  await new Promise((r) => setTimeout(r, 50));
}
await page.screenshot({ path: "scripts/shot-boom.png" });

const killed = scoreAfter > scoreBefore;
const oneShot = boomFrames >= 4;
const progressed = seenIdx.size >= 2;           // showed more than one frame as it played
console.log("score:", scoreBefore, "->", scoreAfter, "(kill spawned the boom)", killed ? "✓" : "✗");
console.log("explosion appeared, one-shot multi-frame (>=4):", everSawBoom && oneShot ? "✓" : "✗", `(frames=${boomFrames})`);
console.log("explosion advanced through frames:", progressed ? "✓" : "✗", `(indices seen: ${[...seenIdx].sort().join(",")})`);
console.log("explosion auto-despawned via ttl:", despawned ? "✓" : "✗");
console.log(killed && everSawBoom && oneShot && progressed && despawned ? "\nALL PASS ✓" : "\nFAILED ✗");
await browser.close();
