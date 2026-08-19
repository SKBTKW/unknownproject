const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

    await page.goto('http://localhost:8080/index_v2.html', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    // Initial state: Log expanded
    const heightBefore = await page.evaluate(() => {
        const wrapper = document.getElementById("logPanelWrapper");
        return wrapper.getBoundingClientRect().height;
    });

    // Click toggle button to collapse log
    await page.click('#btnLogToggle');
    await page.waitForTimeout(300);

    const heightAfter = await page.evaluate(() => {
        const wrapper = document.getElementById("logPanelWrapper");
        return {
            height: wrapper.getBoundingClientRect().height,
            isCollapsed: wrapper.classList.contains("collapsed"),
            btnText: document.getElementById("btnLogToggle").innerText
        };
    });

    console.log('=============================================================');
    console.log('LOG PANEL TOGGLE FUNCTIONALITY TEST');
    console.log(`- Expanded Height: ${heightBefore}px`);
    console.log(`- Collapsed Height: ${heightAfter.height}px (Expected ~36px)`);
    console.log(`- Wrapper Contains 'collapsed' Class: ${heightAfter.isCollapsed}`);
    console.log(`- Button Arrow Icon: ${heightAfter.btnText} (Expected ▲)`);
    console.log('=============================================================');

    const screenshotPath = 'C:/Users/mam07/.gemini/antigravity/brain/af6d4803-5dd7-4a55-87d7-472ecdecfde4/log_toggle_test_real.png';
    await page.screenshot({ path: screenshotPath });

    await browser.close();
})();
