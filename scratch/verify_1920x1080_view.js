const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    await page.goto('http://localhost:8000/game/index_v2.html');
    await page.waitForTimeout(500);

    // ピクセル実測値を取得
    const cardDimensions = await page.evaluate(() => {
        const card = document.querySelector('.card-frame-tcg');
        if (!card) return null;
        const rect = card.getBoundingClientRect();
        return {
            width: rect.width,
            height: rect.height,
            ratio: rect.height / rect.width
        };
    });

    console.log(`REAL_PIXEL_MEASUREMENT: Width=${cardDimensions?.width}px, Height=${cardDimensions?.height}px, Ratio(H/W)=${cardDimensions?.ratio}`);

    const ts = Date.now();
    const fullPath = `C:/Users/mam07/.gemini/antigravity/brain/5b868ecb-a33a-4010-b890-6fc37fefffc7/scratch/debug_exact_2to3_ratio_${ts}.png`;

    await page.screenshot({ path: fullPath });
    console.log(`NEW_EXACT_2TO3_PATH:${fullPath}`);

    await browser.close();
})();
