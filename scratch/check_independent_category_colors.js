const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

    await page.goto('http://localhost:8080/index_v2.html', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#gridBoard .cell', { state: 'attached', timeout: 10000 });

    // Place different land categories on board:
    // A2: Plains (GL1_PLAINS) -> Emerald
    // B2: Forest (GL2_FOREST) -> Deep Green
    // D2: Mountain (H3_MOUNTAIN) -> Slate Gray
    // E2: Desert (GL0_DESERT) -> Golden Amber
    await page.evaluate(() => {
        const plains = { id: "CARD_PLAINS_1X1", terrainId: "GL1_PLAINS", nameKey: "TERRAIN_GL1_PLAINS", shape: [[1]] };
        const forest = { id: "CARD_FOREST_1X1", terrainId: "GL2_FOREST", nameKey: "TERRAIN_GL2_FOREST", shape: [[1]] };
        const mountain = { id: "CARD_MOUNTAIN_1X1", terrainId: "H3_MOUNTAIN", nameKey: "TERRAIN_H3_MOUNTAIN", shape: [[1]] };
        const desert = { id: "CARD_DESERT_1X1", terrainId: "GL0_DESERT", nameKey: "TERRAIN_GL0_DESERT", shape: [[1]] };

        // (2,1) = B3 is HQ Vicinity (HQ is 2,2)
        window.state.hasPickedThisTurn = false;
        window.state.placeShape(2, 1, [[1]], plains, 0);

        // (1,2) = C2 is HQ Vicinity
        window.state.hasPickedThisTurn = false;
        window.state.placeShape(1, 2, [[1]], forest, 0);

        // (2,3) = D3 is HQ Vicinity
        window.state.hasPickedThisTurn = false;
        window.state.placeShape(2, 3, [[1]], mountain, 0);

        // (3,2) = C4 is HQ Vicinity
        window.state.hasPickedThisTurn = false;
        window.state.placeShape(3, 2, [[1]], desert, 0);

        render();
    });

    const screenshotPath = 'C:/Users/mam07/.gemini/antigravity/brain/af6d4803-5dd7-4a55-87d7-472ecdecfde4/independent_category_colors_real.png';
    await page.screenshot({ path: screenshotPath });

    const colorData = await page.evaluate(() => {
        const plainsCell = document.querySelector('.cell[data-r="2"][data-c="1"]');
        const forestCell = document.querySelector('.cell[data-r="1"][data-c="2"]');
        const mountainCell = document.querySelector('.cell[data-r="2"][data-c="3"]');
        const desertCell = document.querySelector('.cell[data-r="3"][data-c="2"]');

        return {
            plainsHasClass: plainsCell ? plainsCell.classList.contains('terrain-plains') : false,
            forestHasClass: forestCell ? forestCell.classList.contains('terrain-forest') : false,
            mountainHasClass: mountainCell ? mountainCell.classList.contains('terrain-mountain') : false,
            desertHasClass: desertCell ? desertCell.classList.contains('terrain-desert') : false,
            plainsBg: plainsCell ? window.getComputedStyle(plainsCell).backgroundImage : '',
            forestBg: forestCell ? window.getComputedStyle(forestCell).backgroundImage : '',
            mountainBg: mountainCell ? window.getComputedStyle(mountainCell).backgroundImage : '',
            desertBg: desertCell ? window.getComputedStyle(desertCell).backgroundImage : ''
        };
    });

    console.log('=============================================================');
    console.log('INDEPENDENT CATEGORY TERRAIN COLORS REAL MEASUREMENT');
    console.log('=============================================================');
    console.log(`- Plains Terrain Class (Expected: true): ${colorData.plainsHasClass}`);
    console.log(`- Forest Terrain Class (Expected: true): ${colorData.forestHasClass}`);
    console.log(`- Mountain Terrain Class (Expected: true): ${colorData.mountainHasClass}`);
    console.log(`- Desert Terrain Class (Expected: true): ${colorData.desertHasClass}`);
    console.log(`- Independent Category Colors 100% SUCCESS: ${colorData.plainsHasClass && colorData.forestHasClass && colorData.mountainHasClass && colorData.desertHasClass}`);
    console.log('-------------------------------------------------------------');

    await browser.close();
})();
