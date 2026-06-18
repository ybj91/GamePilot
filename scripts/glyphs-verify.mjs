// Verify the /glyphs gallery: it lists every preset, renders them without error,
// and the multi-frame ones animate.
import puppeteer from "puppeteer-core";
import { GLYPH_PRESET_NAMES, COMPOSED_PRESET_NAMES } from "../src/dsl/glyphs.ts";
const ALL = [...GLYPH_PRESET_NAMES, ...COMPOSED_PRESET_NAMES];
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const BASE = process.env.BASE || "http://127.0.0.1:4321";
const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox"] });
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
await page.goto(`${BASE}/glyphs`, { waitUntil: "networkidle2" });
await new Promise((r) => setTimeout(r, 300));

const cards = await page.evaluate(() => [...document.querySelectorAll("#gallery .card .name")].map((n) => n.textContent));
const hash = () => page.evaluate(() => {
  const card = [...document.querySelectorAll("#gallery .card")].find((c) => c.querySelector(".tag.anim"));
  const cv = card.querySelector("canvas");
  return cv.getContext("2d").getImageData(0, 0, cv.width, cv.height).data.reduce((a, b) => (a + b) % 1e9, 0);
});
const seen = new Set();
for (let i = 0; i < 12; i++) { seen.add(await hash()); await new Promise((r) => setTimeout(r, 90)); }
await page.screenshot({ path: "scripts/shot-glyphs.png" });
await browser.close();

// v1 monochrome shown as standalone cards; v2 composed shown inside "v1 → v2" pairs.
const monoShown = GLYPH_PRESET_NAMES.every((n) => cards.includes(n));
const v2Shown = COMPOSED_PRESET_NAMES.every((v2) => cards.some((c) => c && c.includes(v2)));
console.log("no page errors:", errors.length === 0 ? "✓" : "✗ " + errors.join("; "));
console.log("every v1 monochrome preset shown:", monoShown ? "✓" : "✗", `(${GLYPH_PRESET_NAMES.length})`);
console.log("every v2 composed preset shown (paired with v1):", v2Shown ? "✓" : "✗", `(${COMPOSED_PRESET_NAMES.length})`);
console.log("animated previews cycle:", seen.size >= 2 ? "✓" : "✗", `(${seen.size} distinct frames)`);
console.log(errors.length === 0 && monoShown && v2Shown && seen.size >= 2 ? "\nALL PASS ✓ (glyph gallery)" : "\nFAILED ✗");
