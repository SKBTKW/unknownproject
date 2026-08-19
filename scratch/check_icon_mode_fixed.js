const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1280, height: 1200 } });

    await page.goto('http://localhost:8080/index_v2.html', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#gridBoard .cell', { state: 'attached', timeout: 10000 });

    await page.evaluate(() => {
        const plains = { id: "CARD_PLAINS_1X1", terrainId: "GL1_PLAINS", nameKey: "TERRAIN_GL1_PLAINS", shape: [[1]] };
        const forest = { id: "CARD_FOREST_1X1", terrainId: "GL2_FOREST", nameKey: "TERRAIN_GL2_FOREST", shape: [[1]] };
        const mountain = { id: "CARD_MOUNTAIN_1X1", terrainId: "H3_MOUNTAIN", nameKey: "TERRAIN_H3_MOUNTAIN", shape: [[1]] };
        const desert = { id: "CARD_DESERT_1X1", terrainId: "GL0_DESERT", nameKey: "TERRAIN_GL0_DESERT", shape: [[1]] };

        window.state.hasPickedThisTurn = false;
        window.state.placeShape(2, 1, [[1]], plains, 0);

        window.state.hasPickedThisTurn = false;
        window.state.placeShape(1, 2, [[1]], forest, 0);

        window.state.hasPickedThisTurn = false;
        window.state.placeShape(2, 3, [[1]], mountain, 0);

        window.state.hasPickedThisTurn = false;
        window.state.placeShape(3, 2, [[1]], desert, 0);

        const board = document.getElementById('gridBoard');
        if (board) board.className = 'board-mode-icon';

        render();
    });

    await page.evaluate(() => {
        window.scrollTo(0, 150);
    });
    await page.waitForTimeout(300);

    const screenshotPath = 'C:/Users/mam07/.gemini/antigravity/brain/af6d4803-5dd7-4a55-87d7-472ecdecfde4/preview_mode_2_icon_fixed.png';
    await page.screenshot({ path: screenshotPath });

    console.log('=============================================================');
    console.log(`- Icon Mode Screenshot Saved: ${screenshotPath}`);
    console.log('-------------------------------------------------------------');

    await browser.close();
})();
