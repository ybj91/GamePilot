import puppeteer from "puppeteer-core";
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const BASE = process.env.BASE || "http://127.0.0.1:4321";
const ID = process.env.ID || "breakout-fb317a";
const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox"] });
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
await page.goto(`${BASE}/play/${ID}`, { waitUntil: "networkidle2" });
await new Promise((r) => setTimeout(r, 400));

const W = () => page.evaluate(() => window.gamepilot.world);
const start = await page.evaluate(() => ({ brick: window.gamepilot.world.countOf("brick"), paddle: window.gamepilot.world.countOf("paddle"), dead: window.gamepilot.world.countOf("deadzone"), ball: window.gamepilot.world.countOf("ball") }));

// launch the ball with a real click on the canvas (fires the on:input pointer rule)
const box = await page.$eval("#game", (el) => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
await page.mouse.click(box.x + box.w / 2, box.y + box.h * 0.8);
await new Promise((r) => setTimeout(r, 150));
const launched = await page.evaluate(() => { const b = window.gamepilot.world.firstOf("ball"); return b ? { n: window.gamepilot.world.countOf("ball"), vy: b.vy } : { n: 0, vy: 0 }; });

// wall bounce: park the ball at the right wall moving right -> vx must flip negative
const wallBounce = await page.evaluate(async () => {
  const w = window.gamepilot.world; const b = w.firstOf("ball");
  b.x = w.width - b.size - 1; b.y = 300; b.vx = 300; b.vy = 0;
  await new Promise((r) => setTimeout(r, 120));
  return { vx: b.vx, inside: b.x <= w.width - b.size };
});

// brick break: drop the ball onto a brick moving up -> bounce (vy flips down), brick gone, score+1
const brickHit = await page.evaluate(async () => {
  const w = window.gamepilot.world; const b = w.firstOf("ball");
  // bottom-most brick, so approaching from below only overlaps this one
  const br = w.entities.filter((e) => e.alive && e.type === "brick").reduce((a, c) => (c.y > a.y ? c : a));
  const before = w.countOf("brick"), sc = w.score;
  b.x = br.x; b.y = br.y + br.size + b.size - 1; b.vx = 0; b.vy = -260; // just below, moving up into it
  await new Promise((r) => setTimeout(r, 120));
  return { vyFlipped: b.vy > 0, broke: w.countOf("brick") === before - 1, scored: w.score === sc + 1, alive: b.alive };
});

// miss: drop the ball onto the bottom deadzone -> ball gone, a life lost
const miss = await page.evaluate(async () => {
  const w = window.gamepilot.world;
  let b = w.firstOf("ball"); if (!b) b = w.spawn("ball");
  const lives = w.getVar("lives");
  const dz = w.entities.find((e) => e.type === "deadzone");
  b.x = dz.x; b.y = dz.y; b.vx = 0; b.vy = 120;
  await new Promise((r) => setTimeout(r, 150));
  return { ballGone: w.countOf("ball") === 0, lostLife: w.getVar("lives") === lives - 1 };
});

await page.screenshot({ path: "scripts/shot-breakout.png" });

console.log("no page errors:", errors.length === 0 ? "✓" : "✗ " + errors.join("; "));
console.log("tilemap built bricks + deadzone (100 bricks, 20 deadzone, 1 paddle):", start.brick === 100 && start.dead === 20 && start.paddle === 1 && start.ball === 0 ? "✓" : "✗", JSON.stringify(start));
console.log("click launches the ball upward:", launched.n === 1 && launched.vy < 0 ? "✓" : "✗", JSON.stringify(launched));
console.log("ball bounces off the side wall (vx flips):", wallBounce.vx < 0 && wallBounce.inside ? "✓" : "✗", JSON.stringify(wallBounce));
console.log("ball bounces off a brick, breaks it, scores:", brickHit.vyFlipped && brickHit.broke && brickHit.scored && brickHit.alive ? "✓" : "✗", JSON.stringify(brickHit));
console.log("a missed ball hits the deadzone and costs a life:", miss.ballGone && miss.lostLife ? "✓" : "✗", JSON.stringify(miss));
const ok = errors.length === 0 && start.brick === 100 && start.dead === 20 && launched.n === 1 && launched.vy < 0 && wallBounce.vx < 0 && brickHit.vyFlipped && brickHit.broke && brickHit.scored && miss.ballGone && miss.lostLife;
console.log(ok ? "\nALL PASS ✓ (Breakout archetype plays)" : "\nFAILED ✗");
await browser.close();
