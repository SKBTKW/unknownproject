const { chromium } = require('playwright');
const path = require('path');

(async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('http://localhost:8080/index_v2.html');
    await page.waitForTimeout(500);

    // Place H2 Hill tile on (r:2, c:1) and H3 Mountain tile on (r:2, c:3)
    await page.evaluate(() => {
        const sysData = window.LAND_SYSTEM_DATA;
        window.state.grid[2][1].placed = true;
        window.state.grid[2][1].terrain = sysData.terrains.H2_HILL;
        
        window.state.grid[2][3].placed = true;
        window.state.grid[2][3].terrain = sysData.terrains.H3_MOUNTAIN;
        
        window.render();
    });
    await page.waitForTimeout(500);

    const artifactDir = 'C:/Users/mam07/.gemini/antigravity/brain/af6d4803-5dd7-4a55-87d7-472ecdecfde4';
    const screenshotPath = path.join(artifactDir, 'h_elevation_animations_preview.png');
    await page.screenshot({ path: screenshotPath });

    console.log('SCREENSHOT SAVED TO:', screenshotPath);
    await browser.close();
})();
