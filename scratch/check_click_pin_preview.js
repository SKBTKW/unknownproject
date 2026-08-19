const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

    await page.goto('http://localhost:8080/index_v2.html', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#gridBoard .cell', { state: 'attached', timeout: 10000 });

    // Inject 1 Command Card into slot 0
    await page.evaluate(() => {
        const drawSys = new Step1DrawSystem(window.state);
        const master = drawSys.getLandCardMaster();
        const milCard = master.find(c => c.id === "CMD_MILITARY_FOCUS");
        if (milCard) window.state.handOffering[0] = milCard;
        render();
    });

    const firstCard = await page.$('#cardRow .card-frame-tcg');

    // 1. Click to Pin
    if (firstCard) await firstCard.click();
    await page.waitForTimeout(200);

    const isPinnedModalVisible = await page.evaluate(() => {
        const modal = document.getElementById('cardHoverPreviewModal');
        return {
            display: modal ? modal.style.display : 'none',
            hasPinnedCard: window.pinnedPreviewCard !== null
        };
    });

    // 2. Move mouse away to top corner (test that it stays pinned!)
    await page.mouse.move(10, 10);
    await page.waitForTimeout(200);

    const isStillPinnedAfterMouseLeave = await page.evaluate(() => {
        const modal = document.getElementById('cardHoverPreviewModal');
        return modal ? modal.style.display : 'none';
    });

    // 3. Click again to unpin (re-query card element)
    const cardAgain = await page.$('#cardRow .card-frame-tcg');
    if (cardAgain) await cardAgain.click();
    await page.mouse.move(0, 0);
    await page.waitForTimeout(200);

    const isUnpinnedModalVisible = await page.evaluate(() => {
        const modal = document.getElementById('cardHoverPreviewModal');
        return modal ? modal.style.display : 'none';
    });

    // 4. Test Reserve button unpin
    const cardToReserve = await page.$('#cardRow .card-frame-tcg');
    if (cardToReserve) await cardToReserve.click(); // pin first
    await page.waitForTimeout(200);

    const reserveBtn = await page.$('#cardRow .tcg-reserve-btn-wireframe');
    if (reserveBtn) await reserveBtn.click(); // click reserve
    await page.mouse.move(0, 0);
    await page.waitForTimeout(200);

    const isReserveUnpinnedModalVisible = await page.evaluate(() => {
        const modal = document.getElementById('cardHoverPreviewModal');
        return modal ? modal.style.display : 'none';
    });

    console.log('=============================================================');
    console.log('CLICK TO PIN & RE-CLICK / RESERVE TO UNPIN REAL MEASUREMENT');
    console.log('=============================================================');
    console.log(`- 1. Clicked Display (Expected: "block"): "${isPinnedModalVisible.display}"`);
    console.log(`- 2. Display After Mouse Leave (Expected: "block"): "${isStillPinnedAfterMouseLeave}"`);
    console.log(`- 3. Display After Re-Click Unpin (Expected: "none"): "${isUnpinnedModalVisible}"`);
    console.log(`- 4. Display After Reserve Unpin (Expected: "none"): "${isReserveUnpinnedModalVisible}"`);
    console.log(`- Click Pin & Reserve Unpin 100% SUCCESS: ${isPinnedModalVisible.display === 'block' && isStillPinnedAfterMouseLeave === 'block' && isUnpinnedModalVisible === 'none' && isReserveUnpinnedModalVisible === 'none'}`);
    console.log('-------------------------------------------------------------');

    await browser.close();
})();
