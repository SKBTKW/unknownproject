const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();

    await page.goto('http://localhost:8080/index_v2.html', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#gridBoard .cell', { state: 'attached', timeout: 10000 });

    // 1. Check Data Panel Title
    const dataPanelTitle = await page.innerText('#lblDataPanelTitle');

    // 2. Check Buff Panel hidden initially
    const initialBuffDisplay = await page.evaluate(() => {
        const bp = document.getElementById('activeBuffPanel');
        return bp ? bp.style.display : null;
    });

    // 3. Activate Buff (Land Focus)
    const buffActiveState = await page.evaluate(() => {
        window.state.activeDrawBias = {
            targetCategory: "LAND",
            type: "UNTIL_BLOCKS",
            untilValue: 6
        };
        render();

        const bp = document.getElementById('activeBuffPanel');
        const bc = document.getElementById('activeBuffContent');

        return {
            display: bp ? bp.style.display : null,
            text: bc ? bc.innerText : null
        };
    });

    console.log('=============================================================');
    console.log('SIDEBAR BUFF PANEL & TITLE LAYOUT REAL MEASUREMENT');
    console.log('=============================================================');
    console.log(`- Data Panel Title (Expected: "産出データ"): "${dataPanelTitle}"`);
    console.log(`- Initial Buff Panel Display (Expected: "none"): "${initialBuffDisplay}"`);
    console.log(`- Active Buff Panel Display (Expected: "block"): "${buffActiveState.display}"`);
    console.log(`- Active Buff Content Text: "${buffActiveState.text}"`);
    console.log(`- Sidebar Buff Layout 100% SUCCESS: ${dataPanelTitle === '産出データ' && initialBuffDisplay === 'none' && buffActiveState.display === 'block'}`);
    console.log('-------------------------------------------------------------');

    await browser.close();
})();
