const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();

    await page.goto('http://localhost:8080/index_v2.html', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#gridBoard .cell', { state: 'attached', timeout: 10000 });

    // Inject a command card into state hand offering to test rendering
    const cmdCardState = await page.evaluate(() => {
        const drawSys = new Step1DrawSystem(window.state);
        const master = drawSys.getLandCardMaster();
        const cmdCardObj = master.find(c => c.id === "CMD_LAND_FOCUS");

        // Force set card 0 as CMD_LAND_FOCUS
        window.state.handOffering[0] = cmdCardObj;
        render();

        const cardEl = document.querySelectorAll('#cardRow .card-frame-tcg')[0];
        const titleText = cardEl ? cardEl.querySelector('.tcg-title-pill').innerText : null;
        const categoryText = cardEl ? cardEl.querySelector('small').innerText : null;
        const costBadgeText = cardEl ? cardEl.querySelector('.tcg-cost-badge').innerText : null;

        return {
            hasTitle: titleText === "土地探索重視",
            titleText,
            categoryText,
            costBadgeText,
            innerHTML: cardEl ? cardEl.innerHTML : ""
        };
    });

    console.log('=============================================================');
    console.log('COMMAND CARD OFFERING RENDERING REAL MEASUREMENT');
    console.log('=============================================================');
    console.log(`- Card Title Rendered (Expected: "土地探索重視"): "${cmdCardState.titleText}"`);
    console.log(`- Card Category Rendered: "${cmdCardState.categoryText}"`);
    console.log(`- Card Cost Badge Rendered: "${cmdCardState.costBadgeText}"`);
    console.log(`- Command Card Offering Render 100% SUCCESS: ${cmdCardState.hasTitle && cmdCardState.costBadgeText !== null}`);
    console.log('-------------------------------------------------------------');

    await browser.close();
})();
