const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

    await page.goto('http://localhost:8080/index_v2.html', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#gridBoard .cell', { state: 'attached', timeout: 10000 });

    // Step 1: Inject a 1x2 Vertical Hill card into slot 0
    await page.evaluate(() => {
        const drawSys = new Step1DrawSystem(window.state);
        const master = drawSys.getLandCardMaster();
        const hill1x2 = master.find(c => c.id === "CARD_HILL_1X2" || (c.terrainId === "H2_HILL" && (c.shape.length > 1 || c.shape[0].length > 1)));
        
        // Ensure vertical shape [[1], [1]]
        hill1x2.currentShape = [[1], [1]];
        if (hill1x2) window.state.handOffering[0] = hill1x2;
        render();
    });

    // Place vertical 1x2 Hill at D2, D3 -> r=1, c=3 & r=2, c=3
    await page.evaluate(() => {
        const drawSys = new Step1DrawSystem(window.state);
        const master = drawSys.getLandCardMaster();
        const hill1x2 = master.find(c => c.id === "CARD_HILL_1X2" || c.terrainId === "H2_HILL");
        
        window.state.placeShape(1, 3, [[1], [1]], hill1x2, 0);
        render();
    });

    const testData = await page.evaluate(() => {
        const topCell = document.querySelector('.cell[data-r="1"][data-c="3"]');
        const bottomCell = document.querySelector('.cell[data-r="2"][data-c="3"]');
        const logs = window.state.gameLogs || [];

        const gridTop = window.state.grid[1][3];
        const gridBottom = window.state.grid[2][3];

        return {
            topPlacementId: gridTop ? gridTop.placementGroupId : null,
            bottomPlacementId: gridBottom ? gridBottom.placementGroupId : null,
            topBorderBottom: topCell ? window.getComputedStyle(topCell).borderBottomStyle : '',
            bottomBorderTop: bottomCell ? window.getComputedStyle(bottomCell).borderTopStyle : '',
            topClasses: topCell ? topCell.className : '',
            bottomClasses: bottomCell ? bottomCell.className : '',
            logs,
            hasConnectionLog: logs.some(l => l.includes('連結'))
        };
    });

    const screenshotPath = 'C:/Users/mam07/.gemini/antigravity/brain/af6d4803-5dd7-4a55-87d7-472ecdecfde4/user_exact_hill_1x2_real.png';
    await page.screenshot({ path: screenshotPath });

    console.log('=============================================================');
    console.log('USER EXACT SCENARIO (VERTICAL 1x2 HILL AT D2-D3) REAL MEASUREMENT');
    console.log('=============================================================');
    console.log('TestData Details:', testData);
    console.log('Logs after placing 1x2 Hill:', testData.logs);
    console.log(`- 1. Top Cell BorderBottomStyle (Expected: "none"): "${testData.topBorderBottom}"`);
    console.log(`- 2. Bottom Cell BorderTopStyle (Expected: "none"): "${testData.bottomBorderTop}"`);
    console.log(`- 3. False Connection Log (Expected: false): ${testData.hasConnectionLog}`);
    console.log(`- User Exact Scenario 100% SUCCESS: ${testData.topBorderBottom === 'none' && !testData.hasConnectionLog}`);
    console.log('-------------------------------------------------------------');

    await browser.close();
})();
