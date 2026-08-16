const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();

    await page.goto('http://localhost:8080/index_v2.html', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#gridBoard .cell', { state: 'attached', timeout: 10000 });

    const terrainPlains = { id: "GL1_PLAINS", terrainId: "GL1_PLAINS", nameKey: "TERRAIN_PLAINS", food: 4, wood: 0 };

    // 1. Initial State
    const initFood = await page.evaluate(() => window.state.food);

    // 2. Place 1st Plains at (2, 1) adjacent to HQ (2, 2)
    await page.evaluate((t) => {
        window.state.placeShape(2, 1, [[1]], t, 0);
        window.render();
    }, terrainPlains);

    // 3. Place 2nd Plains at (1, 1) -> Creates 1x2 Connection
    await page.evaluate((t) => {
        window.state.hasPickedThisTurn = false;
        window.state.placeShape(1, 1, [[1]], t, 1);
        window.render();
    }, terrainPlains);

    const food1x2 = await page.evaluate(() => window.state.food);

    // 4. Place 3rd Plains (1x1) at (0, 1) -> 1x1 + 1x2 = 1x3 Connection!
    await page.evaluate((t) => {
        window.state.hasPickedThisTurn = false;
        window.state.placeShape(0, 1, [[1]], t, 2);
        window.render();
    }, terrainPlains);

    const food1x3 = await page.evaluate(() => window.state.food);
    const bonus1x3 = food1x3 - food1x2;

    // Verify 3-tile unified mergeGroupId and inner border erasure
    const g0 = await page.evaluate(() => window.state.grid[2][1].mergeGroupId);
    const g1 = await page.evaluate(() => window.state.grid[1][1].mergeGroupId);
    const g2 = await page.evaluate(() => window.state.grid[0][1].mergeGroupId);
    const isUnifiedGroup = Boolean(g0 && g0 === g1 && g1 === g2);

    const borderBottomStyle = await page.evaluate(() => {
        const cell = document.querySelector('.cell[data-r="0"][data-c="1"]');
        return cell ? window.getComputedStyle(cell).borderBottomStyle : '';
    });

    console.log('=============================================================');
    console.log('1x1 + 1x2 MERGE EXPANSION & FUSION REAL MEASUREMENT');
    console.log('=============================================================');
    console.log(`- Initial Food: ${initFood}`);
    console.log(`- Food After 1x2 Placement: ${food1x2}`);
    console.log(`- Food After 1x1 + 1x2 Placement (1x3): ${food1x3} (+${bonus1x3})`);
    console.log(`- 1x3 Instant Bonus Applied (🌾+6): ${bonus1x3 === 6}`);
    console.log(`- Group IDs: Tile1("${g0}"), Tile2("${g1}"), Tile3("${g2}")`);
    console.log(`- Group ID Unified Across All 3 Tiles: ${isUnifiedGroup}`);
    console.log(`- Inner Border Erasure Active ("none"): "${borderBottomStyle}"`);
    console.log(`- 1x1 + 1x2 Block Fusion 100% SUCCESS: ${isUnifiedGroup && (bonus1x3 === 6) && (borderBottomStyle === 'none')}`);
    console.log('-------------------------------------------------------------');

    await browser.close();
})();
