const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

    await page.goto('http://localhost:8080/index_v2.html', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#gridBoard .cell', { state: 'attached', timeout: 10000 });

    const terrainTests = [
        { id: "GL2_FOREST", name: "Forest", expected1x2: { wood: 1, food: 1 }, expected1x3: { wood: 3, food: 3 } },
        { id: "H3_MOUNTAIN", name: "Mountain", expected1x2: { wood: 4, mystic: 1 }, expected1x3: { wood: 8, mystic: 3 } },
        { id: "GL0_DESERT", name: "Desert", expected1x2: { mystic: 1 }, expected1x3: { mystic: 3 } }
    ];

    const results = [];

    for (const t of terrainTests) {
        const testRes = await page.evaluate(({ terrainId, expected1x2, expected1x3 }) => {
            // Reset state
            window.state.grid = Array.from({ length: 5 }, (_, r) => Array.from({ length: 5 }, (_, c) => ({ r, c, placed: false })));
            window.state.grid[2][2] = { r: 2, c: 2, placed: true, isHQ: true };
            window.state.food = 0; window.state.wood = 0; window.state.mystic = 0;
            window.state.gameLogs = [];

            const card = { id: `CARD_${terrainId}_1X1`, terrainId, nameKey: `TERRAIN_${terrainId}`, shape: [[1]] };

            // 1st placement
            window.state.placeShape(2, 1, [[1]], card, 0);
            const res1 = { food: window.state.food, wood: window.state.wood, mystic: window.state.mystic };

            // 2nd placement (1x2 bonus)
            window.state.hasPickedThisTurn = false;
            window.state.placeShape(2, 0, [[1]], card, 0);
            const res2 = { food: window.state.food, wood: window.state.wood, mystic: window.state.mystic };

            // 3rd placement (1x3 bonus)
            window.state.hasPickedThisTurn = false;
            window.state.placeShape(1, 1, [[1]], card, 0);
            const res3 = { food: window.state.food, wood: window.state.wood, mystic: window.state.mystic };

            const diff1x2 = {
                food: res2.food - res1.food,
                wood: res2.wood - res1.wood,
                mystic: res2.mystic - res1.mystic
            };

            const diff1x3 = {
                food: res3.food - res2.food,
                wood: res3.wood - res2.wood,
                mystic: res3.mystic - res2.mystic
            };

            return {
                diff1x2,
                diff1x3,
                logs: [...window.state.gameLogs]
            };
        }, t);

        results.push({ name: t.name, ...testRes });
    }

    console.log('=============================================================');
    console.log('ALL TERRAINS 1x2 & 1x3 CONNECTION BONUS ALL PASS TEST');
    console.log('=============================================================');
    for (const r of results) {
        console.log(`[${r.name}] 1x2 Bonus:`, r.diff1x2, `| 1x3 Bonus:`, r.diff1x3);
    }
    console.log('-------------------------------------------------------------');

    await browser.close();
})();
