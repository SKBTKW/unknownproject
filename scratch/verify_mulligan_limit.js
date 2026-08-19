const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch();
    const context = await browser.newContext({ ignoreHTTPSErrors: true });
    const page = await context.newPage({ viewport: { width: 1400, height: 900 } });

    const timeStamp = Date.now();
    await page.goto(`http://localhost:8080/index_v2.html?t=${timeStamp}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(600);

    const brainDir = 'C:/Users/mam07/.gemini/antigravity/brain/af6d4803-5dd7-4a55-87d7-472ecdecfde4';

    // 残り火をテスト用に 1 に設定
    await page.evaluate(() => {
        window.state.ember = 1;
        window.render();
    });
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${brainDir}/mulligan_before_${timeStamp}.png` });

    // 1回目のマリガン実行 (残り火 1 -> 0 に消費)
    await page.click('.btn-mulligan');
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${brainDir}/mulligan_zero_ember_${timeStamp}.png` });

    // 残り火 0 の状態でさらにマリガンをクリック（ブロックされて数値が変わらないことを確認）
    await page.click('.btn-mulligan', { force: true });
    await page.waitForTimeout(300);

    const pathScreenshot = `${brainDir}/mulligan_blocked_at_zero_${timeStamp}.png`;
    await page.screenshot({ path: pathScreenshot });
    console.log(`Captured verified mulligan limit state: ${pathScreenshot}`);

    await browser.close();
})();
