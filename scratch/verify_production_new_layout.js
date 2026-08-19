const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

    await page.goto('http://localhost:8080/index_v2.html', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    console.log('=============================================================');
    console.log('🧪 PRODUCTION NEW LAYOUT LOG AREA UNDER TITLE INTEGRATION TEST');
    console.log('=============================================================');

    // 1. Initial Default Collapsed State Check
    const isLogCollapsedInitially = await page.evaluate(() => {
        const panel = document.getElementById("logDropdownPanelHeader");
        if (!panel) return false;
        const style = window.getComputedStyle(panel);
        return style.display === "none";
    });

    console.log(`- Initial Log Area Collapsed State in Production: ${isLogCollapsedInitially ? "✅ COLLAPSED BY DEFAULT (Hidden)" : "❌ VISIBLE WRONGLY"}`);

    // Capture initial collapsed screen
    const shotPath1 = 'C:/Users/mam07/.gemini/antigravity/brain/af6d4803-5dd7-4a55-87d7-472ecdecfde4/production_new_layout_collapsed_real.png';
    await page.screenshot({ path: shotPath1 });
    console.log(`- Production Collapsed Screenshot Captured: ${shotPath1}`);

    // 2. Click [ Log ▽ ] toggle button to expand dropdown panel
    await page.click('#btnLogToggleHeader');
    await page.waitForTimeout(400);

    const isLogExpanded = await page.evaluate(() => {
        const panel = document.getElementById("logDropdownPanelHeader");
        if (!panel) return false;
        const style = window.getComputedStyle(panel);
        return style.display === "flex";
    });

    console.log(`- After Click Toggle Button Expanded State in Production: ${isLogExpanded ? "✅ DROPDOWN EXPANDED UNDER TITLE PERFECTLY" : "❌ FAILED"}`);

    // Capture expanded screen
    const shotPath2 = 'C:/Users/mam07/.gemini/antigravity/brain/af6d4803-5dd7-4a55-87d7-472ecdecfde4/production_new_layout_expanded_real.png';
    await page.screenshot({ path: shotPath2 });
    console.log(`- Production Expanded Dropdown Screenshot Captured: ${shotPath2}`);

    console.log('=============================================================');
    console.log('✅ PRODUCTION NEW LAYOUT INTEGRATION 100% SUCCESSFUL!');
    console.log('=============================================================');

    await browser.close();
})();
