const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  const htmlPath = 'file:///' + path.resolve(__dirname, '../game/index_v2.html').replace(/\\/g, '/');
  await page.goto(htmlPath);

  const res = await page.evaluate(() => {
    const state = window.state;
    const plains1x2 = { id: "CARD_PLAINS_1X2", terrainId: "GL1_PLAINS", nameKey: "TERRAIN_PLAINS", gl: 1, h: 1, food: 4, wood: 0, def: 0, mystic: 0, shape: [[1, 1]] };
    const plains1x1 = { id: "CARD_PLAINS_1X1", terrainId: "GL1_PLAINS", nameKey: "TERRAIN_PLAINS", gl: 1, h: 1, food: 4, wood: 0, def: 0, mystic: 0, shape: [[1]] };

    // 1. (1,2)-(1,3) に 1x2 平地を配置
    state.hasPickedThisTurn = false;
    state.placeShape(1, 2, plains1x2.shape, plains1x2);
    // (0,2) に 1x1 平地を配置
    state.hasPickedThisTurn = false;
    state.placeShape(0, 2, plains1x1.shape, plains1x1);
    // (0,3) に 1x1 平地を配置 (これで (0,2),(0,3),(1,2),(1,3) の 2x2 平地が完成!)
    state.hasPickedThisTurn = false;
    state.placeShape(0, 3, plains1x1.shape, plains1x1);

    window.render();

    // DOM要素上に .merge-center-label が生成されているかチェック
    const labelEl = document.querySelector('.merge-center-label');
    const hasCenterLabel = !!labelEl;
    const labelText = labelEl ? labelEl.innerText : '';
    const styleLeft = labelEl ? labelEl.style.left : '';
    const styleTop = labelEl ? labelEl.style.top : '';

    return {
      hasCenterLabel,
      labelText,
      styleLeft,
      styleTop
    };
  });

  console.log('Merge Center Label Placement Verification:', res);
  await browser.close();

  if (res.hasCenterLabel && res.labelText.includes('大草原')) {
    console.log('TEST_PASS');
  } else {
    console.log('TEST_FAIL');
    process.exit(1);
  }
})();
