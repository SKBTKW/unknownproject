const { chromium } = require('playwright');
const path = require('path');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    const filePath = 'file:///' + path.resolve(__dirname, '../game/index_v2.html').replace(/\\/g, '/');
    await page.goto(filePath);
    await page.waitForTimeout(500);

    const cell = page.locator('.cell').first();
    const box = await cell.boundingBox();

    // Hover first cell
    await page.mouse.move(box.x + 10, box.y + 10);
    await page.waitForTimeout(100);
    const pos1 = await page.$eval('#tileTooltip', el => ({ left: el.style.left, top: el.style.top }));

    // Move mouse slightly inside cell
    await page.mouse.move(box.x + 40, box.y + 40);
    await page.waitForTimeout(100);
    const pos2 = await page.$eval('#tileTooltip', el => ({ left: el.style.left, top: el.style.top }));

    console.log(`TOOLTIP POS 1: left=${pos1.left}, top=${pos1.top}`);
    console.log(`TOOLTIP POS 2: left=${pos2.left}, top=${pos2.top}`);

    await browser.close();

    if (pos1.left !== pos2.left || pos1.top !== pos2.top) {
        console.log('SUCCESS: Tooltip mouse tracking verified 100%!');
        process.exit(0);
    } else {
        console.error('FAILED: Tooltip mouse tracking failed!');
        process.exit(1);
    }
})();
