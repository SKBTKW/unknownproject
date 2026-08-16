const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    await page.goto('http://localhost:8000/game/index_v2.html');
    await page.waitForTimeout(500);

    // 1. 手札オファリングの 1 枚目カードをクリック選択
    await page.click('#cardRow .card-frame-tcg:first-child');
    await page.waitForTimeout(200);

    // 2. 本営 (C3 = row: 2, col: 2) の上 (C2 = row: 1, col: 2) をクリック配置
    await page.click('.cell[data-r="1"][data-c="2"]');
    await page.waitForTimeout(500);

    const ts = Date.now();
    const fullPath = `C:/Users/mam07/.gemini/antigravity/brain/5b868ecb-a33a-4010-b890-6fc37fefffc7/scratch/debug_screenshot_card_placed_successfully_${ts}.png`;

    await page.screenshot({ path: fullPath });
    console.log(`CARD_PLACEMENT_SUCCESS_PATH:${fullPath}`);

    await browser.close();
})();
