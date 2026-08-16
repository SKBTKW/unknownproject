const { chromium } = require('playwright');
const path = require('path');

(async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1280, height: 850 });
    await page.goto('http://localhost:8080/index_v2.html');
    await page.waitForTimeout(500);

    // Switch I18n to English mode
    await page.evaluate(() => {
        window.I18n.setLanguage('en');
        window.render();
    });
    await page.waitForTimeout(500);

    const foodTextEn = await page.$eval('#lblFood', el => el.innerText);
    const turnEndEn = await page.$eval('#btnTurnEnd', el => el.innerText);
    const mulliganEn = await page.$eval('#btnMulligan', el => el.innerText);
    const hqTextEn = await page.$eval('.cell.hq', el => el.innerText);

    const artifactDir = 'C:/Users/mam07/.gemini/antigravity/brain/af6d4803-5dd7-4a55-87d7-472ecdecfde4';
    const screenshotPath = path.join(artifactDir, 'english_language_mode_preview.png');
    await page.screenshot({ path: screenshotPath });

    console.log('FOOD TEXT EN:', foodTextEn);
    console.log('TURN END EN:', turnEndEn);
    console.log('MULLIGAN EN:', mulliganEn);
    console.log('HQ TEXT EN:', hqTextEn);
    console.log('ENGLISH SCREENSHOT SAVED TO:', screenshotPath);

    await browser.close();

    if (foodTextEn.includes('Food') && turnEndEn.includes('TURN END') && hqTextEn.includes('Headquarters')) {
        console.log('SUCCESS: English Multi-language Mode verified 100%!');
        process.exit(0);
    } else {
        console.error('FAIL: English Multi-language Mode Failed!');
        process.exit(1);
    }
})();
