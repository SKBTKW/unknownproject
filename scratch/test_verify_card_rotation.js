const { chromium } = require('playwright');
const path = require('path');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    const filePath = 'file:///' + path.resolve(__dirname, '../game/index_v2.html').replace(/\\/g, '/');
    await page.goto(filePath);
    await page.waitForTimeout(500);

    // 1. Select first card
    const firstCard = page.locator('#cardRow .card-frame-tcg').first();
    await firstCard.click();
    await page.waitForTimeout(100);

    // Get shape before rotation
    const shapeBefore = await page.evaluate(() => window.selectedCard ? window.selectedCard.currentShape : null);

    // 2. Click rotate button on card
    const rotateBtn = firstCard.locator('.tcg-rotate-btn-wireframe');
    await rotateBtn.click();
    await page.waitForTimeout(100);

    // Get shape after rotation
    const shapeAfterRotateBtn = await page.evaluate(() => window.selectedCard ? window.selectedCard.currentShape : null);

    // 3. Right click on a board cell (r:2, c:2)
    const cell = page.locator('.cell[data-r="2"][data-c="2"]');
    await cell.click({ button: 'right' });
    await page.waitForTimeout(100);

    const shapeAfterRightClick = await page.evaluate(() => window.selectedCard ? window.selectedCard.currentShape : null);

    console.log('SHAPE BEFORE:', JSON.stringify(shapeBefore));
    console.log('SHAPE AFTER ROTATE BTN:', JSON.stringify(shapeAfterRotateBtn));
    console.log('SHAPE AFTER RIGHT CLICK:', JSON.stringify(shapeAfterRightClick));

    await browser.close();

    const isBtnRotated = shapeBefore && shapeAfterRotateBtn && (shapeBefore.length !== shapeAfterRotateBtn.length || shapeBefore[0].length !== shapeAfterRotateBtn[0].length);
    const isRightClickRotated = shapeAfterRotateBtn && shapeAfterRightClick && (shapeAfterRotateBtn.length !== shapeAfterRightClick.length || shapeAfterRotateBtn[0].length !== shapeAfterRightClick[0].length);

    if (isBtnRotated && isRightClickRotated) {
        console.log('SUCCESS: Card rotation & right click rotation verified 100%!');
        process.exit(0);
    } else {
        console.error('FAILED: Rotation logic failed!');
        process.exit(1);
    }
})();
