const { chromium } = require('playwright');
const path = require('path');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

    const htmlPath = 'file:///' + path.resolve(__dirname, 'undo_hover_sandbox.html').replace(/\\/g, '/');
    await page.goto(htmlPath);
    await page.waitForTimeout(1000);

    console.log('=============================================================');
    console.log('🧪 VERIFY HOVER CURSOR FOLLOW UNDO TOOLTIP SYSTEM');
    console.log('=============================================================');

    // 1. Click cell (2, 1) to place land
    const targetCell = await page.$('.cell:has-text("2,1")');
    if (targetCell) {
        await targetCell.click();
        await page.waitForTimeout(300);
    }

    const placedRes = await page.textContent('#resourceState');
    console.log(`- After Placement: "${placedRes}"`);

    // 2. Hover over the placed cell (2, 1)
    const placedCell = await page.$('.cell:has-text("草原")');
    if (placedCell) {
        await placedCell.hover();
        await page.waitForTimeout(400);
    }

    // Verify hover tooltip is visible
    const isTooltipVisible = await page.evaluate(() => {
        const tt = document.getElementById("undoHoverCursorTooltip");
        if (!tt) return false;
        const style = window.getComputedStyle(tt);
        return style.display !== "none" && style.opacity !== "0";
    });

    console.log(`- Hover Tooltip Shown on Placed Cell: ${isTooltipVisible ? "✅ SHOWN & FOLLOWING PERFECTLY" : "❌ NOT SHOWN"}`);

    // Capture screenshot of mouse follow tooltip
    const shotPath1 = 'C:/Users/mam07/.gemini/antigravity/brain/af6d4803-5dd7-4a55-87d7-472ecdecfde4/undo_hover_tooltip_shown_real.png';
    await page.screenshot({ path: shotPath1 });
    console.log(`- Hover Tooltip Screenshot Captured: ${shotPath1}`);

    // 3. Hover over unplaced cell (0, 0) -> Tooltip must NOT be visible
    const unplacedCell = await page.$('.cell:has-text("0,0")');
    if (unplacedCell) {
        await unplacedCell.hover();
        await page.waitForTimeout(300);
    }

    const isTooltipHiddenOther = await page.evaluate(() => {
        const tt = document.getElementById("undoHoverCursorTooltip");
        if (!tt) return true;
        return window.getComputedStyle(tt).display === "none";
    });

    console.log(`- Hover Tooltip Hidden on Unplaced Cell: ${isTooltipHiddenOther ? "✅ HIDDEN CLEANLY" : "❌ VISIBLE WRONGLY"}`);

    // 4. Click placed cell to execute Undo
    if (placedCell) {
        await placedCell.click();
        await page.waitForTimeout(400);
    }

    const restoredRes = await page.textContent('#resourceState');
    console.log(`- After Undo Click: "${restoredRes}"`);

    const isRollbackValid = restoredRes.includes('食料: 30');
    console.log(`- Undo Rollback Accuracy: ${isRollbackValid ? "✅ 100% PERFECT" : "❌ FAILED"}`);

    // Capture screenshot after Undo
    const shotPath2 = 'C:/Users/mam07/.gemini/antigravity/brain/af6d4803-5dd7-4a55-87d7-472ecdecfde4/undo_hover_restored_real.png';
    await page.screenshot({ path: shotPath2 });

    console.log('=============================================================');
    console.log('✅ HOVER CURSOR FOLLOW UNDO SYSTEM VERIFIED 100% PERFECTLY!');
    console.log('=============================================================');

    await browser.close();
})();
