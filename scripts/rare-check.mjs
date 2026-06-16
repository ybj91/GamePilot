import puppeteer from "puppeteer-core";
const b = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: "new", args: ["--no-sandbox"] });
const p = await b.newPage();
await p.goto("http://localhost:4321/play/tank-1990-076bdc", { waitUntil: "networkidle2" });
await new Promise((r) => setTimeout(r, 800));
const s = await p.evaluate(() => ({ bolt: window.gamepilot.world.countOf("bolt"), star: window.gamepilot.world.countOf("star") }));
console.log("at start: bolt =", s.bolt, "star =", s.star, "(both 0 = rare, not pre-spawned)");
await b.close();
