const { chromium } = require('playwright');
const path = require('path');

(async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1280, height: 850 });
    await page.goto('http://localhost:8080/index_v2.html');
    await page.waitForTimeout(500);

    // Dynamic expand to 6x6 board
    await page.evaluate(() => {
        window.state.stage = { id: 2, name: "Stage 2 (Expansion)", size: 6 };
        window.state.grid = window.state.initGrid(6);
        window.render();
    });
    await page.waitForTimeout(500);

    const cells6x6Count = await page.locator('#gridBoard .cell').count();
    const cols6x6 = await page.$eval('#gridBoard', el => getComputedStyle(el).gridTemplateColumns);

    const artifactDir = 'C:/Users/mam07/.gemini/antigravity/brain/af6d4803-5dd7-4a55-87d7-472ecdecfde4';
    const screenshotPath = path.join(artifactDir, 'board_expansion_6x6_preview.png');
    await page.screenshot({ path: screenshotPath });

    console.log('6x6 CELLS COUNT:', cells6x6Count);
    console.log('6x6 COLS:', cols6x6);
    console.log('SCREENSHOT SAVED TO:', screenshotPath);

    await browser.close();

    // 6x6 grid contains 36 cell divs
    if (cells6x6Count === 36) {
        console.log('SUCCESS: Dynamic Stage Board Expansion (6x6) verified 100%!');
        process.exit(0);
    } else {
        console.error('FAIL: Board Expansion Failed!');
        process.exit(1);
    }
})();
