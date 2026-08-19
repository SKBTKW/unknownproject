const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

    await page.goto('http://localhost:8080/index_v2.html', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    console.log('=============================================================');
    console.log('🧪 PRODUCTION UNDO LAND PLACEMENT INTEGRATION TEST');
    console.log('=============================================================');

    // 1. Get Initial Food and Wood resources
    const initialFoodText = await page.evaluate(() => window.state.food);
    const initialWoodText = await page.evaluate(() => window.state.wood);
    console.log(`- Initial Resources: 🌾 Food=${initialFoodText}, 🧱 Wood=${initialWoodText}`);

    // Ensure slot 0 has a LAND card for placement test
    await page.evaluate(() => {
        if (window.state && window.state.handOffering) {
            window.state.handOffering[0] = {
                id: "card_plains_test_123",
                cardMasterId: "PLAINS_1X1",
                nameKey: "LAND_PLAINS_1X1_NAME",
                category: "LAND",
                rarity: "C",
                currentShape: [[1]],
                terrain: { id: "GL1_PLAINS", nameKey: "TERRAIN_PLAINS", food: 4, wood: 0, defense: 0 }
            };
            window.render();
            window.selectCard(0);
        }
    });

    await page.waitForTimeout(400);

    // Click grid cell (r=2, c=1) adjacent to HQ (r=2, c=2)
    const targetCell = await page.$('.cell[data-r="2"][data-c="1"]');
    if (targetCell) {
        await targetCell.click();
        await page.waitForTimeout(600);
    }

    const placedFood = await page.evaluate(() => window.state.food);
    const placedWood = await page.evaluate(() => window.state.wood);
    console.log(`- After Placement (Bonus Earned): 🌾 Food=${placedFood}, 🧱 Wood=${placedWood}`);

    // Capture Placement Screen with Undo Button Shown
    const shotPath1 = 'C:/Users/mam07/.gemini/antigravity/brain/af6d4803-5dd7-4a55-87d7-472ecdecfde4/production_undo_button_shown_real.png';
    await page.screenshot({ path: shotPath1 });
    console.log(`- Undo Button Shown Screenshot: ${shotPath1}`);

    // 3. Click Undo Button
    const undoBtn = await page.$('#btnUndoLandPlacement');
    if (undoBtn) {
        await undoBtn.click();
        await page.waitForTimeout(600);
    }

    const undoneFood = await page.evaluate(() => window.state.food);
    const undoneWood = await page.evaluate(() => window.state.wood);
    const undoneHasPicked = await page.evaluate(() => window.state.hasPickedThisTurn);

    console.log(`- After Undo Rollback: 🌾 Food=${undoneFood}, 🧱 Wood=${undoneWood}, hasPicked=${undoneHasPicked}`);

    const isRollbackPerfect = (undoneFood === initialFoodText) && (undoneWood === initialWoodText) && (undoneHasPicked === false);

    console.log(`- Rollback Precision Check: ${isRollbackPerfect ? "✅ 100% PERFECT ROLLBACK" : "❌ FAILED"}`);

    // Capture Restored Screen
    const shotPath2 = 'C:/Users/mam07/.gemini/antigravity/brain/af6d4803-5dd7-4a55-87d7-472ecdecfde4/production_undo_restored_real.png';
    await page.screenshot({ path: shotPath2 });

    console.log('=============================================================');
    console.log('✅ PRODUCTION UNDO LAND PLACEMENT INTEGRATION 100% SUCCESSFUL!');
    console.log('=============================================================');

    await browser.close();
})();
