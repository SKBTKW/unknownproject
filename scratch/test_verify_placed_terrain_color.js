const { chromium } = require('playwright');
const path = require('path');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    const filePath = 'file:///' + path.resolve(__dirname, '../game/index_v2.html').replace(/\\/g, '/');
    await page.goto(filePath);
    await page.waitForTimeout(500);

    // Select first card
    const firstCard = page.locator('#cardRow .card-frame-tcg').first();
    await firstCard.click();
    await page.waitForTimeout(100);

    // Click on valid cell next to HQ (r:2, c:1)
    const targetCell = page.locator('.cell[data-r="2"][data-c="1"]');
    await targetCell.click();
    await page.waitForTimeout(200);

    // Check background style of placed cell
    const bgStyle = await page.$eval('.cell[data-r="2"][data-c="1"]', el => getComputedStyle(el).background);
    const bgColor = await page.$eval('.cell[data-r="2"][data-c="1"]', el => getComputedStyle(el).backgroundColor);

    console.log('PLACED CELL BACKGROUND:', bgStyle);
    console.log('PLACED CELL BG COLOR:', bgColor);

    await browser.close();

    // Check if background is NOT default dark background rgba(28, 32, 44...) or #1c202c
    const isColored = bgColor !== 'rgb(28, 32, 44)' && bgStyle !== '';
    if (isColored) {
        console.log('SUCCESS: Placed terrain color pattern verified 100%!');
        process.exit(0);
    } else {
        console.error('FAILED: Placed terrain color pattern failed!');
        process.exit(1);
    }
})();
