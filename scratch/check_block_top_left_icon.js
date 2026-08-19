const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1440, height: 1400 } });

    await page.goto('http://localhost:8080/index_v2.html', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#gridBoard .cell', { state: 'attached', timeout: 10000 });

    await page.evaluate(() => {
        const hill1x2 = { id: "CARD_HILL_1X2", terrainId: "H1_HILL", nameKey: "TERRAIN_H1_HILL", shape: [[1, 1]] };
        const forest1x1 = { id: "CARD_FOREST_1X1", terrainId: "GL2_FOREST", nameKey: "TERRAIN_GL2_FOREST", shape: [[1]] };

        window.state.hasPickedThisTurn = false;
        window.state.placeShape(2, 1, [[1, 1]], hill1x2, 0);

        window.state.hasPickedThisTurn = false;
        window.state.placeShape(1, 3, [[1]], forest1x1, 0);

        const board = document.getElementById('gridBoard');
        if (board) board.className = 'board-mode-icon';

        render();
    });

    const box = await page.evaluate(() => {
        const el = document.getElementById('gridBoard');
        if (!el) return null;
        const rect = el.getBoundingClientRect();
        return { x: Math.max(0, rect.x + window.scrollX), y: Math.max(0, rect.y + window.scrollY), width: rect.width, height: rect.height };
    });

    const screenshotPath = 'C:/Users/mam07/.gemini/antigravity/brain/af6d4803-5dd7-4a55-87d7-472ecdecfde4/preview_mode_block_top_left_icon.png';
    await page.screenshot({ path: screenshotPath, clip: box });

    console.log('=============================================================');
    console.log(`- Block Top-Left Icon Mode Screenshot Saved: ${screenshotPath}`);
    console.log('-------------------------------------------------------------');

    await browser.close();
})();
