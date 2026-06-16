import puppeteer from "puppeteer-core";
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const BASE = "http://localhost:4321";

// A survivable shooter-test: one STATIONARY enemy to the right, no death rule.
const spec = {
  meta: { title: "Shooter Verify" },
  world: { width: 800, height: 600, background: "#0b0b12", edges: "wall" },
  entities: [
    { id: "player", kind: "player", shape: "circle", color: "#4aa3ff", size: 14,
      control: "arrows", spawn: { x: 400, y: 300 }, props: { speed: 240 } },
    { id: "bullet", kind: "obstacle", shape: "dot", color: "#9ad8ff", size: 5,
      control: "none", spawn: { count: 0 }, props: { speed: 600, ttl: 1.5 } },
    { id: "enemy", kind: "enemy", shape: "square", color: "#ff4d4d", size: 16,
      control: "none", spawn: { x: 620, y: 300, count: 1 }, props: { speed: 0 } },
  ],
  rules: [
    { on: "input", key: "pointer", effects: [{ op: "spawn", target: "bullet", from: "player", aim: "pointer" }] },
    { on: "collision", between: ["bullet", "enemy"], effects: [{ op: "destroy", target: "self" }, { op: "destroy", target: "other" }, { op: "score", value: 1 }] },
  ],
};
const created = await (await fetch(`${BASE}/api/games`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ spec }) })).json();
const id = created.id;

const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox"] });
const page = await browser.newPage();
await page.goto(`${BASE}/play/${id}`, { waitUntil: "networkidle2" });
await new Promise((r) => setTimeout(r, 400));
const read = () => page.evaluate(() => {
  const w = window.gamepilot?.world; const p = w?.firstOf("player"); const e = w?.firstOf("enemy");
  return { px: p?.x, status: w?.status, bullets: w?.countOf("bullet"), enemies: w?.countOf("enemy"), score: w?.score, ex: e?.x, ey: e?.y };
});

// movement: hold 'd' -> player x increases
const a = await read();
await page.keyboard.down("d"); await new Promise((r) => setTimeout(r, 250)); await page.keyboard.up("d");
const b = await read();
console.log("MOVE  x", Math.round(a.px), "->", Math.round(b.px), "moved:", b.px > a.px + 5);

// shoot: click toward the enemy's world position -> bullet flies right and kills it
const box = await page.$eval("#game", (el) => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
const clientX = box.x + (b.ex / 800) * box.w;
const clientY = box.y + (b.ey / 600) * box.h;
await page.mouse.move(clientX, clientY);            // aim
await page.mouse.click(clientX, clientY);           // fire
await new Promise((r) => setTimeout(r, 80));
const justFired = await read();
await page.screenshot({ path: "scripts/shot-shooter.png" });
await new Promise((r) => setTimeout(r, 700));        // let the bullet reach the enemy
const after = await read();
console.log("SHOOT bullets right after click:", justFired.bullets, "| enemies before:", justFired.enemies);
console.log("HIT   enemies:", justFired.enemies, "->", after.enemies, "| score:", after.score, "| status:", after.status);
await browser.close();
