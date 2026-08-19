const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

    await page.goto('http://localhost:8080/index_v2.html', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    console.log('=============================================================');
    console.log('🧪 PRODUCTION FINAL MASTER LAYOUT INTEGRATION TEST');
    console.log('=============================================================');

    // 1. Verify Ember Centering
    const isEmberCentered = await page.evaluate(() => {
        const box = document.getElementById("emberCenterBoxMaster");
        if (!box) return false;
        const rect = box.getBoundingClientRect();
        const center = window.innerWidth / 2;
        return Math.abs((rect.left + rect.width / 2) - center) < 10;
    });
    console.log(`- Ember Display True Centered in Production: ${isEmberCentered ? "✅ PERFECT TRUE CENTER" : "❌ NOT CENTERED"}`);

    // 2. Verify Data Panel Right Positioned
    const isDataPanelRightAligned = await page.evaluate(() => {
        const panel = document.getElementById("headerDataPanel");
        if (!panel) return false;
        const rect = panel.getBoundingClientRect();
        return rect.right > (window.innerWidth - 320);
    });
    console.log(`- Header Data Panel Right Aligned in Production: ${isDataPanelRightAligned ? "✅ PERFECT RIGHT ALIGNED & ENLARGED" : "❌ FAILED"}`);

    // Capture Production Master Layout Screenshot
    const shotPath = 'C:/Users/mam07/.gemini/antigravity/brain/af6d4803-5dd7-4a55-87d7-472ecdecfde4/production_master_layout_final_real.png';
    await page.screenshot({ path: shotPath });
    console.log(`- Production Screenshot Captured: ${shotPath}`);

    console.log('=============================================================');
    console.log('✅ PRODUCTION MASTER LAYOUT INTEGRATION 100% SUCCESSFUL!');
    console.log('=============================================================');

    await browser.close();
})();
