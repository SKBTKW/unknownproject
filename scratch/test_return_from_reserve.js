const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    await page.goto('http://localhost:8000/game/index_v2.html');

    // 1. 保留ボタンをクリックして保留ゾーンへ移動
    await page.click('#cardRow .card-frame-tcg:first-child button');
    await page.waitForTimeout(500);

    // 撮影 1: 保留ゾーン移動状態（手札1枠目が ✖ カード裏表示）
    await page.screenshot({ path: 'C:/Users/mam07/.gemini/antigravity/brain/5b868ecb-a33a-4010-b890-6fc37fefffc7/scratch/debug_step1_reserved_card_back_x.png' });

    // 2. 保留ゾーンの「↩ 手札へ戻す」ボタンをクリック
    const returnBtn = page.locator('#reserveRow button:has-text("手札へ戻す")');
    if (await returnBtn.isVisible()) {
        await returnBtn.click();
        await page.waitForTimeout(500);
    }

    // 撮影 2: 保留復元状態（手札1枠目が表向き復元）
    await page.screenshot({ path: 'C:/Users/mam07/.gemini/antigravity/brain/5b868ecb-a33a-4010-b890-6fc37fefffc7/scratch/debug_step2_returned_card_front.png' });
    console.log("Both step screenshots captured successfully!");

    await browser.close();
})();
