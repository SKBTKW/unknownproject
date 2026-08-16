const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    await page.goto('http://localhost:8000/game/index_v2.html');

    // Force draw 1x2 card to demonstrate rotate button layout
    await page.evaluate(() => {
        const hillTerrain = { id: "H2_HILL", nameKey: "TERRAIN_HILL", food: 2, wood: 1, defense: 1, mystic: 0, weight: 0.250 };
        state.handOffering[0] = {
            id: "card_test_rotate",
            nameKey: "TERRAIN_HILL",
            terrain: hillTerrain,
            currentShape: [[1, 1]]
        };
        render();
    });

    await page.screenshot({ path: 'C:/Users/mam07/.gemini/antigravity/brain/5b868ecb-a33a-4010-b890-6fc37fefffc7/scratch/debug_screenshot_rotate_btn_added.png' });
    console.log("Rotate button UI screenshot captured successfully!");
    await browser.close();
})();
