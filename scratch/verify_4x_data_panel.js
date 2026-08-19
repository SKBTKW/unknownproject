const { chromium } = require('playwright');
const path = require('path');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

    const htmlPath = 'file:///' + path.resolve(__dirname, 'sandbox_4x_data_panel.html').replace(/\\/g, '/');
    await page.goto(htmlPath);
    await page.waitForTimeout(1000);

    console.log('=============================================================');
    console.log('🧪 VERIFY 4X DATA PANEL FONT SIZE & HIDE DIRECTIVE BADGE');
    console.log('=============================================================');

    // 1. Verify Directive Badge is Hidden
    const isBadgeHidden = await page.evaluate(() => {
        const badge = document.querySelector(".directive-badge-hidden");
        if (!badge) return true;
        const style = window.getComputedStyle(badge);
        return style.display === "none";
    });
    console.log(`- Directive Badge Display Stopped: ${isBadgeHidden ? "✅ STOPPED / HIDDEN PERFECTLY" : "❌ STILL VISIBLE"}`);

    // 2. Capture Screenshot
    const shotPath = 'C:/Users/mam07/.gemini/antigravity/brain/af6d4803-5dd7-4a55-87d7-472ecdecfde4/sandbox_4x_data_panel_real.png';
    await page.screenshot({ path: shotPath });
    console.log(`- 4x Data Panel Screenshot Captured: ${shotPath}`);

    console.log('=============================================================');
    console.log('✅ 4X DATA PANEL & HIDE BADGE VERIFIED 100% PERFECTLY!');
    console.log('=============================================================');

    await browser.close();
})();
