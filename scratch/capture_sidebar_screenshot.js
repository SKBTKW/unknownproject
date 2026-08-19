const { chromium } = require('playwright');
const path = require('path');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

    await page.goto('http://localhost:8080/index_v2.html', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#gridBoard .cell', { state: 'attached', timeout: 10000 });

    const screenshotPath = 'C:/Users/mam07/.gemini/antigravity/brain/af6d4803-5dd7-4a55-87d7-472ecdecfde4/sidebar_real_preview.png';
    
    // Element handle for right sidebar
    const sidebar = await page.$('.right-sidebar');
    if (sidebar) {
        await sidebar.screenshot({ path: screenshotPath });
        console.log(`Screenshot saved successfully to ${screenshotPath}`);
    } else {
        await page.screenshot({ path: screenshotPath });
    }

    await browser.close();
})();
