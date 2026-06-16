import puppeteer from "puppeteer-core";
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const BASE = "http://localhost:4321";
const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox"], defaultViewport: { width: 1100, height: 800 } });
const page = await browser.newPage();
const errs = [];
page.on("pageerror", (e) => errs.push(e.message));
await page.goto(`${BASE}/games`, { waitUntil: "networkidle2" });
await new Promise((r) => setTimeout(r, 500));
const cards = await page.$$eval(".card", (n) => n.length);
const count = await page.$eval("#count", (e) => e.textContent);
const firstPlayHref = await page.$eval(".card .play", (a) => a.getAttribute("href")).catch(() => null);
console.log("cards:", cards, "| count label:", count, "| first play link:", firstPlayHref);
await page.screenshot({ path: "scripts/shot-library.png" });

// click the first card body -> navigates to /play/:id
await page.click(".card .card-body");
await new Promise((r) => setTimeout(r, 600));
console.log("after click, url:", page.url());
console.log("pageerrors:", errs.length ? errs.join("; ") : "none");
await browser.close();
