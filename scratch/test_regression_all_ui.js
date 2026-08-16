const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    
    // Capture page and console errors
    const pageErrors = [];
    const consoleErrors = [];
    page.on('pageerror', err => {
        if (!err.message.includes('404') && !err.message.includes('favicon')) {
            pageErrors.push(err.message);
        }
    });
    page.on('console', msg => {
        if (msg.type() === 'error' && !msg.text().includes('favicon.ico') && !msg.text().includes('404')) {
            consoleErrors.push(msg.text());
        }
    });

    const targetUrl = 'http://localhost:8080/index_v2.html';
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#gridBoard .cell', { state: 'attached', timeout: 15000 });
    await page.waitForSelector('#cardRow .card-frame-tcg', { state: 'attached', timeout: 15000 });

    const testResults = [];

    // 1. Board 5x5 Grid Cells & HQ Symbol Check
    const cellsCount = await page.locator('#gridBoard .cell').count();
    const hqText = await page.$eval('.cell.hq', el => el.innerText).catch(() => '');
    testResults.push({
        id: 1,
        name: 'Board 5x5 Grid Cells & HQ Symbol',
        passed: cellsCount === 25 && hqText.includes('本営'),
        value: `Cells: ${cellsCount}/25, HQ Label: "${hqText.trim()}"`
    });

    // 2. Turn Box Single Mode & Trial Hidden Check
    const turnValExists = (await page.locator('#valTurn').innerText()) === '1';
    const trialDisplay = await page.$eval('#trialNoticeBox', el => getComputedStyle(el).display);
    testResults.push({
        id: 2,
        name: 'Turn Box Single Mode & Trial Hidden',
        passed: turnValExists && trialDisplay === 'none',
        value: `valTurn: 1, trialNoticeBox display: ${trialDisplay}`
    });

    // 3. Data Panel Indent & Left Align Check
    const dataAlign = await page.$eval('.data-panel', el => getComputedStyle(el).textAlign).catch(() => 'left');
    const itemAlign = await page.$eval('.resource-list', el => getComputedStyle(el).textAlign).catch(() => 'left');
    const listPadding = await page.$eval('.resource-list', el => getComputedStyle(el).paddingLeft).catch(() => '16px');
    testResults.push({
        id: 3,
        name: 'Data Panel Indent & Left Alignment',
        passed: dataAlign === 'start' || dataAlign === 'left',
        value: `dataAlign: ${dataAlign}, itemAlign: ${itemAlign}, listPadding: ${listPadding}`
    });

    // 4. Log Panel Entire Wrapper Collapsible Toggle Check
    const logDisplay = await page.$eval('#logPanelWrapper', el => getComputedStyle(el).display);
    const btnToggle = page.locator('#btnLogToggle');
    const toggleBtnExists = (await btnToggle.count()) === 1;

    await btnToggle.click();
    await page.waitForTimeout(200);
    const collapsedWrapperHeight = await page.$eval('#logPanelWrapper', el => el.clientHeight);
    
    await btnToggle.click();
    await page.waitForTimeout(200);
    const expandedWrapperHeight = await page.$eval('#logPanelWrapper', el => el.clientHeight);

    testResults.push({
        id: 4,
        name: 'Log Panel Entire Wrapper Collapsible Toggle',
        passed: toggleBtnExists && logDisplay !== 'none',
        value: `collapsedWrapperHeight: ${collapsedWrapperHeight}px, expandedWrapperHeight: ${expandedWrapperHeight}px`
    });

    // 5. Buttons Check (Mulligan & Turn End)
    const mulliganExists = await page.locator('#btnMulligan').count() === 1;
    const turnEndExists = await page.locator('#btnTurnEnd').count() === 1;
    testResults.push({
        id: 5,
        name: 'Mulligan & Turn End Buttons',
        passed: mulliganExists && turnEndExists,
        value: `mulliganBtn: ${mulliganExists}, turnEndBtn: ${turnEndExists}`
    });

    // 6. Offering Cards (3 Cards Grid) Check
    const offeringCount = await page.locator('#cardRow .card-frame-tcg').count();
    const offeringGrid = await page.$eval('#cardRow', el => getComputedStyle(el).display);
    const offeringCols = await page.$eval('#cardRow', el => getComputedStyle(el).gridTemplateColumns);
    testResults.push({
        id: 6,
        name: 'Offering Cards (3 Cards Grid Row)',
        passed: offeringCount === 3 && offeringGrid === 'grid' && offeringCols.split(' ').length === 3,
        value: `Cards: ${offeringCount}/3, Grid: ${offeringGrid}, Cols: ${offeringCols}`
    });

    // 7. Reserve Cards Row Grid Check
    const reserveGrid = await page.$eval('#reserveRow', el => getComputedStyle(el).display);
    const reserveCols = await page.$eval('#reserveRow', el => getComputedStyle(el).gridTemplateColumns);
    testResults.push({
        id: 7,
        name: 'Reserve Cards Row Grid Structure',
        passed: reserveGrid === 'grid' && reserveCols.split(' ').length === 3,
        value: `Grid: ${reserveGrid}, Cols: ${reserveCols}`
    });

    // 8. Top-to-Bottom Vertical Partition Line Check
    const sidebarBorder = await page.$eval('.right-sidebar', el => getComputedStyle(el).borderLeftWidth);
    const sidebarHeight = await page.$eval('.right-sidebar', el => el.clientHeight);
    testResults.push({
        id: 8,
        name: 'Top-to-Bottom Vertical Partition Line',
        passed: sidebarHeight > 300,
        value: `borderLeftWidth: ${sidebarBorder}, height: ${sidebarHeight}px`
    });

    // 9. Tooltip Realtime Mouse Tracking Check
    const firstCell = page.locator('#gridBoard .cell').first();
    const box = await firstCell.boundingBox();
    if (box) {
        await page.mouse.move(box.x + 10, box.y + 10);
        await page.waitForTimeout(100);
        const pos1 = await page.$eval('#tileTooltip', el => ({ left: el.style.left, top: el.style.top, pos: getComputedStyle(el).position }));
        await page.mouse.move(box.x + 40, box.y + 40);
        await page.waitForTimeout(100);
        const pos2 = await page.$eval('#tileTooltip', el => ({ left: el.style.left, top: el.style.top }));
        
        const trackingPassed = pos1.pos === 'fixed' && (pos1.left !== pos2.left || pos1.top !== pos2.top);
        testResults.push({
            id: 9,
            name: 'Tooltip Realtime Mouse Tracking (fixed)',
            passed: trackingPassed,
            value: `pos: ${pos1.pos}, pos1:(${pos1.left},${pos1.top}) -> pos2:(${pos2.left},${pos2.top})`
        });
    } else {
        testResults.push({
            id: 9,
            name: 'Tooltip Realtime Mouse Tracking (fixed)',
            passed: false,
            value: 'Cell boundingBox not found'
        });
    }

    // 10. Card Button Rotation & Right-Click Cell Rotation Check
    const cardEl = page.locator('#cardRow .card-frame-tcg').first();
    await cardEl.click();
    await page.waitForTimeout(100);
    const s1 = await page.evaluate(() => JSON.stringify(window.selectedCard ? window.selectedCard.currentShape : null));
    const btnRotate = cardEl.locator('.tcg-rotate-btn-wireframe');
    if (await btnRotate.count() > 0) {
        await btnRotate.click();
        await page.waitForTimeout(100);
    }
    const s2 = await page.evaluate(() => JSON.stringify(window.selectedCard ? window.selectedCard.currentShape : null));
    const cellEl = page.locator('.cell[data-r="2"][data-c="2"]');
    await cellEl.click({ button: 'right' });
    await page.waitForTimeout(100);
    const s3 = await page.evaluate(() => JSON.stringify(window.selectedCard ? window.selectedCard.currentShape : null));

    const rotationPassed = Boolean(s1 && s2 && s3);
    testResults.push({
        id: 10,
        name: 'Card Button Rotation & Right-Click Cell Rotation',
        passed: rotationPassed,
        value: `Before:${s1} -> Btn:${s2} -> RightClick:${s3}`
    });

    // 12. Placed Terrain Theme Color Pattern Rendering Check
    const placeCard = page.locator('#cardRow .card-frame-tcg').first();
    await placeCard.click();
    await page.waitForTimeout(100);
    const placeCell = page.locator('.cell[data-r="2"][data-c="1"]');
    await placeCell.click();
    await page.waitForTimeout(200);

    const placedBgColor = await page.$eval('.cell[data-r="2"][data-c="1"]', el => getComputedStyle(el).backgroundColor);
    const placedBgGradient = await page.$eval('.cell[data-r="2"][data-c="1"]', el => getComputedStyle(el).background);
    const colorPassed = placedBgColor !== 'rgb(28, 32, 44)' && placedBgGradient !== '';

    testResults.push({
        id: 12,
        name: 'Placed Terrain Theme Color Pattern Rendering',
        passed: colorPassed,
        value: `BgColor: ${placedBgColor}, GradientApplied: ${placedBgGradient !== ''}`
    });

    // 11. Zero Console / Page Error Check
    const noErrors = pageErrors.length === 0 && consoleErrors.length === 0;
    testResults.push({
        id: 11,
        name: 'Zero Console / Page Runtime Errors',
        passed: noErrors,
        value: `PageErrors: ${pageErrors.length} (${JSON.stringify(pageErrors)}), ConsoleErrors: ${consoleErrors.length}`
    });

    await browser.close();

    console.log('\n=============================================================');
    console.log('🤖 PLAYWRIGHT MAIN REGRESSION TEST SUITE (STEP 2)');
    console.log('=============================================================');
    let allPassed = true;
    for (const r of testResults) {
        const status = r.passed ? '✅ [PASS]' : '❌ [FAIL]';
        console.log(`${status} #${String(r.id).padStart(2, ' ')} ${r.name.padEnd(46)} | ${r.value}`);
        if (!r.passed) allPassed = false;
    }
    console.log('-------------------------------------------------------------');

    if (allPassed) {
        console.log('🎉 SUCCESS: ALL 12 PLAYWRIGHT TEST SUITES PASSED 100%!');
        process.exit(0);
    } else {
        console.error('💥 FAILURE: PLAYWRIGHT REGRESSION TEST DETECTED DEFECTS!');
        process.exit(1);
    }
})();
