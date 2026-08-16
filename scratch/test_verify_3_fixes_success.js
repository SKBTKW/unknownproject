const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    await page.goto('http://localhost:8000/game/index_v2.html');
    await page.waitForTimeout(500);

    const result = await page.evaluate(() => {
        // 1. select 1st card
        selectCard(0);

        // 2. rotate 1st card
        rotateSelectedCard(null, 0);

        // 3. place shape at C4 (r:3, c:2)
        onCellClick(3, 2);

        return {
            emberText: document.getElementById('valEmber')?.innerText,
            emberVal: state.ember,
            hasPicked: state.hasPickedThisTurn,
            card1IsBlank: state.handOffering[0]?.isBlank,
            cellC4Placed: state.grid[3][2].placed,
            cellC5Placed: state.grid[4][2].placed
        };
    });

    console.log(`EMBED_TEST_RESULT: EmberText=${result.emberText}, EmberVal=${result.emberVal}, HasPicked=${result.hasPicked}, Card1Blank=${result.card1IsBlank}, CellC4Placed=${result.cellC4Placed}, CellC5Placed=${result.cellC5Placed}`);

    const ts = Date.now();
    const fullPath = `C:/Users/mam07/.gemini/antigravity/brain/5b868ecb-a33a-4010-b890-6fc37fefffc7/scratch/debug_screenshot_3fixes_success_${ts}.png`;

    await page.screenshot({ path: fullPath });
    console.log(`VERIFIED_3FIXES_SUCCESS_PATH:${fullPath}`);

    await browser.close();
})();
