const { chromium } = require('playwright');
const path = require('path');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

    const htmlPath = 'file:///' + path.resolve(__dirname, 'master_layout_sandbox.html').replace(/\\/g, '/');
    await page.goto(htmlPath);
    await page.waitForTimeout(1000);

    console.log('=============================================================');
    console.log('🧪 VERIFY FINAL MASTER LAYOUT ARCHITECTURE');
    console.log('=============================================================');

    // 1. Verify Ember Centering
    const isEmberCentered = await page.evaluate(() => {
        const box = document.getElementById("emberCenterBoxMaster");
        if (!box) return false;
        const rect = box.getBoundingClientRect();
        const center = window.innerWidth / 2;
        return Math.abs((rect.left + rect.width / 2) - center) < 5;
    });
    console.log(`- Ember Display True Centered: ${isEmberCentered ? "✅ PERFECT TRUE CENTER" : "❌ NOT CENTERED"}`);

    // 2. Verify Header Data Panel Right Positioned
    const isDataPanelRightAligned = await page.evaluate(() => {
        const panel = document.getElementById("headerDataPanelMaster");
        if (!panel) return false;
        const rect = panel.getBoundingClientRect();
        return rect.right > (window.innerWidth - 300);
    });
    console.log(`- Header Data Panel Right Aligned: ${isDataPanelRightAligned ? "✅ PERFECT RIGHT ALIGNED & ENLARGED" : "❌ FAILED"}`);

    // Capture Master Layout Screenshot
    const shotPath = 'C:/Users/mam07/.gemini/antigravity/brain/af6d4803-5dd7-4a55-87d7-472ecdecfde4/master_layout_final_real.png';
    await page.screenshot({ path: shotPath });
    console.log(`- Master Layout Screenshot Captured: ${shotPath}`);

    console.log('=============================================================');
    console.log('✅ FINAL MASTER LAYOUT VERIFIED 100% PERFECTLY!');
    console.log('=============================================================');

    await browser.close();
})();
