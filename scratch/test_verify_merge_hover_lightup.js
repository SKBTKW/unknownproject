const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();

    await page.goto('http://localhost:8080/index_v2.html', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#gridBoard .cell', { state: 'attached', timeout: 10000 });

    const terrainPlains = { id: "GL1_PLAINS", terrainId: "GL1_PLAINS", nameKey: "TERRAIN_PLAINS", food: 4, wood: 0 };

    // Place 2x2 Merge Block (4 tiles)
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

    // Hover over top-left cell (2,1) of the merge block
    await page.locator('.cell[data-r="2"][data-c="1"]').hover();

    // Count how many cells in the grid got the .merge-hover-highlight class
    const highlightedCellsCount = await page.locator('#gridBoard .cell.merge-hover-highlight').count();
    const cell0Class = await page.evaluate(() => document.querySelector('.cell[data-r="2"][data-c="0"]').className);
    const cell1Class = await page.evaluate(() => document.querySelector('.cell[data-r="3"][data-c="1"]').className);

    console.log('=============================================================');
    console.log('MERGE BLOCK HOVER LINKED LIGHT-UP REAL MEASUREMENT');
    console.log('=============================================================');
    console.log(`- Linked Highlighted Cells Count (Should be 4): ${highlightedCellsCount}`);
    console.log(`- Connected Cell 1 Class Name: "${cell0Class}"`);
    console.log(`- Connected Cell 2 Class Name: "${cell1Class}"`);
    console.log(`- Group Hover Light-Up Active: ${highlightedCellsCount === 4}`);
    console.log(`- Highlight Class Attached Correctly: ${cell0Class.includes('merge-hover-highlight') && cell1Class.includes('merge-hover-highlight')}`);
    console.log('-------------------------------------------------------------');

    await browser.close();
})();
