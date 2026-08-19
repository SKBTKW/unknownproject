const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

    await page.goto('http://localhost:8080/index_v2.html', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    // Hover over unplaced socket tile (B1: r=0, c=1)
    const socketCell = page.locator('.cell[data-r="0"][data-c="1"]');
    await socketCell.hover();
    await page.waitForTimeout(300);

    const tooltipText = await page.evaluate(() => {
        const tt = document.getElementById("tileTooltip");
        return tt ? tt.innerText : "";
    });

    console.log('=============================================================');
    console.log('UNOPENED SOCKET TOOLTIP TEXT TEST');
    console.log(`- Tooltip Inner Text: "${tooltipText}"`);
    console.log('=============================================================');

    const screenshotPath = 'C:/Users/mam07/.gemini/antigravity/brain/af6d4803-5dd7-4a55-87d7-472ecdecfde4/unopened_socket_tooltip_real.png';
    await page.screenshot({ path: screenshotPath });

    await browser.close();
})();
