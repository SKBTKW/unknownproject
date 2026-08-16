const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();

    await page.goto('http://localhost:8080/index_v2.html', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#gridBoard .cell', { state: 'attached', timeout: 10000 });

    const terrainPlains = { id: "GL1_PLAINS", terrainId: "GL1_PLAINS", nameKey: "TERRAIN_PLAINS", food: 4, wood: 0 };

    // Set initial Ember to 10 for clean measurement
    await page.evaluate(() => { window.state.ember = 10; });
    const initEmber = await page.evaluate(() => window.state.ember);

    // 2. Place 4 Plains Tiles forming a 2x2 Block at (2,1), (3,1), (2,0), (3,0) adjacent to HQ (2,2)
    await page.evaluate((t) => {
        window.state.placeShape(2, 1, [[1]], t, 0);
        window.state.hasPickedThisTurn = false;
        window.state.placeShape(3, 1, [[1]], t, 1);
        window.state.hasPickedThisTurn = false;
        window.state.placeShape(2, 0, [[1]], t, 2);
        window.state.hasPickedThisTurn = false;
        window.state.placeShape(3, 0, [[1]], t, 3);
    }, terrainPlains);

    const finalEmber = await page.evaluate(() => window.state.ember);
    const emberGain = finalEmber - initEmber;
    const mergeGroupId = await page.evaluate(() => window.state.grid[2][1].mergeGroupId);
    const isMerged = await page.evaluate(() => window.state.grid[2][1].merged);

    console.log('=============================================================');
    console.log('STEP 4: 4-TILE (2x2) LARGE MERGE REAL MEASUREMENT');
    console.log('=============================================================');
    console.log(`- Initial Ember: ${initEmber}`);
    console.log(`- Final Ember After 2x2 Merge: ${finalEmber} (+${emberGain})`);
    console.log(`- 2x2 Merge Group ID Generated: ${mergeGroupId}`);
    console.log(`- Merge Flag Set: ${isMerged}`);
    console.log(`- Ember Reward (+1) Applied Correctly: ${emberGain === 1}`);
    console.log('-------------------------------------------------------------');

    await browser.close();
})();
