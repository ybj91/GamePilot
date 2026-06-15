import puppeteer from "puppeteer-core";
import { growAndSlow } from "../src/dsl/samples/growAndSlow.ts";
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const BASE = "http://localhost:4321";

// 1. create a game via REST
const created = await (await fetch(`${BASE}/api/games`, {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ spec: growAndSlow }),
})).json();
const id = created.id;
console.log("created:", id);

const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox"] });
const page = await browser.newPage();
await page.goto(`${BASE}/play/${id}`, { waitUntil: "networkidle2" });
await new Promise((r) => setTimeout(r, 1000));
const statusBefore = await page.$eval("#status", (el) => el.textContent);
await page.screenshot({ path: "scripts/shot-live-before.png" });
console.log("status before:", statusBefore);

// 2. update the SAME id with a visually distinct spec (no navigation in the browser)
const edited = structuredClone(growAndSlow);
edited.world.background = "#241006";           // warm background (was near-black)
edited.entities.find((e) => e.id === "player").color = "#5ad17a"; // green blob
edited.meta.title = "Grow & Slow (LIVE EDIT)";
const put = await fetch(`${BASE}/api/games/${id}`, {
  method: "PUT", headers: { "content-type": "application/json" },
  body: JSON.stringify({ spec: edited }),
});
console.log("PUT update ->", put.status);

// 3. wait past the 1.5s poll, then observe the SAME tab
await new Promise((r) => setTimeout(r, 3000));
const statusAfter = await page.$eval("#status", (el) => el.textContent);
const urlUnchanged = page.url() === `${BASE}/play/${id}`;
await page.screenshot({ path: "scripts/shot-live-after.png" });
console.log("status after: ", statusAfter);
console.log("url unchanged (no navigation):", urlUnchanged);
await browser.close();
