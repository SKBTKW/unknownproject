const { chromium } = require('playwright');
const path = require('path');

(async () => {
    try {
        const browser = await chromium.launch();
        const page = await browser.newPage();
        const htmlPath = 'file:///' + path.resolve('./game/index_v2.html').replace(/\\/g, '/');
        
        console.log("Opening URL:", htmlPath);
        await page.goto(htmlPath);
        await page.waitForTimeout(1000);

        const screenshotPath = path.resolve('./scratch/real_browser_screenshot.png');
        await page.screenshot({ path: screenshotPath, fullPage: true });
        console.log("Screenshot saved to:", screenshotPath);

        const cardsCount = await page.locator('.card-frame-tcg').count();
        const gridCellsCount = await page.locator('.cell').count();
        console.log("Real Browser Verification Results:");
        console.log(" - Grid Cells Count:", gridCellsCount);
        console.log(" - Hand Cards Count:", cardsCount);

        await browser.close();
    } catch(e) {
        console.error("Browser Test Error:", e);
    }
})();
