const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    await page.goto('http://localhost:8000/game/index_v2.html');
    await page.waitForTimeout(500);

    const testResults = await page.evaluate(() => {
        // Stage 1, 2, 3 の形状抽出生成テスト
        state.stage = 3;
        drawSys.generateOfferingCards();
        const stage3Hand = state.handOffering.map(c => c.currentShape);

        state.stage = 1;
        drawSys.generateOfferingCards();
        const stage1Hand = state.handOffering.map(c => c.currentShape);

        return { stage1Hand, stage3Hand };
    });

    console.log(`STAGE_1_HAND_SHAPES:`, JSON.stringify(testResults.stage1Hand));
    console.log(`STAGE_3_HAND_SHAPES:`, JSON.stringify(testResults.stage3Hand));

    const ts = Date.now();
    const fullPath = `C:/Users/mam07/.gemini/antigravity/brain/5b868ecb-a33a-4010-b890-6fc37fefffc7/scratch/debug_screenshot_all_patterns_${ts}.png`;

    await page.screenshot({ path: fullPath });
    console.log(`VERIFIED_PATTERNS_PATH:${fullPath}`);

    await browser.close();
})();
