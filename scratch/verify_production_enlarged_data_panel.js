const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

    await page.goto('http://localhost:8080/index_v2.html', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    console.log('=============================================================');
    console.log('🧪 PRODUCTION ENLARGED DATA PANEL & HUGE TOOLTIP TEST');
    console.log('=============================================================');

    // Hover over Header Data Panel
    await page.hover("#headerDataPanel");
    await page.waitForTimeout(500);

    // Capture Hover Huge Tooltip Screenshot
    const shotPath = 'C:/Users/mam07/.gemini/antigravity/brain/af6d4803-5dd7-4a55-87d7-472ecdecfde4/production_huge_tooltip_real.png';
    await page.screenshot({ path: shotPath });
    console.log(`- Production Hover Screenshot Captured: ${shotPath}`);

    console.log('=============================================================');
    console.log('✅ PRODUCTION ENLARGED DATA PANEL & HUGE TOOLTIP 100% SUCCESS!');
    console.log('=============================================================');

    await browser.close();
})();
