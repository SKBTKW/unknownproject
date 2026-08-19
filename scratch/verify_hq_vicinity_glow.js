const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch();
    const context = await browser.newContext({ ignoreHTTPSErrors: true });
    const page = await context.newPage({ viewport: { width: 1400, height: 900 } });

    const timeStamp = Date.now();
    await page.goto(`http://localhost:8080/index_v2.html?t=${timeStamp}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(800);

    const brainDir = 'C:/Users/mam07/.gemini/antigravity/brain/af6d4803-5dd7-4a55-87d7-472ecdecfde4';

    // 手札の中から純粋な「LAND」カテゴリのカードを評価・検出
    const landIndex = await page.evaluate(() => {
        const state = window.state;
        if (!state || !state.handOffering) return -1;
        return state.handOffering.findIndex(c => c && !c.isBlank && (c.category === 'LAND' || (c.terrain && c.terrain.category === 'LAND')));
    });

    if (landIndex !== -1) {
        const cards = await page.$$('.offering-section .card-frame-tcg');
        if (cards[landIndex]) {
            await cards[landIndex].click();
        }
    }
    await page.waitForTimeout(400);

    // 本営隣接マス (C2マス: data-r="1", data-c="2") へホバー
    await page.hover('.cell[data-r="1"][data-c="2"]', { force: true });
    await page.waitForTimeout(400);

    const pathScreenshot = `${brainDir}/hq_vicinity_glow_preview_${timeStamp}.png`;
    await page.screenshot({ path: pathScreenshot });
    console.log(`Captured verified green preview highlight state: ${pathScreenshot}`);

    await browser.close();
})();
