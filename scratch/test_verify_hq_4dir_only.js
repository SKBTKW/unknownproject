const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    await page.goto('http://localhost:8000/game/index_v2.html');
    await page.waitForTimeout(500);

    const testResults = await page.evaluate(() => {
        // 1x2 横型ブロック [[1, 1]] でテスト
        const shape1x2 = [[1, 1]];

        // 本営直交 4 マスからの始点配置
        const top_C2    = state.canPlaceShape(1, 2, shape1x2).can; // C2 始点
        const bottom_C4 = state.canPlaceShape(3, 2, shape1x2).can; // C4 始点
        const left_B3   = state.canPlaceShape(2, 1, shape1x2).can; // B3 始点 (B3, C3は本営重なりで不可)
        const right_D3  = state.canPlaceShape(2, 3, shape1x2).can; // D3 始点 (D3, E3)

        // 本営から 1 マス離れた斜め 4 マスからの始点配置 (すべて false になるべき！！)
        const diag_B2   = state.canPlaceShape(1, 1, shape1x2).can; // B2 始点 (B2, C2) -> 始点 B2 が本営から離れているため拒否！
        const diag_D2   = state.canPlaceShape(1, 3, shape1x2).can; // D2 始点 (D2, E2) -> 始点 D2 が本営から離れているため拒否！
        const diag_B4   = state.canPlaceShape(3, 1, shape1x2).can; // B4 始点 (B4, C4) -> 始点 B4 が本営から離れているため拒否！
        const diag_D4   = state.canPlaceShape(3, 3, shape1x2).can; // D4 始点 (D4, E4) -> 始点 D4 が本営から離れているため拒否！

        return {
            orthogonalStart: { C2: top_C2, C4: bottom_C4, D3: right_D3 },
            diagonalStart1TileAway: { B2: diag_B2, D2: diag_D2, B4: diag_B4, D4: diag_D4 }
        };
    });

    console.log(`ORTHOGONAL_ORIGIN_CAN_PLACE (Should be true):`, testResults.orthogonalStart);
    console.log(`DIAGONAL_1TILE_AWAY_ORIGIN_CAN_PLACE (Should be all false):`, testResults.diagonalStart1TileAway);

    const ts = Date.now();
    const fullPath = `C:/Users/mam07/.gemini/antigravity/brain/5b868ecb-a33a-4010-b890-6fc37fefffc7/scratch/debug_screenshot_hq_origin_strict_${ts}.png`;

    await page.screenshot({ path: fullPath });
    console.log(`VERIFIED_STRICT_ORIGIN_PATH:${fullPath}`);

    await browser.close();
})();
