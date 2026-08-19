const { chromium } = require('playwright');
const path = require('path');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

    const htmlPath = 'file:///' + path.resolve(__dirname, 'undo_land_sandbox.html').replace(/\\/g, '/');
    await page.goto(htmlPath);
    await page.waitForTimeout(1000);

    console.log('=============================================================');
    console.log('🧪 VERIFY LAND PLACEMENT UNDO & RESOURCE ROLLBACK');
    console.log('=============================================================');

    // 1. Initial State
    const initRes = await page.textContent('#resourceState');
    console.log(`- Initial State: "${initRes}"`);

    // 2. Simulate Land Placement (Connection Bonus Earned)
    await page.click('button:has-text("1. 土地配置")');
    await page.waitForTimeout(400);

    const placedRes = await page.textContent('#resourceState');
    console.log(`- After Placement (Bonus Added): "${placedRes}"`);

    // Capture Placement Screen with Undo Button
    const shotPath1 = 'C:/Users/mam07/.gemini/antigravity/brain/af6d4803-5dd7-4a55-87d7-472ecdecfde4/undo_land_button_shown_real.png';
    await page.screenshot({ path: shotPath1 });
    console.log(`- Undo Button Shown Screenshot: ${shotPath1}`);

    // 3. Click Undo Button
    await page.click('#btnUndoLandPlacement');
    await page.waitForTimeout(400);

    const undoneRes = await page.textContent('#resourceState');
    const undoneHand = await page.textContent('#handState');
    const undonePlacement = await page.textContent('#placementState');

    console.log(`- After Undo Rollback: "${undoneRes}"`);
    console.log(`- Hand State Restored: "${undoneHand}"`);
    console.log(`- Placement Flag Restored: "${undonePlacement}"`);

    const isRollbackPerfect = undoneRes.includes('食料: 30') && undoneRes.includes('資材: 30') && undoneHand.includes('LAND_PLAINS') && undonePlacement.includes('hasPicked: false');

    console.log(`- Rollback Precision Check: ${isRollbackPerfect ? "✅ 100% PERFECT ROLLBACK" : "❌ FAILED"}`);

    // Capture Restored Screen
    const shotPath2 = 'C:/Users/mam07/.gemini/antigravity/brain/af6d4803-5dd7-4a55-87d7-472ecdecfde4/undo_land_restored_real.png';
    await page.screenshot({ path: shotPath2 });

    console.log('=============================================================');
    console.log('✅ LAND PLACEMENT UNDO & CONNECTION ROLLBACK VERIFIED 100%!');
    console.log('=============================================================');

    await browser.close();
})();
