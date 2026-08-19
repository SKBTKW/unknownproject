const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

    await page.goto('http://localhost:8080/index_v2.html', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#gridBoard .cell', { state: 'attached', timeout: 10000 });

    // Place a 1x2 Hill land card at D2, D3 -> (1,3), (2,3)
    await page.evaluate(() => {
        const drawSys = new Step1DrawSystem(window.state);
        const master = drawSys.getLandCardMaster();
        const hill1x2 = master.find(c => c.id === "CARD_HILL_1X2" || c.terrainId === "H2_HILL");
        
        window.state.placeShape(1, 3, [[1], [1]], hill1x2, 0);
        render();
    });

    const screenshotPath = 'C:/Users/mam07/.gemini/antigravity/brain/af6d4803-5dd7-4a55-87d7-472ecdecfde4/log_dim_1x2_format_real.png';
    await page.screenshot({ path: screenshotPath });

    const logsData = await page.evaluate(() => window.state.gameLogs || []);
    const placementLog = logsData.find(l => l.includes('土地配置'));

    console.log('=============================================================');
    console.log('LAND PLACEMENT LOG WITH (1x2) DIMENSION SUFFIX REAL MEASUREMENT');
    console.log('=============================================================');
    console.log('Placement Log:', placementLog);
    console.log(`- Dimension Suffix (1x2) Included (Expected: true): ${placementLog ? placementLog.includes('(1x2)') : false}`);
    console.log('-------------------------------------------------------------');

    await browser.close();
})();
