const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
    const browser = await chromium.launch();
    const context = await browser.newContext({ ignoreHTTPSErrors: true });
    const page = await context.newPage({ viewport: { width: 1400, height: 900 } });

    const htmlPath = 'file:///' + path.resolve(__dirname, 'sandbox_modular_ui_test.html').replace(/\\/g, '/') + '?t=' + Date.now();
    await page.goto(htmlPath, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    console.log('=============================================================');
    console.log('🧪 FORCE RE-VERIFY MODULAR UI COMPONENTS WITH FRESH CAPTURE');
    console.log('=============================================================');

    const shotPathOpenBoth = 'C:/Users/mam07/.gemini/antigravity/brain/af6d4803-5dd7-4a55-87d7-472ecdecfde4/sandbox_modular_open_both_fresh.png';
    if (fs.existsSync(shotPathOpenBoth)) fs.unlinkSync(shotPathOpenBoth);

    // 干渉を防ぐため、まずバフバーをクリックし、その後にログボタンをクリック
    await page.click('.buff-summary-bar');
    await page.waitForTimeout(300);
    await page.click('#btnLogToggleHeader');
    await page.waitForTimeout(500);

    await page.screenshot({ path: shotPathOpenBoth });
    console.log(`- Fresh Screenshot Captured: ${shotPathOpenBoth}`);

    console.log('=============================================================');
    console.log('✅ FRESH CAPTURE COMPLETED PERFECTLY!');
    console.log('=============================================================');

    await browser.close();
})();
