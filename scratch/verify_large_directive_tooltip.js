const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

    await page.goto('http://localhost:8080/index_v2.html', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    // Hover over directive badge
    const badge = page.locator('#directiveHeaderBadge .directive-pill');
    await badge.hover();
    await page.waitForTimeout(300);

    const tooltipInfo = await page.evaluate(() => {
        const tt = document.getElementById("directiveTooltip");
        if (!tt) return null;
        const rect = tt.getBoundingClientRect();
        return {
            visible: tt.style.display !== "none",
            width: rect.width,
            height: rect.height,
            innerText: tt.innerText
        };
    });

    console.log('=============================================================');
    console.log('LARGE DIRECTIVE HOVER TOOLTIP TEST');
    console.log(`- Tooltip Visible: ${tooltipInfo ? tooltipInfo.visible : false}`);
    console.log(`- Tooltip Dimensions: ${tooltipInfo ? tooltipInfo.width : 0}px x ${tooltipInfo ? tooltipInfo.height : 0}px (Large Box)`);
    console.log(`- Inner Content:\n${tooltipInfo ? tooltipInfo.innerText : ''}`);
    console.log('=============================================================');

    const screenshotPath = 'C:/Users/mam07/.gemini/antigravity/brain/af6d4803-5dd7-4a55-87d7-472ecdecfde4/large_directive_hover_tooltip_real.png';
    await page.screenshot({ path: screenshotPath });

    await browser.close();
})();
