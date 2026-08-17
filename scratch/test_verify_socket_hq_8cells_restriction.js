const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();

    await page.goto('http://localhost:8080/index_v2.html', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#gridBoard .cell', { state: 'attached', timeout: 10000 });

    const terrainPlains = { id: "GL1_PLAINS", terrainId: "GL1_PLAINS", nameKey: "TERRAIN_PLAINS", food: 4, wood: 0 };

    // 1. Verify initial sockets are NOT in HQ 8 surrounding cells (r: 1..3, c: 1..3)
    const initialHQVicinitySockets = await page.evaluate(() => {
        let count = 0;
        for (let r = 1; r <= 3; r++) {
            for (let c = 1; c <= 3; c++) {
                if (window.state.grid[r][c].hasSocket || window.state.grid[r][c].socketResource) {
                    count++;
                }
            }
        }
        return count;
    });

    // 2. Try exploration inside HQ 8 cells (r=1, c=2) with forced roll >= 9
    const searchInsideVicinity = await page.evaluate((t) => {
        window.state.placeShape(1, 2, [[1]], t, 0);
        window.state.ember = 10;
        const origRandom = Math.random;
        Math.random = () => 0.99;
        const res = window.state.executeExploration(1, 2);
        Math.random = origRandom;
        return {
            res,
            spawnedSocket: Boolean(window.state.grid[1][2].socketResource),
            searched: window.state.grid[1][2].searched
        };
    }, terrainPlains);

    // 3. Place tile at (1, 1) then at (0, 1) outside HQ 8 cells, then explore (0, 1)
    const searchOutsideVicinity = await page.evaluate((t) => {
        window.state.hasPickedThisTurn = false;
        window.state.placeShape(1, 1, [[1]], t, 1);
        window.state.hasPickedThisTurn = false;
        window.state.placeShape(0, 1, [[1]], t, 2);
        window.state.ember = 10;
        const origRandom = Math.random;
        Math.random = () => 0.99;
        const res = window.state.executeExploration(0, 1);
        Math.random = origRandom;
        return {
            res,
            hasSocketFlag: window.state.grid[0][1].hasSocket,
            spawnedSocket: Boolean(window.state.grid[0][1].socketResource),
            searched: window.state.grid[0][1].searched
        };
    }, terrainPlains);

    console.log('=============================================================');
    console.log('SOCKET HQ 8-CELLS SURROUNDING RESTRICTION REAL MEASUREMENT');
    console.log('=============================================================');
    console.log(`- Initial Sockets in HQ 8 Surrounding Cells (Should be 0): ${initialHQVicinitySockets}`);
    console.log(`- Search Inside HQ 8 Cells Socket Spawned (Should be false): ${searchInsideVicinity.spawnedSocket}`);
    console.log(`- Search Outside HQ 8 Cells Socket Spawned (Should be true): ${searchOutsideVicinity.spawnedSocket}`);
    console.log(`- HQ 8 Surrounding Restriction 100% SUCCESS: ${initialHQVicinitySockets === 0 && !searchInsideVicinity.spawnedSocket && searchOutsideVicinity.spawnedSocket}`);
    console.log('-------------------------------------------------------------');

    await browser.close();
})();
