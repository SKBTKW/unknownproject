const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

    await page.goto('http://localhost:8080/index_v2.html', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#gridBoard .cell', { state: 'attached', timeout: 10000 });

    // Inject 1 Land Card & 1 Command Card into handOffering
    await page.evaluate(() => {
        const drawSys = new Step1DrawSystem(window.state);
        const master = drawSys.getLandCardMaster();
        const riverCard = master.find(c => c.id === "CARD_PLAINS_1X2");
        const milCard = master.find(c => c.id === "CMD_MILITARY_FOCUS");

        if (riverCard) window.state.handOffering[0] = { terrain: riverCard, currentShape: riverCard.shape };
        if (milCard) window.state.handOffering[1] = milCard;
        render();
    });

    // Check rotate button count (Expected: 0)
    const rotateBtnCount = await page.$$eval('.tcg-rotate-btn-wireframe', btns => btns.length);

    // Test right-click rotation on land card (card 0)
    const shapeBefore = await page.evaluate(() => window.state.handOffering[0].currentShape);
    
    // Perform right click on land card
    const firstCard = await page.$('#cardRow .card-frame-tcg');
    if (firstCard) {
        await firstCard.click({ button: 'right' });
    }
    
    const shapeAfter = await page.evaluate(() => window.state.handOffering[0].currentShape);

    const screenshotPath = 'C:/Users/mam07/.gemini/antigravity/brain/af6d4803-5dd7-4a55-87d7-472ecdecfde4/land_card_no_rotate_btn_preview.png';
    const cardRow = await page.$('#cardRow');
    if (cardRow) {
        await cardRow.screenshot({ path: screenshotPath });
        console.log(`Screenshot saved to ${screenshotPath}`);
    }

    console.log('=============================================================');
    console.log('LAND CARD ROTATE BUTTON REMOVAL & RIGHT-CLICK ROTATE REAL MEASUREMENT');
    console.log('=============================================================');
    console.log(`- Rotate Button Count (Expected: 0): ${rotateBtnCount}`);
    console.log(`- Shape Before Right Click: ${JSON.stringify(shapeBefore)}`);
    console.log(`- Shape After Right Click: ${JSON.stringify(shapeAfter)}`);
    console.log(`- Rotate Button Removed & Right Click Rotate 100% SUCCESS: ${rotateBtnCount === 0 && JSON.stringify(shapeBefore) !== JSON.stringify(shapeAfter)}`);
    console.log('-------------------------------------------------------------');

    await browser.close();
})();
