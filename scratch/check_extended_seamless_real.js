const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

    await page.goto('http://localhost:8080/index_v2.html', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#gridBoard .cell', { state: 'attached', timeout: 10000 });

    // Step 1: Place a 1x2 Vertical Prairie at B3, B4 -> (2,1), (3,1)
    await page.evaluate(() => {
        const drawSys = new Step1DrawSystem(window.state);
        const master = drawSys.getLandCardMaster();
        const plains1x2 = master.find(c => c.id === "CARD_PLAINS_1X2" || c.terrainId === "GL1_PLAINS");
        
        window.state.placeShape(2, 1, [[1], [1]], plains1x2, 0);
        render();
    });

    // Step 2: Place a 1x1 Prairie at B2 -> (1,1) adjacent to B3 (2,1) -> Extends seamless territory to 3 cells!
    await page.evaluate(() => {
        const drawSys = new Step1DrawSystem(window.state);
        const master = drawSys.getLandCardMaster();
        const plains1x1 = master.find(c => c.id === "CARD_PLAINS_1X1" || c.terrainId === "GL1_PLAINS");
        
        window.state.hasPickedThisTurn = false;
        window.state.placeShape(1, 1, [[1]], plains1x1, 0);
        render();
    });

    const screenshotPath = 'C:/Users/mam07/.gemini/antigravity/brain/af6d4803-5dd7-4a55-87d7-472ecdecfde4/extended_seamless_prairie_real.png';
    await page.screenshot({ path: screenshotPath });

    const seamlessData = await page.evaluate(() => {
        const cellB2 = document.querySelector('.cell[data-r="1"][data-c="1"]');
        const cellB3 = document.querySelector('.cell[data-r="2"][data-c="1"]');
        const cellB4 = document.querySelector('.cell[data-r="3"][data-c="1"]');

        return {
            b2BorderBottomStyle: cellB2 ? window.getComputedStyle(cellB2).borderBottomStyle : '',
            b3BorderTopStyle: cellB3 ? window.getComputedStyle(cellB3).borderTopStyle : '',
            b3BorderBottomStyle: cellB3 ? window.getComputedStyle(cellB3).borderBottomStyle : '',
            b4BorderTopStyle: cellB4 ? window.getComputedStyle(cellB4).borderTopStyle : ''
        };
    });

    console.log('=============================================================');
    console.log('EXTENDED SEAMLESS TERRITORY (1x2 + 1x1 CONNECTED) REAL MEASUREMENT');
    console.log('=============================================================');
    console.log(`- B2-B3 Boundary BorderBottomStyle (Expected: "none"): "${seamlessData.b2BorderBottomStyle}"`);
    console.log(`- B3-B4 Boundary BorderBottomStyle (Expected: "none"): "${seamlessData.b3BorderBottomStyle}"`);
    console.log(`- Extended Seamless Connection 100% SUCCESS: ${seamlessData.b2BorderBottomStyle === 'none' && seamlessData.b3BorderBottomStyle === 'none'}`);
    console.log('-------------------------------------------------------------');

    await browser.close();
})();
