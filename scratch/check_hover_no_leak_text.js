const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

    await page.goto('http://localhost:8080/index_v2.html', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#gridBoard .cell', { state: 'attached', timeout: 10000 });

    // Place a 1x2 Vertical Prairie land card at B3, B4 -> (2,1), (3,1)
    await page.evaluate(() => {
        const drawSys = new Step1DrawSystem(window.state);
        const master = drawSys.getLandCardMaster();
        const plains1x2 = master.find(c => c.id === "CARD_PLAINS_1X2" || c.terrainId === "GL1_PLAINS");
        
        window.state.placeShape(2, 1, [[1], [1]], plains1x2, 0);
        render();
    });

    // Hover over cell B3 -> (2, 1)
    await page.hover('.cell[data-r="2"][data-c="1"]');
    await page.waitForTimeout(300);

    const screenshotPath = 'C:/Users/mam07/.gemini/antigravity/brain/af6d4803-5dd7-4a55-87d7-472ecdecfde4/hover_no_leak_text_clean_real.png';
    await page.screenshot({ path: screenshotPath });

    const hoverData = await page.evaluate(() => {
        const cellTop = document.querySelector('.cell[data-r="2"][data-c="1"]');
        const cellBottom = document.querySelector('.cell[data-r="3"][data-c="1"]');
        const label = document.querySelector('.cell-text-label');

        return {
            topIsGroupHovered: cellTop ? cellTop.classList.contains('group-hovered') : false,
            bottomIsGroupHovered: cellBottom ? cellBottom.classList.contains('group-hovered') : false,
            labelZIndex: label ? window.getComputedStyle(label).zIndex : '',
            labelVisible: label ? label.offsetWidth > 0 : false
        };
    });

    console.log('=============================================================');
    console.log('HOVER LIGHT LEAK FIX & TEXT READABILITY REAL MEASUREMENT');
    console.log('=============================================================');
    console.log(`- 1. Top Cell Group Hovered (Expected: true): ${hoverData.topIsGroupHovered}`);
    console.log(`- 2. Bottom Cell Group Hovered (Expected: true): ${hoverData.bottomIsGroupHovered}`);
    console.log(`- 3. Label Z-Index (Expected: "20"): "${hoverData.labelZIndex}"`);
    console.log(`- Hover Light Leak Fix 100% SUCCESS: ${hoverData.topIsGroupHovered && hoverData.bottomIsGroupHovered && hoverData.labelZIndex === '20'}`);
    console.log('-------------------------------------------------------------');

    await browser.close();
})();
