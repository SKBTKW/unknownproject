const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();

    await page.goto('http://localhost:8080/index_v2.html', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#gridBoard .cell', { state: 'attached', timeout: 10000 });

    const terrainPlains = { id: "GL1_PLAINS", terrainId: "GL1_PLAINS", nameKey: "TERRAIN_PLAINS", food: 4, wood: 0 };

    // 1. Initial State
    const initFood = await page.evaluate(() => window.state.food);

    // 2. Place 1st 1x1 Plains at (2, 1) adjacent to HQ (2, 2)
    await page.evaluate((t) => {
        window.state.placeShape(2, 1, [[1]], t, 0);
        window.render();
    }, terrainPlains);

    const food1 = await page.evaluate(() => window.state.food);

    // 3. Place 2nd 1x1 Plains at (2, 0) adjacent to (2, 1) -> 1x1 + 1x1 Connection (1x2)
    await page.evaluate((t) => {
        window.state.hasPickedThisTurn = false;
        window.state.placeShape(2, 0, [[1]], t, 1);
        window.render();
    }, terrainPlains);

    const food2 = await page.evaluate(() => window.state.food);
    const bonusGiven = food2 - food1;

    // Check fusion status (merged flag, mergeGroupId, inner border erasure class)
    const cell1Merged = await page.evaluate(() => window.state.grid[2][1].merged);
    const cell2Merged = await page.evaluate(() => window.state.grid[2][0].merged);
    const groupId1 = await page.evaluate(() => window.state.grid[2][1].mergeGroupId);
    const groupId2 = await page.evaluate(() => window.state.grid[2][0].mergeGroupId);
    const borderRightStyle = await page.evaluate(() => {
        const cell = document.querySelector('.cell[data-r="2"][data-c="0"]');
        return cell ? window.getComputedStyle(cell).borderRightStyle : '';
    });

    console.log('=============================================================');
    console.log('1x1 + 1x1 CONNECTION INSTANT BONUS & BLOCK FUSION REAL MEASUREMENT');
    console.log('=============================================================');
    console.log(`- Initial Food: ${initFood}`);
    console.log(`- Food After 1st 1x1 Tile (2,1): ${food1} (+${food1 - initFood})`);
    console.log(`- Food After 2nd 1x1 Tile (2,0) [1x2]: ${food2} (+${bonusGiven})`);
    console.log(`- 1x2 Instant Bonus Applied Correctly (🌾+3): ${bonusGiven === 3}`);
    console.log(`- 1st Tile Merged Flag: ${cell1Merged}`);
    console.log(`- 2nd Tile Merged Flag: ${cell2Merged}`);
    console.log(`- Shared Merge Group ID: "${groupId1}" (Same: ${groupId1 === groupId2})`);
    console.log(`- Inner Border Erasure Active ("none"): "${borderRightStyle}"`);
    console.log(`- Block Fusion 100% SUCCESS: ${cell1Merged && cell2Merged && (groupId1 === groupId2) && (borderRightStyle === 'none')}`);
    console.log('-------------------------------------------------------------');

    await browser.close();
})();
