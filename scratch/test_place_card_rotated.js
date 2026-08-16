const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    await page.goto('http://localhost:8000/game/index_v2.html');
    await page.waitForTimeout(500);

    // 1. 手札 1 枚目カードを選択
    await page.click('#cardRow .card-frame-tcg:first-child');
    await page.waitForTimeout(200);

    // 2. 回転ボタンをクリックして 縦 1x2 [[1], [1]] に変換
    await page.click('#cardRow .card-frame-tcg:first-child .tcg-rotate-btn-wireframe');
    await page.waitForTimeout(200);

    // 3. 本営 (C3 = r:2, c:2) の下 (C4 = r:3, c:2) をクリック配置 (縦 [[1], [1]] なので C4, C5 に置き、C4 が C3 と直接隣接！)
    await page.click('.cell[data-r="3"][data-c="2"]');
    await page.waitForTimeout(500);

    const ts = Date.now();
    const fullPath = `C:/Users/mam07/.gemini/antigravity/brain/5b868ecb-a33a-4010-b890-6fc37fefffc7/scratch/debug_screenshot_card_placed_successfully_${ts}.png`;

    await page.screenshot({ path: fullPath });
    console.log(`CARD_PLACEMENT_SUCCESS_PATH:${fullPath}`);

    await browser.close();
})();
