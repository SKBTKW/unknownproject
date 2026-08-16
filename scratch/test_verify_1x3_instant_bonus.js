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
    }, terrainPlains);
    const food1 = await page.evaluate(() => window.state.food);

    // 3. Place 2nd Plains at (1, 1) adjacent to (2, 1) -> 1x2 Connection (🌾+3)
    await page.evaluate((t) => {
        window.state.hasPickedThisTurn = false;
        window.state.placeShape(1, 1, [[1]], t, 1);
    }, terrainPlains);
    const food2 = await page.evaluate(() => window.state.food);
    const bonus1x2 = food2 - food1;

    // 4. Place 3rd Plains at (0, 1) -> 1x3 Straight Line Connection (0,1)-(1,1)-(2,1) (🌾+6)
    await page.evaluate((t) => {
        window.state.hasPickedThisTurn = false;
        window.state.placeShape(0, 1, [[1]], t, 2);
    }, terrainPlains);
    const food3 = await page.evaluate(() => window.state.food);
    const bonus1x3 = food3 - food2;

    console.log('=============================================================');
    console.log('STEP 3: 1x3 LINEAR CONNECTION INSTANT BONUS REAL MEASUREMENT');
    console.log('=============================================================');
    console.log(`- Initial Food: ${initFood}`);
    console.log(`- Food After 1st Plains (2,0): ${food1} (+0)`);
    console.log(`- Food After 2nd Plains Adjacent (2,1) [1x2]: ${food2} (+${bonus1x2})`);
    console.log(`- Food After 3rd Plains Straight (2,2) [1x3]: ${food3} (+${bonus1x3})`);
    console.log(`- Expected 1x3 Bonus: 6 (150% of 4 = 6)`);
    console.log(`- 1x3 Bonus Applied Correctly: ${bonus1x3 === 6}`);
    console.log('-------------------------------------------------------------');

    await browser.close();
})();
