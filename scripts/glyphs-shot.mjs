import puppeteer from "puppeteer-core";
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const BASE = process.env.BASE || "http://127.0.0.1:4321";
const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox"], defaultViewport: { width: 1000, height: 900 } });
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
await page.goto(`${BASE}/glyphs`, { waitUntil: "networkidle2" });
await new Promise((r) => setTimeout(r, 600));
const sections = await page.$$eval(".section", (els) => els.map((e) => e.textContent.trim()));
const count = await page.$eval("#count", (e) => e.textContent).catch(() => "(no count)");
console.log("count:", count);
console.log("sections:", sections.map((s) => s.split(" ")[0]).join(", "));
console.log("page errors:", errors.length ? errors.join("; ") : "none ✓");
// scroll to the fabric section and shoot from there
await page.evaluate(() => {
  const s = [...document.querySelectorAll(".section")].find((e) => e.textContent.includes("fabric"));
  if (s) s.scrollIntoView();
});
await new Promise((r) => setTimeout(r, 400));
await page.screenshot({ path: "scripts/shot-glyphs.png" });
console.log("shot -> scripts/shot-glyphs.png");
await browser.close();
