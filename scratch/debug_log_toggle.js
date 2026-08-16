const { chromium } = require('playwright');
const path = require('path');

(async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    const filePath = 'file:///' + path.resolve(__dirname, '../game/index_v2.html').replace(/\\/g, '/');
    await page.goto(filePath);
    await page.waitForTimeout(500);

    const btn = page.locator('#btnLogToggle');

    console.log('--- BEFORE CLICK ---');
    console.log('BTN HTML:', await btn.innerHTML());
    console.log('WRAPPER CLASS:', await page.$eval('#logPanelWrapper', el => el.className));
    console.log('WRAPPER HEIGHT:', await page.$eval('#logPanelWrapper', el => el.clientHeight));

    await btn.click();
    await page.waitForTimeout(400);

    console.log('\n--- AFTER 1ST CLICK (COLLAPSE WRAPPER) ---');
    console.log('BTN HTML:', await btn.innerHTML());
    console.log('WRAPPER CLASS:', await page.$eval('#logPanelWrapper', el => el.className));
    console.log('WRAPPER HEIGHT:', await page.$eval('#logPanelWrapper', el => el.clientHeight));

    await btn.click();
    await page.waitForTimeout(400);

    console.log('\n--- AFTER 2ND CLICK (EXPAND WRAPPER) ---');
    console.log('BTN HTML:', await btn.innerHTML());
    console.log('WRAPPER CLASS:', await page.$eval('#logPanelWrapper', el => el.className));
    console.log('WRAPPER HEIGHT:', await page.$eval('#logPanelWrapper', el => el.clientHeight));

    await browser.close();
})();
