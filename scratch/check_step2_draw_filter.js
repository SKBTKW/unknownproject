const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();

    await page.goto('http://localhost:8080/index_v2.html', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#gridBoard .cell', { state: 'attached', timeout: 10000 });

    const terrainPlains = { id: "GL1_PLAINS", terrainId: "GL1_PLAINS", nameKey: "TERRAIN_PLAINS", food: 4, wood: 0 };

    // 1. Initial Check: food = 30, but 0 plains placed.
    // CMD_AGRICULTURAL_POLICY requires reqPlains = 2. It should be filtered out!
    const check1 = await page.evaluate(() => {
        const drawSys = new Step1DrawSystem(window.state);
        const cardObj = drawSys.getLandCardMaster().find(c => c.id === "CMD_AGRICULTURAL_POLICY");
        return drawSys.isCardEligible(cardObj, 1, 0);
    });

    // 2. Place 2 Plains on board and re-evaluate
    const check2 = await page.evaluate((t) => {
        window.state.placeShape(1, 2, [[1]], t, 0);
        window.state.hasPickedThisTurn = false;
        window.state.placeShape(2, 1, [[1]], t, 1);
        window.render();

        const drawSys = new Step1DrawSystem(window.state);
        const cardObj = drawSys.getLandCardMaster().find(c => c.id === "CMD_AGRICULTURAL_POLICY");
        return drawSys.isCardEligible(cardObj, 1, 0);
    }, terrainPlains);

    // 3. Test maxEmber condition: CMD_REKINDLE_EMBER requires ember <= 5
    const check3Before = await page.evaluate(() => {
        const drawSys = new Step1DrawSystem(window.state);
        const cardObj = drawSys.getLandCardMaster().find(c => c.id === "CMD_REKINDLE_EMBER");
        window.state.ember = 10;
        window.state.mystic = 15;
        return drawSys.isCardEligible(cardObj, 1, 0);
    });

    const check3After = await page.evaluate(() => {
        const drawSys = new Step1DrawSystem(window.state);
        const cardObj = drawSys.getLandCardMaster().find(c => c.id === "CMD_REKINDLE_EMBER");
        window.state.ember = 4;
        window.state.mystic = 15;
        return drawSys.isCardEligible(cardObj, 1, 0);
    });

    console.log('=============================================================');
    console.log('STEP 2: DYNAMIC CONDITION FILTERING REAL MEASUREMENT');
    console.log('=============================================================');
    console.log(`- CMD_AGRICULTURAL_POLICY Filtered Out (0 Plains, Should be false): ${check1}`);
    console.log(`- CMD_AGRICULTURAL_POLICY Passed Filter (2 Plains + 15 Food, Should be true): ${check2}`);
    console.log(`- CMD_REKINDLE_EMBER Filtered Out (Ember=10, Should be false): ${check3Before}`);
    console.log(`- CMD_REKINDLE_EMBER Passed Filter (Ember=4 + 10 Mystic, Should be true): ${check3After}`);
    console.log(`- Step 2 Dynamic Condition Filtering 100% SUCCESS: ${!check1 && check2 && !check3Before && check3After}`);
    console.log('-------------------------------------------------------------');

    await browser.close();
})();
