import puppeteer from "puppeteer-core";
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const BASE = process.env.BASE || "http://127.0.0.1:4321";
const ID = process.env.ID || "mario-lite-11be42";
const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox"] });
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
await page.goto(`${BASE}/play/${ID}`, { waitUntil: "networkidle2" });
await new Promise((r) => setTimeout(r, 1000)); // let everything fall + settle

// goombas placed, animated, and patrolling
const patrol = await page.evaluate(async () => {
  const w = window.gamepilot.world;
  const g = w.entities.find((e) => e.alive && e.type === "goomba");
  const frames = g ? g.frames.length : 0;
  const xs = [];
  for (let i = 0; i < 20; i++) { xs.push(w.entities.find((e) => e.alive && e.iid === g.iid)?.x ?? null); await new Promise((r) => setTimeout(r, 40)); }
  const moved = Math.abs((xs[xs.length - 1] ?? 0) - (xs[0] ?? 0));
  return { count: w.countOf("goomba"), frames, grounded: g.grounded, moved: Math.round(moved) };
});

// STOMP: drop the player onto a goomba from above (falling) -> kill + score + bounce
const stomp = await page.evaluate(async () => {
  const w = window.gamepilot.world;
  const before = w.countOf("goomba"), sc = w.score;
  const g = w.entities.find((e) => e.alive && e.type === "goomba");
  const p = w.firstOf("player");
  p.x = g.x; p.y = g.y - 22; p.vx = 0; p.vy = 320; // just above, falling
  await new Promise((r) => setTimeout(r, 120));
  return { killed: w.countOf("goomba") === before - 1, scored: w.score > sc, bouncedUp: p.vy < 0, playing: w.status === "playing" };
});

// SIDE HIT: walk into a goomba at the same level (not falling) -> game over
const sideHit = await page.evaluate(async () => {
  const w = window.gamepilot.world;
  const g = w.entities.find((e) => e.alive && e.type === "goomba");
  const p = w.firstOf("player");
  p.x = g.x - 18; p.y = g.y; p.vx = 100; p.vy = 0; // beside it, walking in, not falling
  await new Promise((r) => setTimeout(r, 150));
  return w.status;
});
await page.screenshot({ path: "scripts/shot-goomba.png" });
await browser.close();

console.log("no page errors:", errors.length === 0 ? "✓" : "✗ " + errors.join("; "));
console.log("goombas placed, animated, grounded, patrolling:",
  patrol.count >= 2 && patrol.frames >= 2 && patrol.grounded && patrol.moved > 2 ? "✓" : "✗", JSON.stringify(patrol));
console.log("STOMP from above kills the goomba, scores, bounces the player up:",
  stomp.killed && stomp.scored && stomp.bouncedUp && stomp.playing ? "✓" : "✗", JSON.stringify(stomp));
console.log("side hit (not falling) = game over:", sideHit === "lost" ? "✓" : "✗", `status=${sideHit}`);
const ok = errors.length === 0 && patrol.count >= 2 && patrol.frames >= 2 && patrol.moved > 2 && stomp.killed && stomp.scored && stomp.bouncedUp && sideHit === "lost";
console.log(ok ? "\nALL PASS ✓ (Goombas: walk + animate + stomp + side-hit)" : "\nFAILED ✗");
