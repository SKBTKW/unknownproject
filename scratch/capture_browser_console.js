const { chromium } = require('playwright');
const path = require('path');

(async () => {
    try {
        const browser = await chromium.launch();
        const page = await browser.newPage();

        page.on('console', msg => console.log('PAGE LOG:', msg.text()));
        page.on('pageerror', err => console.error('PAGE ERROR:', err.stack));

        const htmlPath = 'file:///' + path.resolve('./game/index_v2.html').replace(/\\/g, '/');
        await page.goto(htmlPath);
        await page.waitForTimeout(2000);

        await browser.close();
    } catch(e) {
        console.error("Test Error:", e);
    }
})();
