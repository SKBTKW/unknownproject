const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();

    await page.goto('http://localhost:8080/index_v2.html', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#gridBoard .cell', { state: 'attached', timeout: 10000 });

    const terrainPlains = { id: "GL1_PLAINS", terrainId: "GL1_PLAINS", nameKey: "TERRAIN_PLAINS", food: 4, wood: 0 };

    // 1. Place 1x2 Connection at (2,1) and (2,0)
    await page.evaluate((t) => {
        window.state.placeShape(2, 1, [[1]], t, 0);
        window.state.hasPickedThisTurn = false;
        window.state.placeShape(2, 0, [[1]], t, 1);
        window.render();
    }, terrainPlains);

    const text1x2 = await page.locator('.cell[data-r="2"][data-c="0"]').innerText();

    // 2. Complete 2x2 Merge by placing at (3,1) and (3,0)
    await page.evaluate((t) => {
        window.state.hasPickedThisTurn = false;
        window.state.placeShape(3, 1, [[1]], t, 2);
        window.state.hasPickedThisTurn = false;
        window.state.placeShape(3, 0, [[1]], t, 3);
        window.render();
    }, terrainPlains);

    const text2x2 = await page.locator('.cell[data-r="2"][data-c="0"]').innerText();

    console.log('=============================================================');
    console.log('1x2 LABEL VS 2x2 MERGE LABEL REAL MEASUREMENT');
    console.log('=============================================================');
    console.log(`- Text After 1x2 Placement (Should be "草原"): "${text1x2.trim()}"`);
    console.log(`- Text After 2x2 Full Merge (Should be "✨ 2x2大草原 [1.2倍!]"): "${text2x2.trim()}"`);
    console.log(`- 1x2 Label Correct: ${text1x2.trim() === '草原'}`);
    console.log(`- 2x2 Label Correct: ${text2x2.trim() === '✨ 2x2大草原 [1.2倍!]'}`);
    console.log('-------------------------------------------------------------');

    await browser.close();
})();
