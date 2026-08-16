const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();

    await page.goto('http://localhost:8080/index_v2.html', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.data-panel', { state: 'attached', timeout: 10000 });

    const dpBox = await page.locator('.data-panel').boundingBox();
    if (!dpBox) {
        console.error('Data panel boundingBox not found');
        await browser.close();
        process.exit(1);
    }

    // 1. Move mouse onto data panel
    await page.mouse.move(dpBox.x + 20, dpBox.y + 20);
    await page.waitForTimeout(200);

    const tooltipVisible1 = await page.$eval('#tileTooltip', el => getComputedStyle(el).display !== 'none');
    const tooltipText1 = await page.$eval('#tileTooltip', el => el.innerText);
    const tooltipPos1 = await page.$eval('#tileTooltip', el => ({ left: el.style.left, top: el.style.top }));

    // 2. Move mouse to another spot inside data panel
    await page.mouse.move(dpBox.x + 50, dpBox.y + 30);
    await page.waitForTimeout(200);

    const tooltipPos2 = await page.$eval('#tileTooltip', el => ({ left: el.style.left, top: el.style.top }));

    // 3. Move mouse outside data panel
    await page.mouse.move(10, 10);
    await page.waitForTimeout(200);

    const tooltipVisible2 = await page.$eval('#tileTooltip', el => getComputedStyle(el).display !== 'none');

    console.log('=============================================================');
    console.log('DATA PANEL TOOLTIP REAL-TIME MEASUREMENT RESULTS');
    console.log('=============================================================');
    console.log(`- Hover Visible: ${tooltipVisible1}`);
    console.log(`- Tooltip Content:\n${tooltipText1}`);
    console.log(`- Position 1 (20, 20): (${tooltipPos1.left}, ${tooltipPos1.top})`);
    console.log(`- Position 2 (50, 30): (${tooltipPos2.left}, ${tooltipPos2.top})`);
    console.log(`- Mouseout Hidden: ${!tooltipVisible2}`);
    console.log('-------------------------------------------------------------');

    await browser.close();
})();
