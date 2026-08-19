const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

    await page.goto('http://localhost:8080/index_v2.html', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#gridBoard .cell', { state: 'attached', timeout: 10000 });

    // Reproduce user's exact scenario:
    // 1. Place 1x2 Prairie at D3, D4 -> (2,3), (3,3)
    // 2. Reserve / restore operations
    // 3. Place another 1x2 Prairie at D2, E2 -> (1,3), (1,4) to form 2x2 merged core with E3 -> (2,4)
    await page.evaluate(() => {
        const drawSys = new Step1DrawSystem(window.state);
        const master = drawSys.getLandCardMaster();
        const plains1x2 = master.find(c => c.id === "CARD_PLAINS_1X2" || c.terrainId === "GL1_PLAINS");

        // Place at D3, D4
        window.state.placeShape(2, 3, [[1], [1]], plains1x2, 0);

        // Reserve & restore simulation
        window.state.hasPickedThisTurn = false;
        
        // Place at D2, E2 (1,3) & (1,4)
        window.state.placeShape(1, 3, [[1, 1]], plains1x2, 0);

        // Place at E3 (2,4)
        window.state.hasPickedThisTurn = false;
        window.state.placeShape(2, 4, [[1]], plains1x2, 0);

        render();
    });

    const screenshotPath = 'C:/Users/mam07/.gemini/antigravity/brain/af6d4803-5dd7-4a55-87d7-472ecdecfde4/user_exact_bugfix_clean_real.png';
    await page.screenshot({ path: screenshotPath });

    const verificationData = await page.evaluate(() => {
        const d2Cell = document.querySelector('.cell[data-r="1"][data-c="3"]');
        const d3Cell = document.querySelector('.cell[data-r="2"][data-c="3"]');
        const e2Cell = document.querySelector('.cell[data-r="1"][data-c="4"]');
        const e3Cell = document.querySelector('.cell[data-r="2"][data-c="4"]');

        const d2Text = d2Cell ? d2Cell.innerText : '';
        const d3Text = d3Cell ? d3Cell.innerText : '';
        const e2Text = e2Cell ? e2Cell.innerText : '';
        const e3Text = e3Cell ? e3Cell.innerText : '';

        const logs = window.state.gameLogs || [];
        const connectionLogs = logs.filter(l => l.includes('連結成立'));

        return {
            d2Text, d3Text, e2Text, e3Text,
            totalLogs: logs.length,
            connectionLogsCount: connectionLogs.length,
            connectionLogs
        };
    });

    console.log('=============================================================');
    console.log('USER EXACT BUGFIX (TEXT DISAPPEARANCE & DUPLICATE LOGS) REAL MEASUREMENT');
    console.log('=============================================================');
    console.log(`- D2 Cell Text (Expected contains "草原"): "${verificationData.d2Text}"`);
    console.log(`- D3 Cell Text (Expected contains "草原"): "${verificationData.d3Text}"`);
    console.log(`- E2 Cell Text (Expected contains "草原"): "${verificationData.e2Text}"`);
    console.log(`- E3 Cell Text (Expected contains "草原"): "${verificationData.e3Text}"`);
    console.log(`- Connection Logs Count (No duplicates): ${verificationData.connectionLogsCount}`);
    console.log(`- All Cell Texts Present: ${Boolean(verificationData.d2Text && verificationData.d3Text && verificationData.e2Text && verificationData.e3Text)}`);
    console.log('-------------------------------------------------------------');

    await browser.close();
})();
