const { chromium } = require('playwright');
const path = require('path');

(async () => {
    console.log("=== FULL SYSTEM & JSON SYSTEM AUDIT ===");
    try {
        const browser = await chromium.launch();
        const page = await browser.newPage();

        const errors = [];
        page.on('console', msg => {
            if (msg.type() === 'error') errors.push(msg.text());
        });
        page.on('pageerror', err => errors.push(err.stack));

        const htmlPath = 'file:///' + path.resolve('./game/index_v2.html').replace(/\\/g, '/');
        await page.goto(htmlPath);
        await page.waitForTimeout(1000);

        // 1. JSON マスターデータ読み込みチェック
        const masterCount = await page.evaluate(() => {
            return window.LAND_CARDS_DATA ? window.LAND_CARDS_DATA.length : 0;
        });

        const activeMasterCount = await page.evaluate(() => {
            if (!window.state || !window.Step1Engine) return 0;
            const sys = new window.Step1Engine.Step1DrawSystem(window.state);
            return sys.getLandCardMaster().length;
        });

        console.log("1. JSON Load System Verification:");
        console.log(" - window.LAND_CARDS_DATA count:", masterCount);
        console.log(" - Engine Master Cards count:", activeMasterCount);

        // 2. カード回転 ＆ 選択 ＆ 配置テスト
        console.log("2. Card Selection & Placement Test:");
        await page.evaluate(() => {
            if (typeof selectCard === 'function') {
                selectCard(0);
            }
        });
        const isSelected = await page.evaluate(() => typeof selectedCardIdx !== 'undefined' && selectedCardIdx === 0);
        console.log(" - Card 0 selected?:", isSelected ? "PASS ✅" : "FAIL ❌");

        // 本営 (r=2, c=2) に隣接する有効な空きマスを動的に探索して配置テスト
        await page.evaluate(() => {
            if (!selectedCard || !state) return;
            const shape = selectedCard.currentShape;
            for (let r = 0; r < 5; r++) {
                for (let c = 0; c < 5; c++) {
                    const check = state.canPlaceShape(r, c, shape);
                    if (check && check.can) {
                        onCellClick(r, c);
                        return;
                    }
                }
            }
        });
        await page.waitForTimeout(500);

        const placedCellCount = await page.locator('.cell.placed').count();
        console.log(" - Placed cells on board count (including HQ):", placedCellCount, (placedCellCount >= 2) ? "PASS ✅ (Tile placed successfully!)" : "FAIL ❌");

        // 3. 保留 (Reserve) 機能テスト
        console.log("3. Reserve Feature Test:");
        await page.evaluate(() => {
            if (typeof reserveCard === 'function') {
                reserveCard(1);
            }
        });
        await page.waitForTimeout(500);
        const reservedCardsCount = await page.evaluate(() => {
            return window.state ? window.state.reserveSlots.filter(c => c !== null).length : 0;
        });
        console.log(" - Reserved Cards in Slot Count:", reservedCardsCount);

        // 4. マリガン (Mulligan) テスト
        console.log("4. Mulligan Feature Test:");
        const emberBefore = await page.evaluate(() => window.state ? window.state.ember : 0);
        await page.evaluate(() => {
            if (typeof mulligan === 'function') {
                mulligan();
            }
        });
        await page.waitForTimeout(500);
        const emberAfter = await page.evaluate(() => window.state ? window.state.ember : 0);
        console.log(" - Ember cost deducted after Mulligan?:", (emberBefore - emberAfter === 1) ? "PASS ✅ (-1 Ember)" : `FAIL ❌ (before=${emberBefore}, after=${emberAfter})`);

        // 5. ターン経過 (TURN END) テスト
        console.log("5. Turn End Feature Test:");
        await page.evaluate(() => {
            if (typeof nextTurn === 'function') {
                nextTurn();
            }
        });
        await page.waitForTimeout(500);
        const turnVal = await page.evaluate(() => window.state ? window.state.turn : 0);
        console.log(" - Current Turn after TURN END:", turnVal, (turnVal === 2) ? "PASS ✅" : "FAIL ❌");

        // エラーチェック総括
        console.log("\n=== CONSOLE ERROR AUDIT ===");
        if (errors.length === 0) {
            console.log("✅ ZERO CONSOLE ERRORS DETECTED!");
        } else {
            console.error("❌ ERRORS FOUND:", errors);
        }

        await browser.close();
    } catch(e) {
        console.error("Audit Execution Error:", e);
    }
})();
