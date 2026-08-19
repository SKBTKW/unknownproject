const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

    await page.goto('http://localhost:8080/index_v2.html', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#gridBoard .cell', { state: 'attached', timeout: 10000 });

    // Inject 1 Command Card (CMD_MILITARY_FOCUS) into offering slot 0
    await page.evaluate(() => {
        const drawSys = new Step1DrawSystem(window.state);
        const master = drawSys.getLandCardMaster();
        const milCard = master.find(c => c.id === "CMD_MILITARY_FOCUS");
        if (milCard) window.state.handOffering[0] = milCard;
        render();
    });

    // Hover over the first offering card
    const firstCard = await page.$('#cardRow .card-frame-tcg');
    if (firstCard) {
        await firstCard.hover();
    }

    // Wait slightly for modal display
    await page.waitForTimeout(300);

    const isModalVisible = await page.evaluate(() => {
        const modal = document.getElementById('cardHoverPreviewModal');
        return modal ? modal.style.display : 'none';
    });

    const screenshotPath = 'C:/Users/mam07/.gemini/antigravity/brain/af6d4803-5dd7-4a55-87d7-472ecdecfde4/card_4x_hover_preview_real.png';
    await page.screenshot({ path: screenshotPath });

    console.log('=============================================================');
    console.log('4X CARD HOVER PREVIEW MODAL REAL MEASUREMENT');
    console.log('=============================================================');
    console.log(`- Modal Display Style (Expected: "block"): "${isModalVisible}"`);
    console.log(`- 4x Hover Preview 100% SUCCESS: ${isModalVisible === 'block'}`);
    console.log('-------------------------------------------------------------');

    await browser.close();
})();
