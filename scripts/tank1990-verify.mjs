// Verify Tank 1990 (v3, new glyph lib): the full FLEET is present (each enemy a
// different composed tank shape), the player drives the 4-layer hero tank, and
// SPACE fires the way you face (rotate-aim). Run the backend first (npm run serve).
import puppeteer from "puppeteer-core";
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const BASE = process.env.BASE || "http://127.0.0.1:4321";
const URL = `${BASE}/play/tank-1990-076bdc`;
const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox"] });
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
// the /play page polls updatedAt forever, so networkidle never settles — wait for
// the engine handle instead.
await page.goto(URL, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => window.gamepilot && window.gamepilot.world, { timeout: 8000 });
await new Promise((r) => setTimeout(r, 400));
await page.screenshot({ path: "scripts/shot-tank1990.png" });

const fleet = await page.evaluate(() => {
  const w = window.gamepilot.world;
  const layers = (id) => w.firstOf(id)?.parts?.[0]?.length ?? 0;
  const heroHasStar = !!w.firstOf("player")?.parts?.[0]?.some((l) => l.color === "#ffd23f");
  return {
    counts: { basic: w.countOf("basic"), fast: w.countOf("fast"), armor: w.countOf("armor"), arty: w.countOf("arty") },
    shapes: { player: layers("player"), basic: layers("basic"), fast: layers("fast"), armor: layers("armor"), arty: layers("arty") },
    heroHasStar,
    armorHp: w.firstOf("armor")?.props.hp,
  };
});

// facing fire: SPACE fires the way you face (aim:"forward" = heading * speed). A
// bullet can despawn a frame after spawning (it flew into a wall) faster than a
// poll-after-press can catch over IPC, so install a recorder that captures every
// bullet's velocity on its SPAWN frame; then set the heading per direction (what
// driving sets in-game) and fire.
await page.mouse.click(420, 300);
await page.evaluate(() => {
  window.__shots = [];
  const seen = new Set();
  const loop = () => {
    for (const e of window.gamepilot.world.entities)
      if (e.alive && e.type === "bullet" && !seen.has(e.iid)) { seen.add(e.iid); window.__shots.push({ vx: Math.round(e.vx), vy: Math.round(e.vy) }); }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
});
await page.keyboard.press("Space"); // warm-up: the first keypress after focus can be swallowed
await new Promise((r) => setTimeout(r, 140));
const fire = async (h, ok) => {
  const before = await page.evaluate(() => window.__shots.length);
  await page.evaluate((hd) => {
    const pl = window.gamepilot.world.firstOf("player");
    pl.x = 400; pl.y = 80; pl.vx = 0; pl.vy = 0; pl.hx = hd.x; pl.hy = hd.y; // clear top lane, faced hd
  }, h);
  await page.keyboard.press("Space");
  await new Promise((r) => setTimeout(r, 160));
  const fresh = await page.evaluate((b) => window.__shots.slice(b), before);
  const r = fresh.find(ok);
  return r ?? null;
};
const dirs = [
  ["RIGHT", { x: 1, y: 0 }, (v) => v.vx > 0 && v.vy === 0],
  ["LEFT", { x: -1, y: 0 }, (v) => v.vx < 0 && v.vy === 0],
  ["UP", { x: 0, y: -1 }, (v) => v.vy < 0 && v.vx === 0],
  ["DOWN", { x: 0, y: 1 }, (v) => v.vy > 0 && v.vx === 0],
];
const aim = {};
for (const [label, h, ok] of dirs) aim[label] = await fire(h, ok);

const fleetOk = fleet.counts.basic >= 1 && fleet.counts.fast >= 1 && fleet.counts.armor >= 1 && fleet.counts.arty >= 1;
// every tank is a multi-colour composed sprite (recolourable hull + >=1 tread/detail
// layer), and the hero carries its gold-star accent.
const shapesOk = [fleet.shapes.player, fleet.shapes.basic, fleet.shapes.fast, fleet.shapes.armor, fleet.shapes.arty].every((n) => n >= 2) && fleet.heroHasStar;
const aimOk = ["RIGHT", "LEFT", "UP", "DOWN"].every((d) => aim[d]);
console.log("no page errors:", errors.length === 0 ? "✓" : "✗ " + errors.join("; "));
console.log("fleet present (4 enemy types):", fleetOk ? "✓" : "✗", JSON.stringify(fleet.counts));
console.log("each tank is a composed sprite (>=2 layers) + hero has a star:", shapesOk ? "✓" : "✗", JSON.stringify(fleet.shapes), "star=" + fleet.heroHasStar);
console.log("space fires the way you face (all 4 dirs):", aimOk ? "✓" : "✗", JSON.stringify(aim));
console.log(errors.length === 0 && fleetOk && shapesOk && aimOk ? "\nALL PASS ✓ (Tank 1990)" : "\nFAILED ✗");
await browser.close();
