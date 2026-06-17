import puppeteer from "puppeteer-core";
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const BASE = process.env.BASE || "http://127.0.0.1:4321";
const ID = process.env.ID || "glyph-zoo-c35da9";
const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox"] });
const page = await browser.newPage();
await page.goto(`${BASE}/play/${ID}`, { waitUntil: "networkidle2" });
await new Promise((r) => setTimeout(r, 400));

// Replicate the renderer's deterministic frame-index formula from sim time.
const probe = () => page.evaluate(() => {
  const w = window.gamepilot.world;
  const frameIdx = (e) => {
    const n = e.frames ? e.frames.length : 0;
    return n > 1 ? Math.floor(w.time * e.fps + (e.iid % n)) % n : 0;
  };
  const one = (type) => {
    const e = w.firstOf(type);
    return e ? { frames: e.frames ? e.frames.length : 0, fps: e.fps, idx: frameIdx(e) } : null;
  };
  return { time: Math.round(w.time * 100) / 100, player: one("player"), invader: one("invader"), blob: one("blob"), gem: one("gem") };
});

const a = await probe();
await new Promise((r) => setTimeout(r, 450));
const b = await probe();
await page.screenshot({ path: "scripts/shot-zoo.png" });

console.log("t0:", JSON.stringify(a));
console.log("t1:", JSON.stringify(b));

const tank1Frame = a.player && a.player.frames === 1;                 // preset "tank" = single frame, rotates
const invaderAnim = a.invader && a.invader.frames >= 2;              // preset "invader" = multi-frame
const blobFps = a.blob && a.blob.fps === 3;                          // per-entity fps override honoured
const gemAnim = a.gem && a.gem.frames === 2 && a.gem.fps === 4;      // custom frames+fps
// animation advanced: at least one multi-frame entity changed its frame index
const advanced = (a.invader && b.invader && a.invader.idx !== b.invader.idx)
  || (a.blob && b.blob && a.blob.idx !== b.blob.idx)
  || (a.gem && b.gem && a.gem.idx !== b.gem.idx);

console.log("\npreset 'tank' -> single rotating frame:", tank1Frame ? "✓" : "✗");
console.log("preset 'invader' -> animated (>=2 frames):", invaderAnim ? "✓" : "✗");
console.log("per-entity fps override on 'blob' (3):", blobFps ? "✓" : "✗");
console.log("custom 'gem' frames+fps (2 @ 4):", gemAnim ? "✓" : "✗");
console.log("animation advances over time (frame index changed):", advanced ? "✓" : "✗");
console.log(tank1Frame && invaderAnim && blobFps && gemAnim && advanced ? "\nALL PASS ✓" : "\nFAILED ✗");
await browser.close();
