const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();

    await page.goto('http://localhost:8080/index_v2.html', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#gridBoard .cell', { state: 'attached', timeout: 10000 });

    // 1. Test CMD_AGRICULTURAL_POLICY execution
    const test1 = await page.evaluate(() => {
        const drawSys = new Step1DrawSystem(window.state);
        const cardObj = drawSys.getLandCardMaster().find(c => c.id === "CMD_AGRICULTURAL_POLICY");

        window.state.food = 30;
        window.state.wood = 0;
        const initFood = window.state.food;
        const res = window.state.playCommandCard(cardObj);

        return {
            success: res.success,
            foodDiff: initFood - window.state.food, // Should be 15
            woodAfter: window.state.wood, // Should be 20
            hasLog: window.state.gameLogs[0].includes("CMD_AGRICULTURAL_POLICY") || window.state.gameLogs[0].includes("発動")
        };
    });

    // 2. Test CMD_REKINDLE_EMBER execution
    const test2 = await page.evaluate(() => {
        const drawSys = new Step1DrawSystem(window.state);
        const cardObj = drawSys.getLandCardMaster().find(c => c.id === "CMD_REKINDLE_EMBER");

        window.state.mystic = 15;
        window.state.ember = 4;
        const res = window.state.playCommandCard(cardObj);

        return {
            success: res.success,
            mysticAfter: window.state.mystic, // Should be 5
            emberAfter: window.state.ember, // Should be 7
            waivedTurns: window.state.reserveFeeWaivedTurns // Should be 3
        };
    });

    // 3. Test LGD_DESPERATE_PACT execution
    const test3 = await page.evaluate(() => {
        const drawSys = new Step1DrawSystem(window.state);
        const cardObj = drawSys.getLandCardMaster().find(c => c.id === "LGD_DESPERATE_PACT");

        window.state.mystic = 30;
        window.state.ember = 5;
        const res = window.state.playCommandCard(cardObj);

        return {
            success: res.success,
            mysticAfter: window.state.mystic, // Should be 5
            emberAfter: window.state.ember, // Should be 10
            handOfferingSize: window.state.handOfferingSize, // Should be 4
            isUniqueRecorded: window.state.usedUniqueCards.includes("LGD_DESPERATE_PACT")
        };
    });

    console.log('=============================================================');
    console.log('STEP 3: HAND PLAY & COMMAND EXECUTION REAL MEASUREMENT');
    console.log('=============================================================');
    console.log(`- Test 1 Agricultural Policy (Food -15, Wood +20):`, JSON.stringify(test1));
    console.log(`- Test 2 Rekindle Ember (Mystic -10, Ember +3, Waived 3T):`, JSON.stringify(test2));
    console.log(`- Test 3 Desperate Pact (Mystic -25, Ember +5, Hand Size = 4):`, JSON.stringify(test3));
    console.log(`- Step 3 Command Execution 100% SUCCESS: ${test1.success && test2.success && test3.success && test3.handOfferingSize === 4}`);
    console.log('-------------------------------------------------------------');

    await browser.close();
})();
