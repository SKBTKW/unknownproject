const { chromium } = require('playwright');
const path = require('path');

(async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    const htmlPath = 'file:///' + path.resolve(__dirname, '../game/index_v2.html').replace(/\\/g, '/');
    await page.goto(htmlPath);
    await page.waitForTimeout(1000);

    console.log("=== STAGE-PROGRESSIVE BLOCK UNLOCK AUDIT ===");
    const testRes = await page.evaluate(() => {
        if (!window.state) return { error: "No state" };
        
        let stage1LargeCardCount = 0; // Stage 1で1x3以上が出たカウント
        let stage1MountainCount = 0;

        // 1. Stage 1 (5x5 盤面) で 100 回ドローテスト
        window.state.stage = { id: 1, name: "Stage 1" };
        for (let i = 0; i < 100; i++) {
            if (window.drawSys) window.drawSys.generateOfferingCards();
            for (let card of window.state.handOffering) {
                if (card && !card.isBlank) {
                    const shape = card.shape || (card.terrain ? card.terrain.shape : [[1]]);
                    const cellCount = sumShape(shape);
                    if (cellCount >= 3) stage1LargeCardCount++;
                    if (card.id.includes("MOUNTAIN") || (card.terrain && card.terrain.h === 3)) stage1MountainCount++;
                }
            }
        }

        // 2. Stage 2 (7x7 盤面) で 100 回ドローテスト (H2>=3条件)
        window.state.stage = { id: 2, name: "Stage 2" };
        window.state.grid[0][0] = { placed: true, isHQ: false, terrain: { id: "H2_HILL" } };
        window.state.grid[0][1] = { placed: true, isHQ: false, terrain: { id: "H2_HILL" } };
        window.state.grid[0][2] = { placed: true, isHQ: false, terrain: { id: "H2_HILL" } };

        let stage2LargeCardCount = 0;
        let stage2MountainCount = 0;
        for (let i = 0; i < 100; i++) {
            if (window.drawSys) window.drawSys.generateOfferingCards();
            for (let card of window.state.handOffering) {
                if (card && !card.isBlank) {
                    const shape = card.shape || (card.terrain ? card.terrain.shape : [[1]]);
                    const cellCount = sumShape(shape);
                    if (cellCount >= 3) stage2LargeCardCount++;
                    if (card.id.includes("MOUNTAIN") || (card.terrain && card.terrain.h === 3)) stage2MountainCount++;
                }
            }
        }

        function sumShape(s) {
            if (!s) return 0;
            return s.reduce((acc, row) => acc + row.reduce((a, b) => a + b, 0), 0);
        }

        return { stage1LargeCardCount, stage1MountainCount, stage2LargeCardCount, stage2MountainCount };
    });

    console.log(" - Stage 1 Large Cards (1x3+) Count (Expected 0):", testRes.stage1LargeCardCount);
    console.log(" - Stage 1 Mountain Count (Expected 0):", testRes.stage1MountainCount);
    console.log(" - Stage 2 Unlocked Large Cards (1x3+) Count (Expected >0):", testRes.stage2LargeCardCount);
    console.log(" - Stage 2 Unlocked Mountain Count (Expected >0):", testRes.stage2MountainCount);

    const isPass = (testRes.stage1LargeCardCount === 0 && testRes.stage1MountainCount === 0 && testRes.stage2LargeCardCount > 0);
    console.log(" - Final Result:", isPass ? "PASS ✅ (Stage-progressive Unlocking Verified!)" : "FAIL ❌");

    await browser.close();
})();
