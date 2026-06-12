// Headless diagnosis: load the running app, capture console + errors,
// click Generate with a description, and report what changed.
import puppeteer from "puppeteer-core";

const URL = process.env.URL || "http://localhost:5174/";
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  args: ["--no-sandbox"],
});
const page = await browser.newPage();
const logs = [];
page.on("console", (m) => logs.push(`[console.${m.type()}] ${m.text()}`));
page.on("pageerror", (e) => logs.push(`[pageerror] ${e.message}`));
page.on("requestfailed", (r) => logs.push(`[reqfail] ${r.url()} ${r.failure()?.errorText}`));

// Surface alert() dialogs (the app uses alert on compile failure).
page.on("dialog", async (d) => {
  logs.push(`[dialog] ${d.message()}`);
  await d.dismiss();
});

await page.goto(URL, { waitUntil: "networkidle2", timeout: 15000 });
await new Promise((r) => setTimeout(r, 600));

const snapshot = async (label) => {
  const data = await page.evaluate(() => {
    const c = document.getElementById("game");
    const w = globalThis;
    return {
      hasCanvas: !!c,
      canvasW: c?.width,
      canvasH: c?.height,
      btnText: document.getElementById("idea-go")?.textContent,
      // pull title drawn by HUD via the spec on window if exposed; else N/A
      title: document.title,
    };
  });
  logs.push(`[snapshot ${label}] ${JSON.stringify(data)}`);
};

await snapshot("after-load");
await page.screenshot({ path: "scripts/shot-before.png" });

// Type a description and click Generate.
await page.type("#idea-input", "a fast purple blob with a swarm of enemies");
await page.click("#idea-go");
await new Promise((r) => setTimeout(r, 900));
await snapshot("after-generate");
await page.screenshot({ path: "scripts/shot-after.png" });

// Also test a generic description with NO keyword matches.
await page.click("#idea-input", { clickCount: 3 });
await page.type("#idea-input", "a little hero exploring a quiet meadow");
await page.click("#idea-go");
await new Promise((r) => setTimeout(r, 900));
await page.screenshot({ path: "scripts/shot-generic.png" });

console.log(logs.join("\n"));
await browser.close();
