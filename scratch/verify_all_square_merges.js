const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

    await page.goto('http://localhost:8080/index_v2.html', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#gridBoard .cell', { state: 'attached', timeout: 10000 });

    // Test 1: Plains 2x2 Merge connected to HQ(2,2) -> (1,1), (1,2), (2,1) [already adjacent] + (1,1) is HQ adjacent
    const plainsMergeResult = await page.evaluate(() => {
        const plainsCard = { id: "CARD_PLAINS_1X1", terrainId: "GL1_PLAINS", nameKey: "TERRAIN_GL1_PLAINS", shape: [[1]] };
        
        const initFood = window.state.food;
        const initEmber = window.state.ember;

        // Force place 4 plains tiles at HQ adjacent positions (1,1), (1,2), (1,3), (2,3)
        // Or place directly by setting cell properties to test merge engine logic cleanly
        const coords = [[1, 1], [1, 2], [2, 1], [1, 1]]; 
        // Let's place (1,1), (1,2), (1,3), (2,3) -- wait, 2x2 is (1,1)-(2,2) but (2,2) is HQ.
        // So 2x2 at (0,1),(0,2),(1,1),(1,2) where (1,2) & (1,1) are HQ adjacent!
        
        window.state.hasPickedThisTurn = false;
        window.state.placeShape(1, 2, [[1]], plainsCard, 0); // HQ adjacent

        window.state.hasPickedThisTurn = false;
        window.state.placeShape(1, 1, [[1]], plainsCard, 0); // HQ adjacent

        window.state.hasPickedThisTurn = false;
        window.state.placeShape(0, 2, [[1]], plainsCard, 0); // Adjacent to (1,2)

        // 4th tile completes 2x2 at (0,1)-(1,2)
        window.state.hasPickedThisTurn = false;
        window.state.placeShape(0, 1, [[1]], plainsCard, 0); // Adjacent to (0,2) and (1,1)

        render();

        return {
            foodGained: window.state.food - initFood,
            emberGained: window.state.ember - initEmber,
            isMerged: window.state.grid[0][1].mergeType === "2x2"
        };
    });

    console.log('=============================================================');
    console.log('1. PLAINS 2X2 SQUARE MERGE TEST');
    console.log(`- Food Gained (Expected >= 10): ${plainsMergeResult.foodGained}`);
    console.log(`- Ember Gained (Expected >= 1): ${plainsMergeResult.emberGained}`);
    console.log(`- Merge 2x2 Active: ${plainsMergeResult.isMerged}`);

    // Capture screenshot of Plains 2x2 Merge
    const plainsPath = 'C:/Users/mam07/.gemini/antigravity/brain/af6d4803-5dd7-4a55-87d7-472ecdecfde4/verify_plains_2x2_merge_real.png';
    await page.screenshot({ path: plainsPath });

    // Test 2: Hill 2x2 Merge at (2,3)-(3,4) connected to HQ via (2,3)
    const hillMergeResult = await page.evaluate(() => {
        const hillCard = { id: "CARD_HILL_1X1", terrainId: "H1_HILL", nameKey: "TERRAIN_H1_HILL", shape: [[1]] };
        
        const initWood = window.state.wood;
        const initFood = window.state.food;

        window.state.hasPickedThisTurn = false;
        window.state.placeShape(2, 3, [[1]], hillCard, 0); // HQ adjacent

        window.state.hasPickedThisTurn = false;
        window.state.placeShape(2, 4, [[1]], hillCard, 0);

        window.state.hasPickedThisTurn = false;
        window.state.placeShape(3, 3, [[1]], hillCard, 0);

        // 4th tile completes 2x2 Hill at (2,3)-(3,4)
        window.state.hasPickedThisTurn = false;
        window.state.placeShape(3, 4, [[1]], hillCard, 0);

        render();

        return {
            woodGained: window.state.wood - initWood,
            foodGained: window.state.food - initFood,
            isMerged: window.state.grid[2][3].mergeType === "2x2"
        };
    });

    console.log('-------------------------------------------------------------');
    console.log('2. HILL 2X2 SQUARE MERGE TEST');
    console.log(`- Wood Gained (Expected >= 8): ${hillMergeResult.woodGained}`);
    console.log(`- Food Gained (Expected >= 4): ${hillMergeResult.foodGained}`);
    console.log(`- Merge 2x2 Active: ${hillMergeResult.isMerged}`);

    // Capture screenshot of Hill 2x2 Merge
    const hillPath = 'C:/Users/mam07/.gemini/antigravity/brain/af6d4803-5dd7-4a55-87d7-472ecdecfde4/verify_hill_2x2_merge_real.png';
    await page.screenshot({ path: hillPath });

    console.log('=============================================================');

    await browser.close();
})();
