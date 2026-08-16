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
    }, terrainPlains);

    // Retrieve mergedBlocks object
    const mergedBlocks = await page.evaluate(() => window.state.mergedBlocks);
    const block1 = mergedBlocks["merge_1"];

    console.log('=============================================================');
    console.log('SINGLE MERGED BLOCK REGENERATION REAL MEASUREMENT');
    console.log('=============================================================');
    console.log(`- Merged Blocks Count: ${Object.keys(mergedBlocks).length}`);
    console.log(`- Single Block Object ID: ${block1 ? block1.groupId : 'null'}`);
    console.log(`- Block Terrain ID: ${block1 ? block1.terrainId : 'null'}`);
    console.log(`- Block Merge Type: ${block1 ? block1.mergeType : 'null'}`);
    console.log(`- Block Component Cells Count: ${block1 ? block1.cells.length : 0}`);
    console.log(`- Block Yield Multiplier: ${block1 ? block1.yieldMultiplier : 0}`);
    console.log(`- Single Block Regenerated Successfully: ${Boolean(block1 && block1.cells.length === 4)}`);
    console.log('-------------------------------------------------------------');

    await browser.close();
})();
