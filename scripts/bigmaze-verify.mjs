import puppeteer from "puppeteer-core";
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const BASE = process.env.BASE || "http://127.0.0.1:4321";
const ID = process.env.ID || "big-maze-c52387";
const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox"] });
const page = await browser.newPage();
await page.goto(`${BASE}/play/${ID}`, { waitUntil: "networkidle2" });
await new Promise((r) => setTimeout(r, 400));

const snap = () => page.evaluate(() => {
  const w = window.gamepilot.world;
  return {
    width: w.width, height: w.height, viewW: w.viewW, viewH: w.viewH,
    camX: Math.round(w.camX), camY: Math.round(w.camY),
    walls: w.countOf("wall"), players: w.countOf("player"),
    px: Math.round(w.firstOf("player").x), py: Math.round(w.firstOf("player").y),
  };
});

const before = await snap();
console.log("world:", before.width + "x" + before.height, "viewport:", before.viewW + "x" + before.viewH);
console.log("walls:", before.walls, "players:", before.players);
console.log("camera at start:", before.camX, before.camY, "player:", before.px, before.py);

// Drive right along the open top corridor (y=60) for ~4s; the camera, which
// starts clamped at the origin, should scroll once the player passes viewW/2.
const canvas = await page.$("#game");
await canvas.click(); // focus for key input
await page.keyboard.down("ArrowRight");
for (let i = 0; i < 40; i++) await new Promise((r) => setTimeout(r, 100));
await page.keyboard.up("ArrowRight");
await new Promise((r) => setTimeout(r, 200));

const after = await snap();
console.log("camera after driving:", after.camX, after.camY, "player:", after.px, after.py);
await page.screenshot({ path: "scripts/shot-bigmaze.png" });

const sizeOk = before.width === 960 && before.height === 720 && before.viewW === 640 && before.viewH === 480;
const wallsOk = before.walls > 80 && before.players === 1;
const scrolled = after.camX > before.camX || after.camY > before.camY;
console.log("\nworld sized from grid (960x720, view 640x480):", sizeOk ? "✓" : "✗");
console.log("map expanded into walls (>80) + single player:", wallsOk ? "✓" : "✗");
console.log("camera scrolled to follow the player:", scrolled ? "✓" : "✗", `(camX ${before.camX}->${after.camX}, camY ${before.camY}->${after.camY})`);
console.log(sizeOk && wallsOk && scrolled ? "\nALL PASS ✓" : "\nFAILED ✗");
await browser.close();
