import puppeteer from "puppeteer-core";
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const BASE = process.env.BASE || "http://127.0.0.1:4321";
const ID = process.env.ID || "frogger-f8f66d";
const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox"] });
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
await page.goto(`${BASE}/play/${ID}`, { waitUntil: "networkidle2" });
await new Promise((r) => setTimeout(r, 400));

const start = await page.evaluate(() => ({ goal: window.gamepilot.world.countOf("goal"), frog: window.gamepilot.world.countOf("frog"), W: window.gamepilot.world.width, H: window.gamepilot.world.height }));

// let the interval spawners run -> traffic appears across the lanes
await new Promise((r) => setTimeout(r, 3200));
const traffic = await page.evaluate(() => {
  const w = window.gamepilot.world;
  let cars = 0; const lanes = new Set();
  for (const e of w.entities) if (e.alive && e.type.startsWith("car")) { cars++; lanes.add(e.type); }
  return { cars, lanes: lanes.size };
});

// get hit by a car -> lose a life and respawn at the start (bottom). Move the
// frog UP onto an existing lane car, so its respawn point (the bottom) is clear
// and only one hit registers.
const hit = await page.evaluate(async () => {
  const w = window.gamepilot.world;
  const frog = w.firstOf("frog");
  const lives = w.getVar("lives");
  const car = w.entities.find((e) => e.alive && e.type.startsWith("car"));
  frog.x = car.x; frog.y = car.y;
  await new Promise((r) => setTimeout(r, 150));
  const f2 = w.firstOf("frog");
  return { lostLife: w.getVar("lives") === lives - 1, respawned: !!f2 && Math.abs(f2.y - (w.height - 20)) < 4, playing: w.status === "playing" };
});

// reach the goal band -> win
const win = await page.evaluate(async () => {
  const w = window.gamepilot.world;
  const frog = w.firstOf("frog");
  const goal = w.entities.find((e) => e.alive && e.type === "goal");
  frog.x = goal.x; frog.y = goal.y;
  await new Promise((r) => setTimeout(r, 120));
  return { won: w.status === "won", score: w.score };
});

await page.screenshot({ path: "scripts/shot-frogger.png" });

console.log("no page errors:", errors.length === 0 ? "✓" : "✗ " + errors.join("; "));
console.log("tilemap goal band (15) + 1 frog, 600x600:", start.goal === 15 && start.frog === 1 && start.W === 600 && start.H === 600 ? "✓" : "✗", JSON.stringify(start));
console.log("interval spawners stream traffic across lanes:", traffic.cars > 0 && traffic.lanes >= 3 ? "✓" : "✗", JSON.stringify(traffic));
console.log("a car hit costs a life and respawns the frog at start:", hit.lostLife && hit.respawned && hit.playing ? "✓" : "✗", JSON.stringify(hit));
console.log("reaching the goal band wins + scores:", win.won && win.score > 0 ? "✓" : "✗", JSON.stringify(win));
const ok = errors.length === 0 && start.goal === 15 && start.frog === 1 && traffic.cars > 0 && traffic.lanes >= 3 && hit.lostLife && hit.respawned && win.won;
console.log(ok ? "\nALL PASS ✓ (Frogger archetype plays — no new engine code)" : "\nFAILED ✗");
await browser.close();
