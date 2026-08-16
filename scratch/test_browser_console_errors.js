const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();

  const pageErrors = [];
  const consoleErrors = [];

  page.on('pageerror', err => {
    console.log('PAGE ERROR STACK:', err.stack || err);
    pageErrors.push(err.stack || err.message);
  });
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  const fileUrl = 'file:///' + path.resolve(__dirname, '../game/index_v2.html').replace(/\\/g, '/');
  console.log('=== Testing File URL directly: ===', fileUrl);
  await page.goto(fileUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  const fileStatus = await page.evaluate(() => {
    return {
      gridBoardExists: !!document.getElementById('gridBoard'),
      gridBoardHTML: document.getElementById('gridBoard') ? document.getElementById('gridBoard').innerHTML.length : 0,
      stateExists: !!window.state,
      bodyHTML: document.body.innerHTML.substring(0, 300)
    };
  });

  console.log('FILE URL STATUS:', fileStatus);
  console.log('PAGE ERRORS:', pageErrors);
  console.log('CONSOLE ERRORS:', consoleErrors);

  await browser.close();
})();
