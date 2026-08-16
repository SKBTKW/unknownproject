const { chromium } = require('playwright');
const path = require('path');

(async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    
    const pageErrors = [];
    const consoleErrors = [];
    page.on('pageerror', err => pageErrors.push(err.stack || err.message));
    page.on('console', msg => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    const filePath = 'file:///' + path.resolve(__dirname, '../game/index_v2.html').replace(/\\/g, '/');
    await page.goto(filePath);
    await page.waitForTimeout(1000);

    console.log('=== PAGE ERRORS ===');
    console.log(pageErrors);
    console.log('=== CONSOLE ERRORS ===');
    console.log(consoleErrors);

    await browser.close();
})();
