const { chromium } = require('playwright');
const path = require('path');

(async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1400, height: 950 });
    await page.goto('http://localhost:8080/index_v2.html');
    await page.waitForTimeout(500);

    const artifactDir = 'C:/Users/mam07/.gemini/antigravity/brain/af6d4803-5dd7-4a55-87d7-472ecdecfde4';

    // 1. Stage 1 (5x5) Verification: HQ at C3 (2,2)
    const hq5x5 = await page.evaluate(() => {
        return window.state.grid[2][2].isHQ;
    });

    // 2. Stage 2 (7x7) Expansion Verification: HQ at D4 (3,3)
    await page.evaluate(() => {
        window.state.stage = { id: 2, name: "Stage 2 (Expansion)", size: 7 };
        window.state.grid = window.state.initGrid(7);
        window.render();
    });
    await page.waitForTimeout(400);

    const cells7x7Count = await page.locator('#gridBoard .cell').count();
    const hq7x7 = await page.evaluate(() => window.state.grid[3][3].isHQ);
    const screenshot7x7Path = path.join(artifactDir, 'board_expansion_7x7_stage2_preview.png');
    await page.screenshot({ path: screenshot7x7Path });

    // 3. Stage 3 (9x9) Expansion Verification: HQ at E5 (4,4)
    await page.evaluate(() => {
        window.state.stage = { id: 3, name: "Stage 3 (Full Unlocked)", size: 9 };
        window.state.grid = window.state.initGrid(9);
        window.render();
    });
    await page.waitForTimeout(400);

    const cells9x9Count = await page.locator('#gridBoard .cell').count();
    const hq9x9 = await page.evaluate(() => window.state.grid[4][4].isHQ);
    const screenshot9x9Path = path.join(artifactDir, 'board_expansion_9x9_stage3_preview.png');
    await page.screenshot({ path: screenshot9x9Path });

    console.log('Stage 1 HQ C3 (2,2):', hq5x5);
    console.log('Stage 2 7x7 Cells:', cells7x7Count, '| HQ D4 (3,3):', hq7x7);
    console.log('Stage 3 9x9 Cells:', cells9x9Count, '| HQ E5 (4,4):', hq9x9);

    await browser.close();

    if (hq5x5 && cells7x7Count === 49 && hq7x7 && cells9x9Count === 81 && hq9x9) {
        console.log('SUCCESS: Spec Board Expansion (5x5 -> 7x7 -> 9x9) verified 100%!');
        process.exit(0);
    } else {
        console.error('FAIL: Spec Board Expansion Verification Failed!');
        process.exit(1);
    }
})();
