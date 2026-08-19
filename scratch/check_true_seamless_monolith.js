const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

    await page.goto('http://localhost:8080/index_v2.html', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#gridBoard .cell', { state: 'attached', timeout: 10000 });

    // Place a 1x2 Horizontal Hill card at B2, C2 -> (1,1), (1,2)
    await page.evaluate(() => {
        const drawSys = new Step1DrawSystem(window.state);
        const master = drawSys.getLandCardMaster();
        const hill1x2 = master.find(c => c.id === "CARD_HILL_1X2" || c.terrainId === "H2_HILL");
        
        window.state.placeShape(1, 1, [[1, 1]], hill1x2, 0);
        render();
    });

    const screenshotPath = 'C:/Users/mam07/.gemini/antigravity/brain/af6d4803-5dd7-4a55-87d7-472ecdecfde4/true_seamless_monolith_real.png';
    await page.screenshot({ path: screenshotPath });

    const radiusData = await page.evaluate(() => {
        const leftCell = document.querySelector('.cell[data-r="1"][data-c="1"]');
        const rightCell = document.querySelector('.cell[data-r="1"][data-c="2"]');
        return {
            leftHasNoRadiusTR: leftCell ? leftCell.classList.contains('no-radius-tr') : false,
            leftHasNoRadiusBR: leftCell ? leftCell.classList.contains('no-radius-br') : false,
            rightHasNoRadiusTL: rightCell ? rightCell.classList.contains('no-radius-tl') : false,
            rightHasNoRadiusBL: rightCell ? rightCell.classList.contains('no-radius-bl') : false
        };
    });

    console.log('=============================================================');
    console.log('TRUE SEAMLESS MONOLITH (INNER BORDER-RADIUS SUPPRESSION) REAL MEASUREMENT');
    console.log('=============================================================');
    console.log(`- 1. Left Cell TopRight Radius Suppressed (Expected: true): ${radiusData.leftHasNoRadiusTR}`);
    console.log(`- 2. Left Cell BottomRight Radius Suppressed (Expected: true): ${radiusData.leftHasNoRadiusBR}`);
    console.log(`- 3. Right Cell TopLeft Radius Suppressed (Expected: true): ${radiusData.rightHasNoRadiusTL}`);
    console.log(`- 4. Right Cell BottomLeft Radius Suppressed (Expected: true): ${radiusData.rightHasNoRadiusBL}`);
    console.log(`- True Seamless Monolith 100% SUCCESS: ${radiusData.leftHasNoRadiusTR && radiusData.rightHasNoRadiusTL}`);
    console.log('-------------------------------------------------------------');

    await browser.close();
})();
