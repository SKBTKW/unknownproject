const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

    await page.goto('http://localhost:8080/index_v2.html', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#gridBoard .cell', { state: 'attached', timeout: 10000 });

    // Place different land categories on board
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

        render();
    });

    const boardLocator = page.locator('#gridBoard');

    const box = await page.evaluate(() => {
        const el = document.querySelector('.board-container') || document.getElementById('gridBoard');
        if (!el) return null;
        const rect = el.getBoundingClientRect();
        return { x: Math.max(0, rect.x + window.scrollX), y: Math.max(0, rect.y + window.scrollY), width: rect.width, height: rect.height };
    });

    // 1. Mode Hover
    await page.evaluate(() => {
        const board = document.getElementById('gridBoard');
        if (board) board.className = 'board-mode-hover';
    });
    const pathHover = 'C:/Users/mam07/.gemini/antigravity/brain/af6d4803-5dd7-4a55-87d7-472ecdecfde4/preview_mode_1_hover.png';
    await page.screenshot({ path: pathHover, clip: box });

    // 2. Mode Icon
    await page.evaluate(() => {
        const board = document.getElementById('gridBoard');
        if (board) board.className = 'board-mode-icon';
    });
    const pathIcon = 'C:/Users/mam07/.gemini/antigravity/brain/af6d4803-5dd7-4a55-87d7-472ecdecfde4/preview_mode_2_icon.png';
    await page.screenshot({ path: pathIcon, clip: box });

    // 3. Mode Always
    await page.evaluate(() => {
        const board = document.getElementById('gridBoard');
        if (board) board.className = 'board-mode-always';
    });
    const pathAlways = 'C:/Users/mam07/.gemini/antigravity/brain/af6d4803-5dd7-4a55-87d7-472ecdecfde4/preview_mode_3_always.png';
    await page.screenshot({ path: pathAlways, clip: box });

    console.log('=============================================================');
    console.log('THREE LABEL DISPLAY MODES PREVIEWS GENERATED SUCCESSFULLY');
    console.log('=============================================================');
    console.log(`- 1. Mode Hover Screenshot: ${pathHover}`);
    console.log(`- 2. Mode Icon Screenshot: ${pathIcon}`);
    console.log(`- 3. Mode Always Screenshot: ${pathAlways}`);
    console.log('-------------------------------------------------------------');

    await browser.close();
})();
