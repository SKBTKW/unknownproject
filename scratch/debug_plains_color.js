const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto('http://localhost:8080/index_v2.html');
    await page.waitForTimeout(500);

    // Force place GL1_PLAINS on cell r:3, c:1
    await page.evaluate(() => {
        const sysData = window.LAND_SYSTEM_DATA;
        const masterPlains = sysData.terrains.GL1_PLAINS;
        window.state.grid[2][1].placed = true;
        window.state.grid[2][1].terrain = masterPlains;
        window.render();
    });
    await page.waitForTimeout(200);

    const bgStyle = await page.$eval('.cell[data-r="2"][data-c="1"]', el => getComputedStyle(el).background);
    const bgColor = await page.$eval('.cell[data-r="2"][data-c="1"]', el => getComputedStyle(el).backgroundColor);

    console.log('PLAINS CELL BG STYLE:', bgStyle);
    console.log('PLAINS CELL BG COLOR:', bgColor);

    await browser.close();

    if (bgStyle.includes('72, 187, 120') || bgStyle.includes('47, 133, 90') || bgStyle.includes('48bb78')) {
        console.log('SUCCESS: Plains color is rich green verified 100%!');
        process.exit(0);
    } else {
        console.error('FAIL: Plains color is still light cream!');
        process.exit(1);
    }
})();
