const { chromium } = require('playwright');
const path = require('path');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    
    await page.goto('http://localhost:8080/index_v2.html', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#logPanelWrapper', { state: 'attached', timeout: 10000 });

    const btnToggle = page.locator('#btnLogToggle');
    
    // 1. Initial State Measurement
    const initialHeight = await page.$eval('#logPanelWrapper', el => el.clientHeight);
    console.log(`[MEASUREMENT] Initial logPanelWrapper height: ${initialHeight}px`);

    // 2. Click Toggle and measure height over time (0ms, 100ms, 200ms, 300ms, 400ms)
    await btnToggle.click();
    const heightSamples = [];
    for (let i = 0; i <= 8; i++) {
        const h = await page.$eval('#logPanelWrapper', el => el.clientHeight);
        const op = await page.$eval('#logContent', el => getComputedStyle(el).opacity);
        heightSamples.push({ timeMs: i * 50, height: h, opacity: op });
        await page.waitForTimeout(50);
    }

    console.log('[MEASUREMENT] Collapsing Animation Height & Opacity Samples over time:');
    console.table(heightSamples);

    // 3. Final Collapsed State
    const collapsedHeight = await page.$eval('#logPanelWrapper', el => el.clientHeight);
    const arrowAfterCollapse = await page.$eval('#btnLogToggle', el => el.innerText);
    console.log(`[MEASUREMENT] Final Collapsed Height: ${collapsedHeight}px, Arrow Icon: "${arrowAfterCollapse}"`);

    // 4. Click Toggle again to Expand and measure height over time
    await btnToggle.click();
    const expandSamples = [];
    for (let i = 0; i <= 8; i++) {
        const h = await page.$eval('#logPanelWrapper', el => el.clientHeight);
        const op = await page.$eval('#logContent', el => getComputedStyle(el).opacity);
        expandSamples.push({ timeMs: i * 50, height: h, opacity: op });
        await page.waitForTimeout(50);
    }

    console.log('[MEASUREMENT] Expanding Animation Height & Opacity Samples over time:');
    console.table(expandSamples);

    const expandedHeight = await page.$eval('#logPanelWrapper', el => el.clientHeight);
    const arrowAfterExpand = await page.$eval('#btnLogToggle', el => el.innerText);
    console.log(`[MEASUREMENT] Final Expanded Height: ${expandedHeight}px, Arrow Icon: "${arrowAfterExpand}"`);

    await browser.close();
})();
