const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  await page.goto('http://localhost:8080/index_v2.html');
  await page.waitForSelector('.cell');

  // 1. 1x2 カードを選択
  await page.evaluate(() => {
    if (window.state && window.state.handOffering[0]) {
      window.state.handOffering[0].currentShape = [[1, 1]];
      window.state.handOffering[0].shape = [[1, 1]];
    }
    if (window.selectCard) window.selectCard(0);
  });

  // 2. セル(1,1) にマウスホバー
  const targetCell = await page.$('.cell[data-r="1"][data-c="1"]');
  if (targetCell) {
    await targetCell.hover();
    
    // 最初のエレメント形状取得
    const initialShape = await page.evaluate(() => window.state && window.state.handOffering[0] ? JSON.stringify(window.state.handOffering[0].currentShape) : '');
    
    // 右クリック実行
    await targetCell.click({ button: 'right' });
    
    // 回転後の形状取得
    const rotatedShape = await page.evaluate(() => window.state && window.state.handOffering[0] ? JSON.stringify(window.state.handOffering[0].currentShape) : '');
    
    console.log('RIGHT CLICK ROTATION RESULT:', { initialShape, rotatedShape });

    if (initialShape !== rotatedShape && rotatedShape.length > 0) {
      console.log('TEST_PASS');
    } else {
      console.log('TEST_FAIL');
    }
  } else {
    console.log('TEST_FAIL: Cell not found');
  }

  await browser.close();
})();
