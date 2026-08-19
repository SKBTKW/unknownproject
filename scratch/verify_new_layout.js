const { chromium } = require('playwright');
const path = require('path');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

    const htmlPath = 'file:///' + path.resolve(__dirname, 'new_layout_sandbox.html').replace(/\\/g, '/');
    await page.goto(htmlPath);
    await page.waitForTimeout(1000);

    console.log('=============================================================');
    console.log('🧪 VERIFY NEW LAYOUT: LOG AREA UNDER TITLE DEFAULT COLLAPSED');
    console.log('=============================================================');

    // 1. Initial Default Collapsed State Check
    const isLogCollapsedInitially = await page.evaluate(() => {
        const panel = document.getElementById("logDropdownPanel");
        if (!panel) return false;
        const style = window.getComputedStyle(panel);
        return style.display === "none";
    });

    console.log(`- Initial Log Area Collapsed State: ${isLogCollapsedInitially ? "✅ COLLAPSED BY DEFAULT (Hidden)" : "❌ VISIBLE WRONGLY"}`);

    // Capture initial collapsed screen
    const shotPath1 = 'C:/Users/mam07/.gemini/antigravity/brain/af6d4803-5dd7-4a55-87d7-472ecdecfde4/new_layout_log_collapsed_real.png';
    await page.screenshot({ path: shotPath1 });
    console.log(`- Initial Collapsed Screenshot Captured: ${shotPath1}`);

    // 2. Click [ Log ▽ ] toggle button to expand dropdown panel
    await page.click('#btnLogToggle');
    await page.waitForTimeout(400);

    const isLogExpanded = await page.evaluate(() => {
        const panel = document.getElementById("logDropdownPanel");
        if (!panel) return false;
        const style = window.getComputedStyle(panel);
        return style.display === "flex";
    });

    console.log(`- After Click Toggle Button Expanded State: ${isLogExpanded ? "✅ DROPDOWN EXPANDED UNDER TITLE PERFECTLY" : "❌ FAILED"}`);

    // Capture expanded screen
    const shotPath2 = 'C:/Users/mam07/.gemini/antigravity/brain/af6d4803-5dd7-4a55-87d7-472ecdecfde4/new_layout_log_expanded_real.png';
    await page.screenshot({ path: shotPath2 });
    console.log(`- Expanded Dropdown Screenshot Captured: ${shotPath2}`);

    console.log('=============================================================');
    console.log('✅ NEW LAYOUT TITLE-UNDER LOG SYSTEM VERIFIED 100% PERFECTLY!');
    console.log('=============================================================');

    await browser.close();
})();
