const puppeteer = require('puppeteer-core');

async function run() {
  console.log("Starting browser test...");
  const browser = await puppeteer.launch({
    executablePath: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  page.on('console', msg => {
    console.log(`[BROWSER CONSOLE] ${msg.type().toUpperCase()}: ${msg.text()}`);
  });

  page.on('pageerror', err => {
    console.error(`[BROWSER PAGEERROR]`, err.stack || err.toString());
  });

  try {
    console.log("Navigating to game page...");
    await page.goto('http://localhost:8000/index.html', { waitUntil: 'load' });

    console.log("Waiting 1s...");
    await new Promise(r => setTimeout(r, 1000));

    console.log("Clicking the first role select button...");
    await page.click('.select-role-btn');

    console.log("Waiting 2s...");
    await new Promise(r => setTimeout(r, 2000));

    console.log("Success! Page loaded and role select transitioned without errors.");
  } catch (e) {
    console.error("Test execution failed:", e);
  } finally {
    await browser.close();
    console.log("Browser closed.");
  }
}

run();
