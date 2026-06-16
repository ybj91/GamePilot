import puppeteer from "puppeteer-core";
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const URL = "http://localhost:4321/play/tank-1990-076bdc";
const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox"] });
const page = await browser.newPage();
await page.goto(URL, { waitUntil: "networkidle2" });
await new Promise((r) => setTimeout(r, 400));
await page.screenshot({ path: "scripts/shot-tank1990.png" });

const counts = await page.evaluate(() => {
  const w = window.gamepilot.world;
  return {
    enemies: { basic: w.countOf("basic"), fast: w.countOf("fast"), armor: w.countOf("armor") },
    bricks: ["b1","b2","b3","b4","b5","b6"].filter((id) => w.countOf(id)).length,
    steel: ["s1","s2","s3"].filter((id) => w.countOf(id)).length,
    armorHp: w.firstOf("armor")?.props.hp,
  };
});
console.log("variety:", JSON.stringify(counts));

// facing fire: drive a direction, press space, inspect the newest player bullet's velocity
const fire = async (key) => {
  await page.keyboard.down(key); await new Promise((r) => setTimeout(r, 300)); await page.keyboard.up(key);
  await page.keyboard.press("Space"); await new Promise((r) => setTimeout(r, 120));
  return page.evaluate(() => {
    const b = window.gamepilot.world.entities.filter((e) => e.alive && e.type === "bullet").sort((a, b2) => b2.iid - a.iid)[0];
    return b ? { vx: Math.round(b.vx), vy: Math.round(b.vy) } : null;
  });
};
console.log("drive UP   + space ->", JSON.stringify(await fire("w")),   "(expect vy<0)");
console.log("drive RIGHT+ space ->", JSON.stringify(await fire("d")),   "(expect vx>0)");
await browser.close();
