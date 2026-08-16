const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    await page.goto('http://localhost:8000/game/index_v2.html');
    await page.waitForTimeout(500);

    // 1. 手札 1 枚目カードを選択 (横 [[1, 1]])
    await page.click('#cardRow .card-frame-tcg:first-child');
    await page.waitForTimeout(200);

    // 2. A3 (r:2, c:0) をクリック配置 (横 [[1, 1]] なので A3 (2,0) と B3 (2,1) に置かれ、B3 が本営 C3 と直隣接！)
    await page.click('.cell[data-r="2"][data-c="0"]');
    await page.waitForTimeout(500);

    const ts = Date.now();
    const fullPath = `C:/Users/mam07/.gemini/antigravity/brain/5b868ecb-a33a-4010-b890-6fc37fefffc7/scratch/debug_screenshot_card_placed_successfully_${ts}.png`;

    await page.screenshot({ path: fullPath });
    console.log(`CARD_PLACEMENT_SUCCESS_PATH:${fullPath}`);

    await browser.close();
})();
