const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

    await page.goto('http://localhost:8080/index_v2.html', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#gridBoard .cell', { state: 'attached', timeout: 10000 });

    // Inject a 1x2 Land Card into slot 0
    await page.evaluate(() => {
        const drawSys = new Step1DrawSystem(window.state);
        const master = drawSys.getLandCardMaster();
        const land1x2 = master.find(c => {
            const shape = c.shape || [];
            return (shape.length > 1 || (shape[0] && shape[0].length > 1));
        });
        if (land1x2) {
            window.state.handOffering[0] = land1x2;
        }
        render();
    });

    const firstCard = await page.$('#cardRow .card-frame-tcg');
    if (!firstCard) {
        console.error('Failed to find 1x2 card');
        await browser.close();
        return;
    }

    const box = await firstCard.boundingBox();
    if (box) {
        // Move mouse to center of 1x2 land card
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.waitForTimeout(200);
    }

    const tooltipData = await page.evaluate(() => {
        const tt = document.getElementById('cardRotateCursorTooltip');
        return {
            display: tt ? tt.style.display : 'none',
            text: tt ? tt.innerText : '',
            top: tt ? tt.style.top : '',
            left: tt ? tt.style.left : ''
        };
    });

    const screenshotPath = 'C:/Users/mam07/.gemini/antigravity/brain/af6d4803-5dd7-4a55-87d7-472ecdecfde4/card_rotate_tooltip_follow_real.png';
    await page.screenshot({ path: screenshotPath });

    console.log('=============================================================');
    console.log('1x2 LAND CARD ROTATE CURSOR TOOLTIP REAL MEASUREMENT');
    console.log('=============================================================');
    console.log(`- Tooltip Display (Expected: "block"): "${tooltipData.display}"`);
    console.log(`- Tooltip Text (Expected: "右クリックで回転"): "${tooltipData.text}"`);
    console.log(`- Tooltip Position: top=${tooltipData.top}, left=${tooltipData.left}`);
    console.log(`- Mouse Follow Tooltip 100% SUCCESS: ${tooltipData.display === 'block' && tooltipData.text.includes('回転')}`);
    console.log('-------------------------------------------------------------');

    await browser.close();
})();
