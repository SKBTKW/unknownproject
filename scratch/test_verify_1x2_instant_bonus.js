const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();

    await page.goto('http://localhost:8080/index_v2.html', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#gridBoard .cell', { state: 'attached', timeout: 10000 });

    // 1. Initial Resources
    const initFood = await page.evaluate(() => window.state.food);
    const initWood = await page.evaluate(() => window.state.wood);

    // 2. Place 1st Plains Tile at (2, 1)
    await page.evaluate(() => {
        const terrain = { id: "GL1_PLAINS", terrainId: "GL1_PLAINS", nameKey: "TERRAIN_PLAINS", food: 4, wood: 0 };
        window.state.placeShape(2, 1, [[1]], terrain, 0);
    });

    const foodAfter1 = await page.evaluate(() => window.state.food);
    const woodAfter1 = await page.evaluate(() => window.state.wood);

    // 3. Place 2nd Plains Tile adjacent at (2, 0) -> Should trigger 1x2 Connection Instant Bonus (🌾+3)
    await page.evaluate(() => {
        window.state.hasPickedThisTurn = false;
        const terrain = { id: "GL1_PLAINS", terrainId: "GL1_PLAINS", nameKey: "TERRAIN_PLAINS", food: 4, wood: 0 };
        window.state.placeShape(2, 0, [[1]], terrain, 1);
    });

    const foodAfter2 = await page.evaluate(() => window.state.food);
    const woodAfter2 = await page.evaluate(() => window.state.wood);
    const bonusGiven = foodAfter2 - foodAfter1;

    console.log('=============================================================');
    console.log('STEP 2: 1x2 CONNECTION INSTANT BONUS REAL MEASUREMENT');
    console.log('=============================================================');
    console.log(`- Initial Food: ${initFood}`);
    console.log(`- Food After 1st Plains (2,1): ${foodAfter1} (+${foodAfter1 - initFood})`);
    console.log(`- Food After 2nd Plains Adjacent (2,0): ${foodAfter2} (+${bonusGiven})`);
    console.log(`- Expected Instant Bonus: 3 (80% of 4 = 3.2 -> 3)`);
    console.log(`- Bonus Applied Correctly: ${bonusGiven === 3}`);
    console.log('-------------------------------------------------------------');

    await browser.close();
})();
