const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();

    await page.goto('http://localhost:8080/index_v2.html', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#gridBoard .cell', { state: 'attached', timeout: 10000 });

    const terrainPlains = { id: "GL1_PLAINS", terrainId: "GL1_PLAINS", nameKey: "TERRAIN_PLAINS", food: 4, wood: 0 };

    // Place 4 Plains Tiles forming 2x2 block
    await page.evaluate((t) => {
        window.state.placeShape(2, 1, [[1]], t, 0);
        window.state.hasPickedThisTurn = false;
        window.state.placeShape(3, 1, [[1]], t, 1);
        window.state.hasPickedThisTurn = false;
        window.state.placeShape(2, 0, [[1]], t, 2);
        window.state.hasPickedThisTurn = false;
        window.state.placeShape(3, 0, [[1]], t, 3);
        window.render();
    }, terrainPlains);

    // 1. Verify Live Logs in #logContent
    const logItemsCount = await page.locator('#logContent .log-item').count();
    const latestLogText = await page.locator('#logContent .log-item').last().innerText();

    // 2. Verify Merged Border and Attribute Color Classes
    const cellClasses = await page.evaluate(() => {
        const cell = document.querySelector('.cell[data-r="2"][data-c="1"]');
        return cell ? cell.className : '';
    });
    const borderBottomStyle = await page.evaluate(() => {
        const cell = document.querySelector('.cell[data-r="2"][data-c="1"]');
        return cell ? window.getComputedStyle(cell).borderBottomStyle : '';
    });

    console.log('=============================================================');
    console.log('LIVE LOGS & TERRAIN ATTRIBUTE BORDER REAL MEASUREMENT');
    console.log('=============================================================');
    console.log(`- Live Log Items Rendered Count: ${logItemsCount}`);
    console.log(`- Latest Log Text Output: "${latestLogText}"`);
    console.log(`- Merged Cell Attribute Classes: "${cellClasses}"`);
    console.log(`- Inner Border Bottom Style (Should be "none"): "${borderBottomStyle}"`);
    console.log(`- Live Logs Active: ${logItemsCount > 0}`);
    console.log(`- Terrain Attribute Border Applied: ${cellClasses.includes('merged-plains')}`);
    console.log(`- Inner Border Erasure Active: ${borderBottomStyle === 'none'}`);
    console.log('-------------------------------------------------------------');

    await browser.close();
})();
