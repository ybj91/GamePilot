import puppeteer from "puppeteer-core";
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const BASE = "http://localhost:4321";
const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox"], defaultViewport: { width: 1200, height: 760 } });
const page = await browser.newPage();
const errs = [];
page.on("pageerror", (e) => errs.push("[pageerror] " + e.message));
await page.goto(`${BASE}/`, { waitUntil: "networkidle2" });
await new Promise((r) => setTimeout(r, 700));
await page.screenshot({ path: "scripts/shot-ui.png" });
console.log("chat bubbles at load:", await page.$$eval(".msg", (n) => n.length));

// send a chat message -> create a new game
await page.type("#chat-text", "a green blob with many enemies");
await page.click("#chat-send");
await new Promise((r) => setTimeout(r, 1200));
const afterChat = await page.evaluate(() => {
  const w = window.gamepilot?.world;
  return {
    bubbles: document.querySelectorAll(".msg").length,
    lastReply: document.querySelector(".msg.assistant:last-of-type")?.textContent,
    playerColor: w?.firstOf("player")?.color,
    enemies: w?.countOf("enemy"),
  };
});
console.log("after chat:", JSON.stringify(afterChat));

// pause
await page.click("#btn-pause");
await new Promise((r) => setTimeout(r, 200));
const paused = await page.evaluate(() => window.gamepilot?.isPaused);
const pauseLabel = await page.$eval("#btn-pause", (b) => b.textContent);
await page.screenshot({ path: "scripts/shot-ui-paused.png" });
console.log("pause -> isPaused:", paused, "| button:", pauseLabel);

// resume + replay
await page.click("#btn-pause");
await page.click("#btn-replay");
const resumed = await page.evaluate(() => window.gamepilot?.isPaused);
console.log("resume -> isPaused:", resumed);
console.log("pageerrors:", errs.length ? errs.join("; ") : "none");
await browser.close();
