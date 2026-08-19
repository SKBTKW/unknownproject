const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

    await page.goto('http://localhost:8080/index_v2.html', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#gridBoard .cell', { state: 'attached', timeout: 10000 });

    // Place a 1x2 Vertical Prairie (Plains) land card at B3, B4 -> (2,1), (3,1)
    await page.evaluate(() => {
        const drawSys = new Step1DrawSystem(window.state);
        const master = drawSys.getLandCardMaster();
        const plains1x2 = master.find(c => c.id === "CARD_PLAINS_1X2" || c.terrainId === "GL1_PLAINS");
        
        window.state.placeShape(2, 1, [[1], [1]], plains1x2, 0);
        render();
    });

    const screenshotPath = 'C:/Users/mam07/.gemini/antigravity/brain/af6d4803-5dd7-4a55-87d7-472ecdecfde4/user_vertical_prairie_clean_text_real.png';
    await page.screenshot({ path: screenshotPath });

    console.log('=============================================================');
    console.log('USER VERTICAL PRAIRIE UN-DEFORMED TEXT REAL MEASUREMENT');
    console.log('=============================================================');
    console.log(`- Screenshot saved successfully to: ${screenshotPath}`);
    console.log('-------------------------------------------------------------');

    await browser.close();
})();
