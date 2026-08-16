const { chromium } = require('playwright');
const path = require('path');

(async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('http://localhost:8080/index_v2.html');
    await page.waitForTimeout(500);

    const artifactDir = 'C:/Users/mam07/.gemini/antigravity/brain/af6d4803-5dd7-4a55-87d7-472ecdecfde4';
    const screenshotPath = path.join(artifactDir, 'full_modular_ui_preview.png');
    await page.screenshot({ path: screenshotPath });

    console.log('FULL UI SCREENSHOT SAVED TO:', screenshotPath);
    await browser.close();
})();
