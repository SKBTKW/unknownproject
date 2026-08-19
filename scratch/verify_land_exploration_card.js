const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

    await page.goto('http://localhost:8080/index_v2.html', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    // Test: Trigger CMD_LAND_EXPLORATION Card
    const result = await page.evaluate(() => {
        // Clear all blooming sockets to fulfill noSocketsOnBoard condition
        for (let r = 0; r < 5; r++) {
            for (let c = 0; c < 5; c++) {
                if (window.state.grid[r][c].socketResource) {
                    window.state.grid[r][c].socketResource = null;
                }
            }
        }

        // Place a plains tile at (1,2) HQ adjacent so there is an explorable tile
        const plainsCard = { id: "CARD_PLAINS_1X1", terrainId: "GL1_PLAINS", nameKey: "TERRAIN_GL1_PLAINS", shape: [[1]] };
        window.state.hasPickedThisTurn = false;
        window.state.placeShape(1, 2, [[1]], plainsCard, 0);

        // Give player enough resources for Land Exploration: Food 50, Wood 50, Ember 5
        window.state.food = 50;
        window.state.wood = 50;
        window.state.ember = 5;

        // Play CMD_LAND_EXPLORATION card directly
        const cardObj = {
            id: "CMD_LAND_EXPLORATION",
            category: "COMMAND",
            nameKey: "CMD_LAND_EXPLORATION_NAME",
            descriptionKey: "CMD_LAND_EXPLORATION_DESC",
            cost: { food: 30, wood: 30, ember: 1 }
        };

        const res = window.state.playCommandCard(cardObj);
        render();

        return {
            success: res.success,
            remFood: window.state.food,
            remWood: window.state.wood,
            tileSearched: window.state.grid[1][2].searched
        };
    });

    console.log('=============================================================');
    console.log('CMD_LAND_EXPLORATION CARD REGISTRATION & EXECUTION TEST');
    console.log(`- Card Execution Success: ${result.success}`);
    console.log(`- Remaining Food (Expected 20): ${result.remFood}`);
    console.log(`- Remaining Wood (Expected 20): ${result.remWood}`);
    console.log(`- Target Tile (1,2) Searched Status: ${result.tileSearched}`);
    console.log('=============================================================');

    const screenshotPath = 'C:/Users/mam07/.gemini/antigravity/brain/af6d4803-5dd7-4a55-87d7-472ecdecfde4/land_exploration_card_registered_real.png';
    await page.screenshot({ path: screenshotPath });

    await browser.close();
})();
