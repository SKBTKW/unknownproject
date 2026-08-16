const { chromium } = require('playwright');
const path = require('path');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    const filePath = 'file:///' + path.resolve(__dirname, '../game/index_v2.html').replace(/\\/g, '/');
    await page.goto(filePath);
    await page.waitForTimeout(500);

    const offeringCardsCount = await page.locator('#cardRow .card-frame-tcg').count();
    const reserveCardsCount = await page.locator('#reserveRow .card-frame-tcg').count();

    const offeringDisplay = await page.$eval('#cardRow', el => getComputedStyle(el).display);
    const offeringColumns = await page.$eval('#cardRow', el => getComputedStyle(el).gridTemplateColumns);

    console.log(`OFFERING CARDS COUNT: ${offeringCardsCount}`);
    console.log(`RESERVE CARDS COUNT: ${reserveCardsCount}`);
    console.log(`OFFERING GRID DISPLAY: ${offeringDisplay}`);
    console.log(`OFFERING GRID COLUMNS: ${offeringColumns}`);

    await browser.close();

    if (offeringCardsCount === 3 && offeringDisplay === 'grid') {
        console.log('SUCCESS: 3 cards offering grid verified 100%!');
        process.exit(0);
    } else {
        console.error('FAILED: Cards count or grid layout mismatch!');
        process.exit(1);
    }
})();
