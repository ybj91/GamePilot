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
await page.goto(URL, { waitUntil: "networkidle2" });
await new Promise((r) => setTimeout(r, 500));
await page.screenshot({ path: "scripts/shot-tank1990.png" });

const fleet = await page.evaluate(() => {
  const w = window.gamepilot.world;
  const layers = (id) => w.firstOf(id)?.parts?.[0]?.length ?? 0;
  return {
    counts: { basic: w.countOf("basic"), fast: w.countOf("fast"), armor: w.countOf("armor"), arty: w.countOf("arty") },
    shapes: { player: layers("player"), basic: layers("basic"), fast: layers("fast"), armor: layers("armor"), arty: layers("arty") },
    armorHp: w.firstOf("armor")?.props.hp,
  };
});

// facing fire: establish focus, then fire in each direction and read the newest
// player bullet's velocity sign. (A bullet may despawn at once if it spawns into a
// wall/brick — so we retry a couple of times per direction.)
await page.mouse.click(420, 300);
const fireOnce = async (key) => {
  await page.keyboard.down(key); await new Promise((r) => setTimeout(r, 340)); await page.keyboard.up(key);
  await page.keyboard.press("Space");
  // capture the bullet the INSTANT it spawns (it may despawn a frame later if it
  // spawned into a brick/wall — so poll every animation frame, don't wait).
  return page.evaluate(() => new Promise((resolve) => {
    let n = 0;
    const tick = () => {
      const x = window.gamepilot.world.entities.filter((e) => e.alive && e.type === "bullet").sort((a, c) => c.iid - a.iid)[0];
      if (x) return resolve({ vx: Math.round(x.vx), vy: Math.round(x.vy) });
      if (++n > 12) return resolve(null);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }));
};
const fire = async (key, ok) => { for (let i = 0; i < 3; i++) { const r = await fireOnce(key); if (r && ok(r)) return r; } return null; };
const dirs = [["d", "RIGHT", (v) => v.vx > 0], ["a", "LEFT", (v) => v.vx < 0], ["w", "UP", (v) => v.vy < 0], ["s", "DOWN", (v) => v.vy > 0]];
const aim = {};
for (const [k, label, ok] of dirs) aim[label] = await fire(k, ok);

const fleetOk = fleet.counts.basic >= 1 && fleet.counts.fast >= 1 && fleet.counts.armor >= 1 && fleet.counts.arty >= 1;
const shapesOk = fleet.shapes.player === 4 && [fleet.shapes.basic, fleet.shapes.fast, fleet.shapes.armor, fleet.shapes.arty].every((n) => n >= 3);
const aimOk = ["RIGHT", "LEFT", "UP", "DOWN"].every((d) => aim[d]);
console.log("no page errors:", errors.length === 0 ? "✓" : "✗ " + errors.join("; "));
console.log("fleet present (4 enemy types):", fleetOk ? "✓" : "✗", JSON.stringify(fleet.counts));
console.log("each tank is a composed shape (player=4 layers, enemies>=3):", shapesOk ? "✓" : "✗", JSON.stringify(fleet.shapes));
console.log("space fires the way you face (all 4 dirs):", aimOk ? "✓" : "✗", JSON.stringify(aim));
console.log(errors.length === 0 && fleetOk && shapesOk && aimOk ? "\nALL PASS ✓ (Tank 1990)" : "\nFAILED ✗");
await browser.close();
