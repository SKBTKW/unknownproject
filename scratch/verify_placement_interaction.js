const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch();
    const context = await browser.newContext({ ignoreHTTPSErrors: true });
    const page = await context.newPage({ viewport: { width: 1400, height: 900 } });

    const timeStamp = Date.now();
    await page.goto(`http://localhost:8080/index_v2.html?t=${timeStamp}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(600);

    const brainDir = 'C:/Users/mam07/.gemini/antigravity/brain/af6d4803-5dd7-4a55-87d7-472ecdecfde4';

    // 1. 左下カードホバー時 (20%拡大表示)
    await page.hover('.offering-section .card-frame-tcg');
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${brainDir}/card_hover_20percent_${timeStamp}.png` });
    console.log(`Captured 20% zoom state.`);

    // 2. 土地カードをクリック選択
    await page.click('.offering-section .card-frame-tcg');
    await page.waitForTimeout(400);

    // 3. 盤面上の置けるマス (B2マス: data-r="1", data-c="1") にホバーして設置プレビュー発生
    await page.hover('.cell[data-r="1"][data-c="1"]');
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${brainDir}/land_selection_preview_${timeStamp}.png` });
    console.log(`Captured land selection preview state.`);

    await browser.close();
})();
