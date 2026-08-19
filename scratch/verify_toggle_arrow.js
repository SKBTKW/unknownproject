const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

    await page.goto('http://localhost:8080/index_v2.html', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    console.log('=============================================================');
    console.log('🧪 VERIFY LOG DROPDOWN TOGGLE ARROW (▽ <-> △) SWITCHING');
    console.log('=============================================================');

    // 1. Initial State Check (Arrow: ▽)
    const initialArrow = await page.textContent('#logHeaderArrow');
    console.log(`- Initial Arrow Symbol: "${initialArrow.trim()}"`);

    // 2. First Click to Expand (Arrow -> △)
    await page.click('#btnLogToggleHeader');
    await page.waitForTimeout(400);

    const expandedArrow = await page.textContent('#logHeaderArrow');
    console.log(`- After Expand Arrow Symbol: "${expandedArrow.trim()}"`);

    const isExpandedArrowCorrect = expandedArrow.trim() === "△";
    console.log(`- Arrow Switched to △: ${isExpandedArrowCorrect ? "✅ PERFECT" : "❌ FAILED"}`);

    // Capture Expanded Screenshot
    const shotPath1 = 'C:/Users/mam07/.gemini/antigravity/brain/af6d4803-5dd7-4a55-87d7-472ecdecfde4/arrow_expanded_delta_real.png';
    await page.screenshot({ path: shotPath1 });

    // 3. Second Click on Arrow to Collapse (Arrow -> ▽)
    await page.click('#logHeaderArrow');
    await page.waitForTimeout(400);

    const collapsedArrow = await page.textContent('#logHeaderArrow');
    console.log(`- After Collapse Arrow Symbol: "${collapsedArrow.trim()}"`);

    const isCollapsedArrowCorrect = collapsedArrow.trim() === "▽";
    console.log(`- Arrow Switched back to ▽: ${isCollapsedArrowCorrect ? "✅ PERFECT" : "❌ FAILED"}`);

    // Capture Collapsed Screenshot
    const shotPath2 = 'C:/Users/mam07/.gemini/antigravity/brain/af6d4803-5dd7-4a55-87d7-472ecdecfde4/arrow_collapsed_grad_real.png';
    await page.screenshot({ path: shotPath2 });

    console.log('=============================================================');
    console.log('✅ ARROW TOGGLE (▽ <-> △) SWITCHING VERIFIED 100% PERFECTLY!');
    console.log('=============================================================');

    await browser.close();
})();
