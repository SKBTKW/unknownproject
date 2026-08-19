const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

    await page.goto('http://localhost:8080/index_v2.html', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    // Place different terrain categories on the board:
    // (1,2) Plains, (2,1) Forest, (2,3) Hill, (3,2) Mountain
    await page.evaluate(() => {
        window.state.hasPickedThisTurn = false;
        window.state.placeShape(1, 2, [[1]], { id: "CARD_PLAINS_1X1", terrainId: "GL1_PLAINS", nameKey: "TERRAIN_GL1_PLAINS", shape: [[1]] }, 0);
        window.state.hasPickedThisTurn = false;
        window.state.placeShape(2, 1, [[1]], { id: "CARD_FOREST_1X1", terrainId: "GL2_FOREST", nameKey: "TERRAIN_FOREST", shape: [[1]] }, 0);
        window.state.hasPickedThisTurn = false;
        window.state.placeShape(2, 3, [[1]], { id: "CARD_HILL_1X1", terrainId: "H2_HILL", nameKey: "TERRAIN_HILL", shape: [[1]] }, 0);
        window.state.hasPickedThisTurn = false;
        window.state.placeShape(3, 2, [[1]], { id: "CARD_MOUNTAIN_1X1", terrainId: "H3_MOUNTAIN", nameKey: "TERRAIN_MOUNTAIN", shape: [[1]] }, 0);
        render();
    });

    await page.waitForTimeout(500);

    const screenshotPath = 'C:/Users/mam07/.gemini/antigravity/brain/af6d4803-5dd7-4a55-87d7-472ecdecfde4/independent_category_colors_real.png';
    await page.screenshot({ path: screenshotPath });

    console.log('=============================================================');
    console.log('INDEPENDENT TERRAIN CATEGORY COLORS VERIFICATION COMPLETE');
    console.log(`- Screenshot Saved: ${screenshotPath}`);
    console.log('=============================================================');

    await browser.close();
})();
