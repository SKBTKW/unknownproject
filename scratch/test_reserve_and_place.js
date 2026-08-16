const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    await page.goto('http://localhost:8000/game/index_v2.html');

    // 1. 保留ボタンをクリック
    await page.click('#cardRow .card-frame-tcg:first-child button');
    await page.waitForTimeout(500);

    // 撮影
    await page.screenshot({ path: 'C:/Users/mam07/.gemini/antigravity/brain/5b868ecb-a33a-4010-b890-6fc37fefffc7/scratch/debug_screenshot_reserve_auto_draw_fix.png' });
    console.log("Reserve auto draw screenshot captured successfully!");
    await browser.close();
})();
