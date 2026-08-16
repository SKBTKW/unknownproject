const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    await page.goto('http://localhost:8000/game/index_v2.html');
    await page.waitForTimeout(500);

    // 1. 手札 1 枚目のタイトルピールをクリック選択
    await page.click('#cardRow .card-frame-tcg:first-child .tcg-title-pill');
    await page.waitForTimeout(200);

    // 2. C4 (r:3, c:2) をクリック配置
    await page.click('.cell[data-r="3"][data-c="2"]', { force: true });
    await page.waitForTimeout(500);

    const result = await page.evaluate(() => {
        return {
            emberText: document.getElementById('valEmber')?.innerText,
            emberVal: state.ember,
            hasPicked: state.hasPickedThisTurn,
            card1IsBlank: state.handOffering[0]?.isBlank,
            cellC4Placed: state.grid[3][2].placed
        };
    });

    console.log(`EMBED_TEST_RESULT: EmberText=${result.emberText}, EmberVal=${result.emberVal}, HasPicked=${result.hasPicked}, Card1Blank=${result.card1IsBlank}, CellC4Placed=${result.cellC4Placed}`);

    const ts = Date.now();
    const fullPath = `C:/Users/mam07/.gemini/antigravity/brain/5b868ecb-a33a-4010-b890-6fc37fefffc7/scratch/debug_screenshot_3fixes_verified_${ts}.png`;

    await page.screenshot({ path: fullPath });
    console.log(`VERIFIED_3FIXES_PATH:${fullPath}`);

    await browser.close();
})();
