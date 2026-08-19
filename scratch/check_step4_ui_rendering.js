const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();

    await page.goto('http://localhost:8080/index_v2.html', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#gridBoard .cell', { state: 'attached', timeout: 10000 });

    // 1. Force place a command card into hand offering slot 0 (CMD_AGRICULTURAL_POLICY)
    const test1 = await page.evaluate(() => {
        const drawSys = new Step1DrawSystem(window.state);
        const cardObj = drawSys.getLandCardMaster().find(c => c.id === "CMD_AGRICULTURAL_POLICY");

        window.state.handOffering[0] = {
            id: "card_test_cmd_1",
            cardMasterId: cardObj.id,
            nameKey: cardObj.nameKey,
            terrain: cardObj,
            currentShape: [[1]]
        };
        window.state.food = 10; // Food = 10 (Insufficient for req 15)
        window.render();

        const cardEl = document.querySelectorAll('#cardRow .card-frame-tcg')[0];
        return {
            hasCategoryClass: cardEl.classList.contains('category-economy'),
            hasCostDisabledClass: cardEl.classList.contains('cost-disabled'),
            badgeText: cardEl.querySelector('.tcg-cost-badge')?.innerText || ""
        };
    });

    // 2. Increase food = 30 (Sufficient) and check cost-disabled removed
    const test2 = await page.evaluate(() => {
        window.state.food = 30;
        window.render();

        const cardEl = document.querySelectorAll('#cardRow .card-frame-tcg')[0];
        return {
            hasCostDisabledClass: cardEl.classList.contains('cost-disabled')
        };
    });

    // 3. Click the command card and check DOM execution & resource update
    const test3 = await page.evaluate(async () => {
        window.state.food = 30;
        window.state.wood = 0;
        window.render();

        const cardEl = document.querySelectorAll('#cardRow .card-frame-tcg')[0];
        cardEl.click();

        return {
            foodAfter: window.state.food, // 15
            woodAfter: window.state.wood, // 20
            slotIsBlank: window.state.handOffering[0].isBlank === true
        };
    });

    console.log('=============================================================');
    console.log('STEP 4: UI RENDERING & INTERACTION REAL MEASUREMENT');
    console.log('=============================================================');
    console.log(`- Test 1 Command Rendering (category-economy, cost-disabled, badge 🌾15):`, JSON.stringify(test1));
    console.log(`- Test 2 Cost Met (cost-disabled removed):`, JSON.stringify(test2));
    console.log(`- Test 3 Click Play Execution (Food 15, Wood 20, Slot Blank):`, JSON.stringify(test3));
    console.log(`- Step 4 UI Rendering & Interaction 100% SUCCESS: ${test1.hasCategoryClass && test1.hasCostDisabledClass && !test2.hasCostDisabledClass && test3.foodAfter === 15 && test3.woodAfter === 20 && test3.slotIsBlank}`);
    console.log('-------------------------------------------------------------');

    await browser.close();
})();
