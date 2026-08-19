const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

    await page.goto('http://localhost:8080/index_v2.html', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#gridBoard .cell', { state: 'attached', timeout: 10000 });

    // Step 1: Place a 1x2 Plains land card directly via engine at (1,2)-(1,3)
    const step1Result = await page.evaluate(() => {
        const drawSys = new Step1DrawSystem(window.state);
        const master = drawSys.getLandCardMaster();
        const plains1x2 = master.find(c => c.id === "CARD_PLAINS_1X2");
        
        // Place 1x2 at (1, 2)
        const res = window.state.placeShape(1, 2, plains1x2.shape, plains1x2, 0);
        return {
            res,
            logs: window.state.gameLogs || []
        };
    });

    // Check if "連結" appeared on single 1x2 card placement (should NOT appear!)
    const hasFalseConnectionLog = step1Result.logs.some(log => log.includes('連結') || log.includes('ボーナス'));

    // Step 2: Place a separate 1x1 Plains land card adjacent at (1, 1)
    const step2Result = await page.evaluate(() => {
        const drawSys = new Step1DrawSystem(window.state);
        const master = drawSys.getLandCardMaster();
        const plains1x1 = master.find(c => c.id === "CARD_PLAINS_1X1");
        window.state.hasPickedThisTurn = false;
        
        // Place 1x1 at (1, 1) adjacent to (1, 2)
        const res = window.state.placeShape(1, 1, plains1x1.shape, plains1x1, 0);
        return {
            res,
            logs: window.state.gameLogs || []
        };
    });

    const hasTrueConnectionLog = step2Result.logs.some(log => log.includes('連結') || log.includes('ボーナス'));

    console.log('=============================================================');
    console.log('1x2 LAND CARD SELF-CONNECTION LOG FIX REAL MEASUREMENT');
    console.log('=============================================================');
    console.log('Step 1 Logs:', step1Result.logs);
    console.log('Step 2 Logs:', step2Result.logs);
    console.log(`- 1. Single 1x2 Placement False Connection Log (Expected: false): ${hasFalseConnectionLog}`);
    console.log(`- 2. Separate Card Adjacent Connection Log (Expected: true): ${hasTrueConnectionLog}`);
    console.log(`- Connection Log Contradiction Fix 100% SUCCESS: ${!hasFalseConnectionLog && hasTrueConnectionLog}`);
    console.log('-------------------------------------------------------------');

    await browser.close();
})();
