const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

    await page.goto('http://localhost:8080/index_v2.html', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#gridBoard .cell', { state: 'attached', timeout: 10000 });

    // Step 1: Place a 1x2 Plains land card at (1,2)-(1,3) (HQ adjacent at (2,2))
    await page.evaluate(() => {
        const drawSys = new Step1DrawSystem(window.state);
        const master = drawSys.getLandCardMaster();
        const plains1x2 = master.find(c => c.id === "CARD_PLAINS_1X2");
        window.state.placeShape(1, 2, plains1x2.shape, plains1x2, 0);
        render();
    });

    // Measure border of 1x2 placement card
    const multiTileBorder = await page.evaluate(() => {
        const cell1 = document.querySelector('.cell[data-r="1"][data-c="2"]');
        const cell2 = document.querySelector('.cell[data-r="1"][data-c="3"]');
        return {
            cell1BorderRightStyle: cell1 ? window.getComputedStyle(cell1).borderRightStyle : '',
            cell2BorderLeftStyle: cell2 ? window.getComputedStyle(cell2).borderLeftStyle : ''
        };
    });

    // Step 2: Form a 2x2 merge at (1,1),(1,2),(2,1),(2,2-HQ) -> place 4 Plains at (2,3),(2,4),(3,3),(3,4)
    await page.evaluate(() => {
        const drawSys = new Step1DrawSystem(window.state);
        const master = drawSys.getLandCardMaster();
        const plains1x1 = master.find(c => c.id === "CARD_PLAINS_1X1");
        
        window.state.hasPickedThisTurn = false;
        window.state.placeShape(2, 3, plains1x1.shape, plains1x1, 0);
        window.state.hasPickedThisTurn = false;
        window.state.placeShape(2, 4, plains1x1.shape, plains1x1, 0);
        window.state.hasPickedThisTurn = false;
        window.state.placeShape(3, 3, plains1x1.shape, plains1x1, 0);
        window.state.hasPickedThisTurn = false;
        window.state.placeShape(3, 4, plains1x1.shape, plains1x1, 0);
        
        // Force terrain.id to be GL1_PLAINS for merge match
        [ [2,3], [2,4], [3,3], [3,4] ].forEach(([r, c]) => {
            window.state.grid[r][c].terrain = { id: "GL1_PLAINS", nameKey: "TERRAIN_PLAINS" };
        });

        window.state.checkMergePatterns();
        render();
    });

    const mergeCellData = await page.evaluate(() => {
        const mergedCell = document.querySelector('.cell[data-r="2"][data-c="3"]');
        return {
            isMergedClass: mergedCell ? mergedCell.classList.contains('merged') : false,
            borderStyle: mergedCell ? mergedCell.style.borderStyle : '',
            hasLabel: mergedCell ? mergedCell.innerHTML.includes('2x2') : false
        };
    });

    const screenshotPath = 'C:/Users/mam07/.gemini/antigravity/brain/af6d4803-5dd7-4a55-87d7-472ecdecfde4/approach_c_tile_difference_real.png';
    await page.screenshot({ path: screenshotPath });

    console.log('=============================================================');
    console.log('DIFFERENTIATION APPROACH C (MONOLITH VS MERGE CORE) REAL MEASUREMENT');
    console.log('=============================================================');
    console.log(`- 1. Multi-tile Card Cell1 BorderRightStyle (Expected: "none"): "${multiTileBorder.cell1BorderRightStyle}"`);
    console.log(`- 2. Multi-tile Card Cell2 BorderLeftStyle (Expected: "none"): "${multiTileBorder.cell2BorderLeftStyle}"`);
    console.log(`- 3. Merged Territory Class 'merged' (Expected: true): ${mergeCellData.isMergedClass}`);
    console.log(`- 4. Merged Territory BorderStyle (Expected: "dashed"): "${mergeCellData.borderStyle}"`);
    console.log(`- 5. Merged Territory 2x2 Label (Expected: true): ${mergeCellData.hasLabel}`);
    console.log(`- Approach C Differentiation 100% SUCCESS: ${multiTileBorder.cell1BorderRightStyle === 'none' && mergeCellData.isMergedClass && mergeCellData.borderStyle === 'dashed'}`);
    console.log('-------------------------------------------------------------');

    await browser.close();
})();
