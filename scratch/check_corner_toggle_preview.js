const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1440, height: 1400 } });

    await page.goto('http://localhost:8080/index_v2.html', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#gridBoard .cell', { state: 'attached', timeout: 10000 });

    // Place different lands
    await page.evaluate(() => {
        const plains = { id: "CARD_PLAINS_1X1", terrainId: "GL1_PLAINS", nameKey: "TERRAIN_GL1_PLAINS", shape: [[1]] };
        const forest = { id: "CARD_FOREST_1X1", terrainId: "GL2_FOREST", nameKey: "TERRAIN_GL2_FOREST", shape: [[1]] };

        window.state.hasPickedThisTurn = false;
        window.state.placeShape(2, 1, [[1]], plains, 0);

        window.state.hasPickedThisTurn = false;
        window.state.placeShape(1, 2, [[1]], forest, 0);

        render();
    });

    const box = await page.evaluate(() => {
        const el = document.getElementById('gridBoard');
        if (!el) return null;
        const rect = el.getBoundingClientRect();
        return { x: Math.max(0, rect.x + window.scrollX), y: Math.max(0, rect.y + window.scrollY), width: rect.width, height: rect.height };
    });

    // 1. Hover Mode
    const pathCornerHover = 'C:/Users/mam07/.gemini/antigravity/brain/af6d4803-5dd7-4a55-87d7-472ecdecfde4/preview_corner_toggle_mode_hover.png';
    await page.screenshot({ path: pathCornerHover, clip: box });

    // 2. Icon Mode
    await page.evaluate(() => window.toggleBoardLabelMode());
    await page.waitForTimeout(300);
    const pathCornerIcon = 'C:/Users/mam07/.gemini/antigravity/brain/af6d4803-5dd7-4a55-87d7-472ecdecfde4/preview_corner_toggle_mode_icon.png';
    await page.screenshot({ path: pathCornerIcon, clip: box });

    // 3. Always Mode
    await page.evaluate(() => window.toggleBoardLabelMode());
    await page.waitForTimeout(300);
    const pathCornerAlways = 'C:/Users/mam07/.gemini/antigravity/brain/af6d4803-5dd7-4a55-87d7-472ecdecfde4/preview_corner_toggle_mode_always.png';
    await page.screenshot({ path: pathCornerAlways, clip: box });

    console.log('=============================================================');
    console.log('CORNER TOGGLE BUTTON PREVIEWS GENERATED SUCCESSFULLY');
    console.log('=============================================================');
    console.log(`- Corner Hover Mode Screenshot Saved: ${pathCornerHover}`);
    console.log(`- Corner Icon Mode Screenshot Saved: ${pathCornerIcon}`);
    console.log(`- Corner Always Mode Screenshot Saved: ${pathCornerAlways}`);
    console.log('-------------------------------------------------------------');

    await browser.close();
})();
