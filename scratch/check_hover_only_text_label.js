const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

    await page.goto('http://localhost:8080/index_v2.html', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#gridBoard .cell', { state: 'attached', timeout: 10000 });

    // Place Plains at B3 (2,1) and Forest at C2 (1,2)
    await page.evaluate(() => {
        const plains = { id: "CARD_PLAINS_1X1", terrainId: "GL1_PLAINS", nameKey: "TERRAIN_GL1_PLAINS", shape: [[1]] };
        const forest = { id: "CARD_FOREST_1X1", terrainId: "GL2_FOREST", nameKey: "TERRAIN_GL2_FOREST", shape: [[1]] };

        window.state.hasPickedThisTurn = false;
        window.state.placeShape(2, 1, [[1]], plains, 0);

        window.state.hasPickedThisTurn = false;
        window.state.placeShape(1, 2, [[1]], forest, 0);

        render();
    });

    // Capture Normal State (Text hidden, pure color map)
    const screenshotNormalPath = 'C:/Users/mam07/.gemini/antigravity/brain/af6d4803-5dd7-4a55-87d7-472ecdecfde4/hover_only_text_normal_real.png';
    await page.screenshot({ path: screenshotNormalPath });

    const normalOpacity = await page.evaluate(() => {
        const label = document.querySelector('.cell[data-r="2"][data-c="1"] .cell-text-label');
        return label ? window.getComputedStyle(label).opacity : '';
    });

    // Hover over B3 (2,1)
    await page.hover('.cell[data-r="2"][data-c="1"]');
    await page.waitForTimeout(300);

    // Capture Hovered State (Text fades in!)
    const screenshotHoveredPath = 'C:/Users/mam07/.gemini/antigravity/brain/af6d4803-5dd7-4a55-87d7-472ecdecfde4/hover_only_text_hovered_real.png';
    await page.screenshot({ path: screenshotHoveredPath });

    const hoveredOpacity = await page.evaluate(() => {
        const label = document.querySelector('.cell[data-r="2"][data-c="1"] .cell-text-label');
        return label ? window.getComputedStyle(label).opacity : '';
    });

    console.log('=============================================================');
    console.log('HOVER-ONLY TERRAIN TEXT DISPLAY REAL MEASUREMENT');
    console.log('=============================================================');
    console.log(`- Normal State Text Opacity (Expected: "0"): "${normalOpacity}"`);
    console.log(`- Hovered State Text Opacity (Expected: "1"): "${hoveredOpacity}"`);
    console.log(`- Hover-Only Text Display System 100% SUCCESS: ${normalOpacity === '0' && hoveredOpacity === '1'}`);
    console.log('-------------------------------------------------------------');

    await browser.close();
})();
