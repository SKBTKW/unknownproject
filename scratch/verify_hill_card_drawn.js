const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    await page.goto('http://localhost:8000/game/index_v2.html');

    // Force draw hill card to verify exact yield numbers in hand offering
    await page.evaluate(() => {
        const hillTerrain = { id: "H2_HILL", nameKey: "TERRAIN_HILL", food: 2, wood: 1, defense: 1, mystic: 0, weight: 0.250 };
        state.handOffering[0] = {
            id: "card_test_hill",
            nameKey: "TERRAIN_HILL",
            terrain: hillTerrain,
            currentShape: [[1]]
        };
        render();
    });

    await page.screenshot({ path: 'C:/Users/mam07/.gemini/antigravity/brain/5b868ecb-a33a-4010-b890-6fc37fefffc7/scratch/debug_screenshot_hill_verified_hand.png' });
    console.log("Hill card screenshot captured successfully!");
    await browser.close();
})();
