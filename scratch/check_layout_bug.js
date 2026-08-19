const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

    await page.goto('http://localhost:8080/index_v2.html', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    const path = 'C:/Users/mam07/.gemini/antigravity/brain/af6d4803-5dd7-4a55-87d7-472ecdecfde4/layout_bug_diagnose.png';
    await page.screenshot({ path });

    const info = await page.evaluate(() => {
        const board = document.getElementById('gridBoard');
        const boardClass = board ? board.className : '';
        const boardStyle = board ? window.getComputedStyle(board).cssText : '';
        return { boardClass, boardStyle };
    });

    console.log('Board info:', info);
    await browser.close();
})();
